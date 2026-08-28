import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  work_order_operation_id: z.uuid().optional(),
  material_id: z.uuid(),
  warehouse_id: z.uuid().optional(),
  quantity_required: z.number().positive(),
  unit_of_measure: z.string().max(10).optional(),
});

/** Reserva manual de un repuesto en la orden (además de los heredados de la hoja de ruta). */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER", "WAREHOUSE");
  const { id } = await ctx.params;
  const body = createSchema.parse(await req.json());
  const component = await prisma.work_order_components.create({
    data: { work_order_id: id, ...body },
    include: { materials: true },
  });
  return NextResponse.json(component, { status: 201 });
});
