import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { plan_type, cycle_unit, scheduling_indicator } from "@/generated/prisma/enums";
import { badRequest } from "@/lib/api-error";

const createSchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(255),
  plan_type: z.enum(plan_type),
  maintenance_strategy_id: z.uuid().optional(),
  cycle_value: z.number().int().positive().optional(),
  cycle_unit: z.enum(cycle_unit).optional(),
  measuring_point_id: z.uuid().optional(),
  start_date: z.coerce.date(),
  scheduling_indicator: z.enum(scheduling_indicator).optional(),
  shift_factor_early_pct: z.number().min(0).max(100).optional(),
  shift_factor_late_pct: z.number().min(0).max(100).optional(),
  call_horizon_pct: z.number().min(0).max(100).optional(),
  planned_completion_offset_days: z.number().int().min(0).optional(),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const status = url.searchParams.get("status") ?? undefined;

  const where = {
    ...(query.search ? { description: { contains: query.search, mode: "insensitive" as const } } : {}),
    ...(status ? { status: status as "ACTIVE" | "INACTIVE" | "DELETED" } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.maintenance_plans.findMany({
      where,
      orderBy: { code: "asc" },
      skip: query.skip,
      take: query.take,
      include: { _count: { select: { maintenance_items: true } }, maintenance_strategies: true },
    }),
    prisma.maintenance_plans.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const body = createSchema.parse(await req.json());

  if (!body.maintenance_strategy_id && (!body.cycle_value || !body.cycle_unit)) {
    throw badRequest("Un plan sin estrategia requiere cycle_value y cycle_unit (ciclo único)");
  }
  if ((body.plan_type === "COUNTER_BASED" || body.plan_type === "MULTIPLE_COUNTER") && !body.measuring_point_id) {
    throw badRequest("Los planes por contador requieren measuring_point_id");
  }

  const plan = await prisma.maintenance_plans.create({ data: body });
  return NextResponse.json(plan, { status: 201 });
});
