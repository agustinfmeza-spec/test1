import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { badRequest, notFound } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string; componentId: string }> };

const bodySchema = z.object({
  warehouse_id: z.uuid().optional(),
  quantity: z.number().positive(),
});

/**
 * Consumo de un repuesto reservado en la orden: crea el movimiento de stock
 * (GI_261_CONSUMPTION). El trigger SQL `trg_stock_movement` descuenta el stock
 * físico y actualiza el estado de la reserva (quantity_withdrawn/status).
 */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("TECHNICIAN", "PLANNER", "WAREHOUSE");
  const { id, componentId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const component = await prisma.work_order_components.findUnique({ where: { id: componentId } });
  if (!component || component.work_order_id !== id) throw notFound("Componente no encontrado en esta orden");

  const warehouseId = body.warehouse_id ?? component.warehouse_id;
  if (!warehouseId) throw badRequest("Debe indicar warehouse_id (el componente no tiene almacén asignado)");

  const movement = await prisma.stock_movements.create({
    data: {
      material_id: component.material_id,
      warehouse_id: warehouseId,
      movement_type: "GI_261_CONSUMPTION",
      quantity: body.quantity,
      work_order_id: id,
      performed_by: session.userId,
    },
  });

  const updatedComponent = await prisma.work_order_components.findUnique({
    where: { id: componentId },
    include: { materials: true },
  });

  return NextResponse.json({ movement, component: updatedComponent }, { status: 201 });
});
