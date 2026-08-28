/**
 * Motor de Simulación de Planes de Mantenimiento (CMMS/EAM)
 *
 * Replica la lógica funcional de la programación de planes de mantenimiento
 * de SAP PM (transacción IP10/IP30): dado un plan activo, proyecta las
 * fechas de "llamado" (maintenance call) hacia adelante en un horizonte
 * dado, y determina cuáles de esos llamados ya deben convertirse en
 * Órdenes de Trabajo reales según el "horizonte de llamado" configurado.
 *
 * Es agnóstico de infraestructura: no importa la base de datos. Recibe
 * los planes ya cargados (DTOs) y devuelve la proyección; la capa de
 * aplicación persiste el resultado en la tabla `maintenance_calls` y,
 * para los llamados "due", crea la fila en `work_orders` (lo que a su vez
 * dispara el trigger SQL que copia operaciones/componentes de la hoja de
 * ruta — ver database/schema.sql).
 */

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

export type CycleUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'HOUR_METER' | 'KM' | 'CYCLE_COUNT';

const CALENDAR_UNITS: ReadonlySet<CycleUnit> = new Set(['DAY', 'WEEK', 'MONTH', 'YEAR']);
const COUNTER_UNITS: ReadonlySet<CycleUnit> = new Set(['HOUR_METER', 'KM', 'CYCLE_COUNT']);

export interface MaintenancePackage {
  id: string;
  packageKey: string; // '1M', '3M', '6M', '1A'...
  cycleValue: number;
  cycleUnit: CycleUnit;
}

export type PlanType = 'TIME_BASED' | 'COUNTER_BASED' | 'MULTIPLE_COUNTER';

export interface MaintenancePlan {
  id: string;
  code: string;
  planType: PlanType;
  /** Ciclo único (planes simples, sin estrategia) */
  cycleValue?: number;
  cycleUnit?: CycleUnit;
  /** Planes multi-ciclo (estrategia con varios paquetes combinados) */
  packages?: MaintenancePackage[];
  startDate: Date;
  /** Ancla de la última ejecución real; si no hay, se usa startDate */
  lastCallDate?: Date;
  lastCallCounter?: number;
  /** Tolerancia de adelanto/atraso, en % del ciclo (equivalente a los "shift factors" de SAP) */
  shiftFactorEarlyPct: number;
  shiftFactorLatePct: number;
  /** % del ciclo transcurrido a partir del cual se debe generar la OT (SAP: horizonte de llamado) */
  callHorizonPct: number;
}

export interface CounterReading {
  date: Date;
  value: number;
}

export interface SimulatedCall {
  planId: string;
  packageId?: string;
  packageKeysCombined?: string[]; // cuando varios paquetes caen dentro de la tolerancia y se fusionan
  callNumber: number;
  scheduledDate: Date;
  dueCounterReading?: number;
  /** true si, a la fecha de referencia (`today`), ya corresponde generar la Orden de Trabajo */
  shouldGenerateNow: boolean;
}

export interface SimulationOptions {
  /** Fecha de referencia para decidir qué llamados están "due"; por defecto: hoy */
  today?: Date;
  /** Horizonte de proyección hacia adelante */
  horizonMonths?: number;
  /** Lecturas históricas de contador, requeridas para planes COUNTER_BASED/MULTIPLE_COUNTER */
  counterReadingsByPlanId?: Record<string, CounterReading[]>;
}

// ---------------------------------------------------------------------
// Utilidades de fecha
// ---------------------------------------------------------------------

function addCycle(base: Date, value: number, unit: CycleUnit): Date {
  const d = new Date(base.getTime());
  switch (unit) {
    case 'DAY':
      d.setDate(d.getDate() + value);
      return d;
    case 'WEEK':
      d.setDate(d.getDate() + value * 7);
      return d;
    case 'MONTH':
      d.setMonth(d.getMonth() + value);
      return d;
    case 'YEAR':
      d.setFullYear(d.getFullYear() + value);
      return d;
    default:
      throw new Error(`addCycle no aplica a la unidad de contador "${unit}"`);
  }
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

/** Duración aproximada de un ciclo calendario expresada en días (para el cálculo del horizonte de llamado). */
function cycleLengthInDays(value: number, unit: CycleUnit): number {
  switch (unit) {
    case 'DAY':
      return value;
    case 'WEEK':
      return value * 7;
    case 'MONTH':
      return value * 30.44; // promedio calendario gregoriano
    case 'YEAR':
      return value * 365.25;
    default:
      throw new Error(`cycleLengthInDays no aplica a la unidad de contador "${unit}"`);
  }
}

// ---------------------------------------------------------------------
// 1. Simulación de planes basados en TIEMPO (ciclo único)
// ---------------------------------------------------------------------

export function simulateTimeBasedPlan(plan: MaintenancePlan, options: SimulationOptions = {}): SimulatedCall[] {
  if (!plan.cycleValue || !plan.cycleUnit) {
    throw new Error(`Plan ${plan.code}: falta cycleValue/cycleUnit para un plan de ciclo único`);
  }
  if (!CALENDAR_UNITS.has(plan.cycleUnit)) {
    throw new Error(`Plan ${plan.code}: la unidad "${plan.cycleUnit}" no es de calendario`);
  }

  const today = options.today ?? new Date();
  const horizonMonths = options.horizonMonths ?? 12;
  const horizonEnd = addCycle(today, horizonMonths, 'MONTH');

  const anchor = plan.lastCallDate ?? plan.startDate;
  const cycleDays = cycleLengthInDays(plan.cycleValue, plan.cycleUnit);
  // Horizonte de llamado: se dispara cuando resta (100 - callHorizonPct)% del ciclo por transcurrir.
  const horizonTriggerOffsetDays = cycleDays * (1 - plan.callHorizonPct / 100);

  const calls: SimulatedCall[] = [];
  let callNumber = 1;
  let cursor = addCycle(anchor, plan.cycleValue, plan.cycleUnit);

  while (cursor.getTime() <= horizonEnd.getTime()) {
    const horizonTriggerDate = new Date(cursor.getTime());
    horizonTriggerDate.setDate(horizonTriggerDate.getDate() - Math.round(horizonTriggerOffsetDays));

    calls.push({
      planId: plan.id,
      callNumber,
      scheduledDate: cursor,
      shouldGenerateNow: today.getTime() >= horizonTriggerDate.getTime(),
    });

    cursor = addCycle(cursor, plan.cycleValue, plan.cycleUnit);
    callNumber += 1;
  }

  return calls;
}

// ---------------------------------------------------------------------
// 2. Simulación de planes basados en CONTADOR (horómetro, km, ciclos)
// ---------------------------------------------------------------------

/**
 * Estima el consumo diario promedio del contador a partir del historial de
 * lecturas (regresión lineal simple entre la primera y la última lectura).
 * Con más lecturas se podría usar mínimos cuadrados; para un horizonte de
 * proyección de meses, el promedio simple es suficientemente robusto y es
 * el mismo criterio que usa SAP para "contadores estimados" cuando no hay
 * telemetría en tiempo real.
 */
export function estimateDailyUsageRate(readings: CounterReading[]): number {
  if (readings.length < 2) {
    throw new Error('Se requieren al menos 2 lecturas históricas para proyectar un plan por contador');
  }
  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const elapsedDays = daysBetween(first.date, last.date);
  if (elapsedDays <= 0) {
    throw new Error('Las lecturas históricas deben abarcar un período de tiempo positivo');
  }
  return (last.value - first.value) / elapsedDays;
}

export function simulateCounterBasedPlan(plan: MaintenancePlan, readings: CounterReading[], options: SimulationOptions = {}): SimulatedCall[] {
  if (!plan.cycleValue || !plan.cycleUnit) {
    throw new Error(`Plan ${plan.code}: falta cycleValue/cycleUnit`);
  }
  if (!COUNTER_UNITS.has(plan.cycleUnit)) {
    throw new Error(`Plan ${plan.code}: la unidad "${plan.cycleUnit}" no es de contador`);
  }

  const today = options.today ?? new Date();
  const horizonMonths = options.horizonMonths ?? 12;
  const horizonEndDays = horizonMonths * 30.44;

  const dailyRate = estimateDailyUsageRate(readings);
  if (dailyRate <= 0) {
    // El equipo no acumula uso (parado/dado de baja): no hay llamados que proyectar.
    return [];
  }

  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const currentReading = plan.lastCallCounter ?? sorted[sorted.length - 1].value;
  const lastKnownReading = sorted[sorted.length - 1];

  const calls: SimulatedCall[] = [];
  let callNumber = 1;
  let dueCounter = currentReading + plan.cycleValue;

  // Proyecta llamados sucesivos mientras la fecha estimada caiga dentro del horizonte
  while (true) {
    const daysUntilDue = (dueCounter - lastKnownReading.value) / dailyRate;
    const estimatedDate = new Date(lastKnownReading.date.getTime());
    estimatedDate.setDate(estimatedDate.getDate() + Math.round(daysUntilDue));

    if (daysBetween(today, estimatedDate) > horizonEndDays) break;

    // Contador actual estimado a "hoy", para decidir si ya se debe generar la OT
    const daysSinceLastReading = daysBetween(lastKnownReading.date, today);
    const estimatedCounterToday = lastKnownReading.value + dailyRate * Math.max(daysSinceLastReading, 0);
    const horizonTriggerCounter = dueCounter - plan.cycleValue * (1 - plan.callHorizonPct / 100);

    calls.push({
      planId: plan.id,
      callNumber,
      scheduledDate: estimatedDate,
      dueCounterReading: dueCounter,
      shouldGenerateNow: estimatedCounterToday >= horizonTriggerCounter,
    });

    dueCounter += plan.cycleValue;
    callNumber += 1;
  }

  return calls;
}

// ---------------------------------------------------------------------
// 3. Planes con ESTRATEGIA multi-ciclo (varios paquetes combinados)
// ---------------------------------------------------------------------

/**
 * Combina, dentro de la tolerancia (shift factor) del plan, los llamados de
 * distintos paquetes que caen en fechas cercanas -- igual que SAP evita
 * generar dos órdenes separadas para "cambio de aceite" (3M) y "revisión
 * general" (6M) si ambas caen la misma semana: se funden en un solo
 * llamado que arrastra el trabajo de ambos paquetes.
 */
export function simulateStrategyPlan(plan: MaintenancePlan, options: SimulationOptions = {}): SimulatedCall[] {
  if (!plan.packages || plan.packages.length === 0) {
    throw new Error(`Plan ${plan.code}: un plan de estrategia requiere al menos un paquete`);
  }

  const perPackageCalls: SimulatedCall[] = plan.packages.flatMap((pkg) =>
    simulateTimeBasedPlan(
      { ...plan, cycleValue: pkg.cycleValue, cycleUnit: pkg.cycleUnit },
      options,
    ).map((call) => ({ ...call, packageId: pkg.id, packageKeysCombined: [pkg.packageKey] })),
  );

  perPackageCalls.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  const toleranceDays = (call: SimulatedCall, pkg: MaintenancePackage) =>
    cycleLengthInDays(pkg.cycleValue, pkg.cycleUnit) * (plan.shiftFactorLatePct / 100);

  const merged: SimulatedCall[] = [];
  for (const call of perPackageCalls) {
    const pkg = plan.packages.find((p) => p.id === call.packageId)!;
    const last = merged[merged.length - 1];

    if (last && Math.abs(daysBetween(last.scheduledDate, call.scheduledDate)) <= toleranceDays(call, pkg)) {
      // Se funde con el llamado anterior: se conserva la fecha más temprana
      // y se acumulan las claves de paquete para que la OT incluya ambas hojas de ruta.
      last.packageKeysCombined = [...(last.packageKeysCombined ?? []), pkg.packageKey];
      last.shouldGenerateNow = last.shouldGenerateNow || call.shouldGenerateNow;
      last.scheduledDate = last.scheduledDate < call.scheduledDate ? last.scheduledDate : call.scheduledDate;
    } else {
      merged.push({ ...call });
    }
  }

  return merged.map((call, idx) => ({ ...call, callNumber: idx + 1 }));
}

// ---------------------------------------------------------------------
// 4. Orquestador: corre la simulación sobre un conjunto de planes activos
// ---------------------------------------------------------------------

export interface SchedulingEngineResult {
  calendar: SimulatedCall[]; // ordenado por fecha, para alimentar Gantt / calendario
  dueNow: SimulatedCall[]; // subconjunto que debe convertirse en Orden de Trabajo ahora
}

export function runSchedulingEngine(plans: MaintenancePlan[], options: SimulationOptions = {}): SchedulingEngineResult {
  const calendar: SimulatedCall[] = [];

  for (const plan of plans) {
    if (plan.planType === 'TIME_BASED') {
      calendar.push(...(plan.packages?.length ? simulateStrategyPlan(plan, options) : simulateTimeBasedPlan(plan, options)));
    } else if (plan.planType === 'COUNTER_BASED' || plan.planType === 'MULTIPLE_COUNTER') {
      const readings = options.counterReadingsByPlanId?.[plan.id];
      if (!readings) {
        throw new Error(`Plan ${plan.code}: se requieren lecturas de contador (counterReadingsByPlanId) para simular`);
      }
      calendar.push(...simulateCounterBasedPlan(plan, readings, options));
    }
  }

  calendar.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

  return {
    calendar,
    dueNow: calendar.filter((c) => c.shouldGenerateNow),
  };
}
