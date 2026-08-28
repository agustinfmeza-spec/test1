import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const plan = await prisma.maintenance_plans.findUnique({
    where: { id },
    include: {
      maintenance_strategies: { include: { maintenance_packages: true } },
      measuring_points: true,
      maintenance_items: { include: { equipment: true, functional_locations: true, task_lists: true } },
      maintenance_calls: { orderBy: { scheduled_date: "asc" }, take: 20 },
    },
  });
  if (!plan) throw notFound("Plan de mantenimiento no encontrado");
  return NextResponse.json(plan);
});
