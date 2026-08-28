import { prisma } from "@/lib/prisma";
import {
  runSchedulingEngine,
  type MaintenancePlan as EnginePlan,
  type CounterReading,
  type SimulatedCall,
} from "@/server/simulation-engine";

const PLAN_INCLUDE = {
  maintenance_strategies: { include: { maintenance_packages: true } },
} as const;

type DbPlan = Awaited<ReturnType<typeof loadActivePlans>>[number];

async function loadActivePlans(planIds?: string[]) {
  return prisma.maintenance_plans.findMany({
    where: {
      status: "ACTIVE",
      plan_type: { not: "CONDITION_BASED" },
      ...(planIds ? { id: { in: planIds } } : {}),
    },
    include: PLAN_INCLUDE,
  });
}

function toEnginePlan(plan: DbPlan): EnginePlan {
  const packages = plan.maintenance_strategies?.maintenance_packages.map((pkg) => ({
    id: pkg.id,
    packageKey: pkg.package_key,
    cycleValue: pkg.cycle_value,
    cycleUnit: pkg.cycle_unit,
  }));

  return {
    id: plan.id,
    code: plan.code,
    planType: plan.plan_type as EnginePlan["planType"],
    cycleValue: plan.cycle_value ?? undefined,
    cycleUnit: plan.cycle_unit ?? undefined,
    packages: packages && packages.length > 0 ? packages : undefined,
    startDate: plan.start_date,
    lastCallDate: plan.last_call_date ?? undefined,
    lastCallCounter: plan.last_call_counter ? Number(plan.last_call_counter) : undefined,
    shiftFactorEarlyPct: Number(plan.shift_factor_early_pct),
    shiftFactorLatePct: Number(plan.shift_factor_late_pct),
    callHorizonPct: Number(plan.call_horizon_pct),
  };
}

export interface SimulationRunResult {
  calendar: SimulatedCall[];
  dueNow: SimulatedCall[];
  skippedPlans: { planId: string; code: string; reason: string }[];
}

/**
 * Corre el motor de simulación contra los planes activos (o el subconjunto indicado),
 * usando lecturas de contador reales para los planes por rendimiento, y persiste el
 * calendario resultante en `maintenance_calls`. Las filas con status SIMULATED se
 * reemplazan en cada corrida (son proyección provisional); las que ya son CALLED,
 * COMPLETED o SKIPPED se conservan como historial.
 */
export async function runAndPersistSimulation(options: {
  planIds?: string[];
  horizonMonths: number;
  today?: Date;
}): Promise<SimulationRunResult> {
  const dbPlans = await loadActivePlans(options.planIds);
  const skippedPlans: SimulationRunResult["skippedPlans"] = [];
  const enginePlans: EnginePlan[] = [];
  const counterReadingsByPlanId: Record<string, CounterReading[]> = {};

  for (const plan of dbPlans) {
    if (plan.plan_type === "COUNTER_BASED" || plan.plan_type === "MULTIPLE_COUNTER") {
      if (!plan.measuring_point_id) {
        skippedPlans.push({ planId: plan.id, code: plan.code, reason: "Plan por contador sin punto de medición asignado" });
        continue;
      }
      const readings = await prisma.measurement_documents.findMany({
        where: { measuring_point_id: plan.measuring_point_id },
        orderBy: { reading_date: "asc" },
        select: { reading_date: true, counter_reading: true },
      });
      if (readings.length < 2) {
        skippedPlans.push({ planId: plan.id, code: plan.code, reason: "Se necesitan al menos 2 lecturas históricas del contador para proyectar" });
        continue;
      }
      counterReadingsByPlanId[plan.id] = readings.map((r) => ({ date: r.reading_date, value: Number(r.counter_reading) }));
    }
    enginePlans.push(toEnginePlan(plan));
  }

  const { calendar, dueNow } = runSchedulingEngine(enginePlans, {
    today: options.today,
    horizonMonths: options.horizonMonths,
    counterReadingsByPlanId,
  });

  // Se recalculan por completo los llamados aun no liberados (SIMULATED/SCHEDULED);
  // los ya liberados (CALLED), completados o marcados SKIPPED quedan como historial.
  const simulatedPlanIds = enginePlans.map((p) => p.id);
  await prisma.maintenance_calls.deleteMany({
    where: { maintenance_plan_id: { in: simulatedPlanIds }, status: { in: ["SIMULATED", "SCHEDULED"] } },
  });

  if (calendar.length > 0) {
    await prisma.maintenance_calls.createMany({
      data: calendar.map((call) => ({
        maintenance_plan_id: call.planId,
        maintenance_package_id: call.packageId ?? null,
        call_number: call.callNumber,
        scheduled_date: call.scheduledDate,
        due_counter_reading: call.dueCounterReading,
        status: call.shouldGenerateNow ? "SCHEDULED" : "SIMULATED",
      })),
    });
  }

  return { calendar, dueNow, skippedPlans };
}
