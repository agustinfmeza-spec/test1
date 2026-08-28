import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { badRequest } from "@/lib/api-error";

const createSchema = z
  .object({
    equipment_id: z.uuid().optional(),
    functional_location_id: z.uuid().optional(),
    code: z.string().min(1).max(40),
    description: z.string().min(1).max(150),
    unit_of_measure: z.string().min(1).max(10),
    is_cumulative: z.boolean().optional(),
  })
  .refine((v) => !!v.equipment_id || !!v.functional_location_id, {
    message: "Debe indicar equipment_id o functional_location_id",
  });

export const GET = withHandler(async (req) => {
  await requireSession();
  const equipmentId = new URL(req.url).searchParams.get("equipmentId") ?? undefined;
  const points = await prisma.measuring_points.findMany({
    where: equipmentId ? { equipment_id: equipmentId } : undefined,
    orderBy: { code: "asc" },
  });
  return NextResponse.json(points);
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest("Datos inválidos", parsed.error.flatten());
  const point = await prisma.measuring_points.create({ data: parsed.data });
  return NextResponse.json(point, { status: 201 });
});
