import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound, conflict } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  task_list_id: z.uuid().optional(),
  work_center_responsible_id: z.uuid().optional(),
  basic_start_date: z.coerce.date().optional(),
  basic_end_date: z.coerce.date().optional(),
});

/** Crea una Orden de Trabajo CORRECTIVA a partir de un Aviso, y lo pasa a estado IN_PROCESS. */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("PLANNER");
  const { id } = await ctx.params;
  const body = bodySchema.parse(await req.json().catch(() => ({})));

  const notification = await prisma.notifications.findUnique({ where: { id } });
  if (!notification) throw notFound("Aviso no encontrado");
  if (notification.status === "CLOSED" || notification.status === "COMPLETED") {
    throw conflict("El aviso ya está completado/cerrado");
  }

  const [order] = await prisma.$transaction([
    prisma.work_orders.create({
      data: {
        code: `OT-${notification.code}`,
        order_type: "CORRECTIVE",
        origin_notification_id: notification.id,
        equipment_id: notification.equipment_id,
        functional_location_id: notification.functional_location_id,
        task_list_id: body.task_list_id,
        description: notification.description,
        priority: notification.priority,
        work_center_responsible_id: body.work_center_responsible_id,
        basic_start_date: body.basic_start_date,
        basic_end_date: body.basic_end_date,
        created_by: session.userId,
      },
    }),
    prisma.notifications.update({ where: { id }, data: { status: "IN_PROCESS" } }),
  ]);

  return NextResponse.json(order, { status: 201 });
});
