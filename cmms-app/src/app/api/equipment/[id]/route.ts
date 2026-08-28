import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";
import { equipment_status } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  functional_location_id: z.uuid().nullable().optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  warranty_start_date: z.coerce.date().optional(),
  warranty_end_date: z.coerce.date().optional(),
  cost_center_id: z.uuid().nullable().optional(),
  criticality: z.number().int().min(1).max(5).optional(),
  status: z.enum(equipment_status).optional(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      functional_locations: true,
      cost_centers: true,
      plants: true,
      equipment_bom_headers: { include: { equipment_bom_items: { include: { materials: true } } } },
      task_lists: true,
      measuring_points: true,
    },
  });
  if (!equipment) throw notFound("Equipo no encontrado");
  return NextResponse.json(equipment);
});

export const PATCH = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { id } = await ctx.params;
  const body = updateSchema.parse(await req.json());
  const equipment = await prisma.equipment.update({ where: { id }, data: body });
  return NextResponse.json(equipment);
});
