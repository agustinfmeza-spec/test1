import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createSchema = z.object({
  plant_id: z.uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  specialty: z.string().min(1).max(50),
  cost_center_id: z.uuid().optional(),
  capacity_hours_per_day: z.number().positive().max(24).optional(),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const plantId = new URL(req.url).searchParams.get("plantId") ?? undefined;
  const workCenters = await prisma.work_centers.findMany({
    where: { active: true, ...(plantId ? { plant_id: plantId } : {}) },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(workCenters);
});

export const POST = withHandler(async (req) => {
  await requireRole("ADMIN", "PLANNER");
  const body = createSchema.parse(await req.json());
  const workCenter = await prisma.work_centers.create({ data: body });
  return NextResponse.json(workCenter, { status: 201 });
});
