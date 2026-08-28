import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  material_group: z.string().max(50).optional(),
  unit_cost: z.number().nonnegative().optional(),
  criticality: z.number().int().min(1).max(5).optional(),
  active: z.boolean().optional(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const material = await prisma.materials.findUnique({
    where: { id },
    include: { stock: { include: { warehouses: true } } },
  });
  if (!material) throw notFound("Material no encontrado");
  return NextResponse.json(material);
});

export const PATCH = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER", "WAREHOUSE");
  const { id } = await ctx.params;
  const body = updateSchema.parse(await req.json());
  const material = await prisma.materials.update({ where: { id }, data: body });
  return NextResponse.json(material);
});
