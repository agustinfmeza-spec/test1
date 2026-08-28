import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound, forbidden } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const order = await prisma.work_orders.findUnique({
    where: { id },
    include: {
      equipment: true,
      functional_locations: true,
      work_centers: true,
      cost_centers: true,
      task_lists: true,
      work_order_operations: {
        orderBy: { operation_number: "asc" },
        include: { work_centers: true, time_confirmations: true, work_order_components: { include: { materials: true, warehouses: true } } },
      },
      work_order_components: { include: { materials: true, warehouses: true } },
    },
  });
  if (!order) throw notFound("Orden de trabajo no encontrada");
  if (session.role === "TECHNICIAN" && order.work_center_responsible_id !== session.workCenterId) {
    throw forbidden("Esta orden no pertenece a su puesto de trabajo");
  }
  return NextResponse.json(order);
});
