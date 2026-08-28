import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const planId = url.searchParams.get("planId");

  const where: Prisma.maintenance_callsWhereInput = {};
  if (from || to) {
    where.scheduled_date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (status) where.status = status as Prisma.maintenance_callsWhereInput["status"];
  if (planId) where.maintenance_plan_id = planId;

  const calls = await prisma.maintenance_calls.findMany({
    where,
    orderBy: { scheduled_date: "asc" },
    include: {
      maintenance_plans: { include: { maintenance_items: { include: { equipment: true, task_lists: true } } } },
      maintenance_packages: true,
    },
    take: 500,
  });

  return NextResponse.json(calls);
});
