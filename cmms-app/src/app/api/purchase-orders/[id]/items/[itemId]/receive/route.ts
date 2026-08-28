import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const bodySchema = z.object({
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional(),
});

/** Ingreso de mercadería por compra: crea el movimiento GR_101_PURCHASE y suma quantity_received. */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("WAREHOUSE", "PLANNER");
  const { id, itemId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const item = await prisma.purchase_order_items.findUnique({ where: { id: itemId } });
  if (!item || item.purchase_order_id !== id) throw notFound("Ítem de orden de compra no encontrado");

  const unitCost = body.unit_cost ?? (item.unit_cost ? Number(item.unit_cost) : undefined);

  const [movement, updatedItem] = await prisma.$transaction([
    prisma.stock_movements.create({
      data: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        movement_type: "GR_101_PURCHASE",
        quantity: body.quantity,
        unit_cost: unitCost,
        total_cost: unitCost !== undefined ? unitCost * body.quantity : undefined,
        purchase_order_item_id: item.id,
        performed_by: session.userId,
      },
    }),
    prisma.purchase_order_items.update({
      where: { id: itemId },
      data: { quantity_received: { increment: body.quantity } },
    }),
  ]);

  const allItems = await prisma.purchase_order_items.findMany({ where: { purchase_order_id: id } });
  const fullyReceived = allItems.every((i) => Number(i.quantity_received) >= Number(i.quantity_ordered));
  if (fullyReceived) {
    await prisma.purchase_orders.update({ where: { id }, data: { status: "RECEIVED" } });
  }

  return NextResponse.json({ movement, item: updatedItem }, { status: 201 });
});
