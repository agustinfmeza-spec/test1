import {
  simulateTimeBasedPlan,
  simulateCounterBasedPlan,
  simulateStrategyPlan,
  runSchedulingEngine,
  MaintenancePlan,
} from './simulation-engine';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FALLÓ: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const today = new Date('2026-08-28T00:00:00Z');

// --- 1. Plan por tiempo: cada 30 días ---
const timePlan: MaintenancePlan = {
  id: 'plan-1',
  code: 'PLAN-30D',
  planType: 'TIME_BASED',
  cycleValue: 30,
  cycleUnit: 'DAY',
  startDate: new Date('2026-01-01T00:00:00Z'),
  lastCallDate: new Date('2026-07-30T00:00:00Z'),
  shiftFactorEarlyPct: 10,
  shiftFactorLatePct: 10,
  callHorizonPct: 90, // dispara cuando resta 10% del ciclo (3 días de un ciclo de 30)
};

const timeCalls = simulateTimeBasedPlan(timePlan, { today, horizonMonths: 6 });
assert(timeCalls.length > 0, 'plan por tiempo genera llamados');
assert(timeCalls[0].scheduledDate.getTime() === new Date('2026-08-29T00:00:00Z').getTime(), `primer llamado = 2026-08-29 (obtuvo ${timeCalls[0].scheduledDate.toISOString()})`);
assert(timeCalls[0].shouldGenerateNow === true, 'el primer llamado ya debe dispararse (dentro del horizonte del 90%)');
assert(timeCalls[1].shouldGenerateNow === false, 'el segundo llamado (28-sep) aún no debe dispararse');
console.log('Calendario plan por tiempo:', timeCalls.map((c) => ({ n: c.callNumber, fecha: c.scheduledDate.toISOString().slice(0, 10), dispara: c.shouldGenerateNow })));

// --- 2. Plan por contador: cada 10.000 horas, con historial de horómetro ---
const counterPlan: MaintenancePlan = {
  id: 'plan-2',
  code: 'PLAN-10000H',
  planType: 'COUNTER_BASED',
  cycleValue: 10000,
  cycleUnit: 'HOUR_METER',
  startDate: new Date('2025-01-01T00:00:00Z'),
  lastCallCounter: 20000, // último service a las 20.000 hs
  shiftFactorEarlyPct: 5,
  shiftFactorLatePct: 5,
  callHorizonPct: 95,
};

// Simula un equipo que acumula ~20 horas/día (uso intensivo, ej. planta continua)
const readings = [
  { date: new Date('2026-06-01T00:00:00Z'), value: 24000 },
  { date: new Date('2026-08-01T00:00:00Z'), value: 25200 }, // 1200 hs en 61 días ≈ 19.7 hs/día
];

const counterCalls = simulateCounterBasedPlan(counterPlan, readings, { today, horizonMonths: 12 });
assert(counterCalls.length > 0, 'plan por contador genera llamados proyectados');
assert(counterCalls[0].dueCounterReading === 30000, `primer llamado vence a las 30.000 hs (obtuvo ${counterCalls[0].dueCounterReading})`);
console.log('Calendario plan por contador:', counterCalls.map((c) => ({ n: c.callNumber, fechaEstimada: c.scheduledDate.toISOString().slice(0, 10), contadorVence: c.dueCounterReading, dispara: c.shouldGenerateNow })));

// --- 3. Plan de estrategia multi-ciclo: 1M + 3M que caen combinados en un trimestre ---
const strategyPlan: MaintenancePlan = {
  id: 'plan-3',
  code: 'PLAN-ESTRATEGIA',
  planType: 'TIME_BASED',
  startDate: new Date('2026-01-01T00:00:00Z'),
  shiftFactorEarlyPct: 10,
  shiftFactorLatePct: 15, // tolerancia amplia para forzar la fusión en el ejemplo
  callHorizonPct: 90,
  packages: [
    { id: 'pkg-1m', packageKey: '1M', cycleValue: 1, cycleUnit: 'MONTH' },
    { id: 'pkg-3m', packageKey: '3M', cycleValue: 3, cycleUnit: 'MONTH' },
  ],
};

const strategyCalls = simulateStrategyPlan(strategyPlan, { today, horizonMonths: 4 });
assert(strategyCalls.length > 0, 'plan de estrategia genera llamados combinados');
const combinedCall = strategyCalls.find((c) => (c.packageKeysCombined?.length ?? 0) > 1);
assert(!!combinedCall, 'al menos un llamado combina 1M + 3M (mismo trimestre, dentro de tolerancia)');
console.log('Calendario plan de estrategia:', strategyCalls.map((c) => ({ n: c.callNumber, fecha: c.scheduledDate.toISOString().slice(0, 10), paquetes: c.packageKeysCombined })));

// --- 4. Orquestador combinando todos los planes activos ---
const engineResult = runSchedulingEngine([timePlan, counterPlan, strategyPlan], {
  today,
  horizonMonths: 6,
  counterReadingsByPlanId: { 'plan-2': readings },
});
assert(engineResult.calendar.length === timeCalls.length + engineResult.calendar.filter((c) => c.planId === 'plan-2').length + engineResult.calendar.filter((c) => c.planId === 'plan-3').length, 'el orquestador agrega llamados de todos los planes');
assert(engineResult.dueNow.length >= 1, 'el orquestador identifica al menos un llamado "due now" para promover a Orden de Trabajo');
console.log(`Llamados totales: ${engineResult.calendar.length}, due now: ${engineResult.dueNow.length}`);

if (process.exitCode === 1) {
  console.error('\nSMOKE TEST: FALLÓ');
} else {
  console.log('\nSMOKE TEST: TODO OK');
}
