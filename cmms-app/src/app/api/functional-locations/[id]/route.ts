import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";
import { fl_status } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  category: z.string().max(30).optional(),
  parent_id: z.uuid().nullable().optional(),
  cost_center_id: z.uuid().nullable().optional(),
  status: z.enum(fl_status).optional(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const location = await prisma.functional_locations.findUnique({
    where: { id },
    include: {
      functional_locations: true, // padre
      other_functional_locations: { orderBy: { code: "asc" } }, // hijos directos
      equipment: { orderBy: { code: "asc" } },
    },
  });
  if (!location) throw notFound("Ubicación técnica no encontrada");
  return NextResponse.json(location);
});

export const PATCH = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { id } = await ctx.params;
  const body = updateSchema.parse(await req.json());
  const location = await prisma.functional_locations.update({ where: { id }, data: body });
  return NextResponse.json(location);
});
