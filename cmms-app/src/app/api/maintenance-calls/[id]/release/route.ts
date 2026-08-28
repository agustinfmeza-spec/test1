import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { conflict, notFound, badRequest } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Convierte un llamado simulado/programado en una o más Órdenes de Trabajo reales
 * (una por cada `maintenance_item` del plan). El trigger SQL `trg_wo_from_task_list`
 * copia automáticamente operaciones y componentes desde la hoja de ruta de cada ítem.
 */
export const POST = withHandler<Ctx>(async (_req, ctx) => {
  const session = await requireRole("PLANNER");
  const { id } = await ctx.params;

  const call = await prisma.maintenance_calls.findUnique({
    where: { id },
    include: { maintenance_plans: { include: { maintenance_items: true } } },
  });
  if (!call) throw notFound("Llamado de mantenimiento no encontrado");
  if (call.status !== "SIMULATED" && call.status !== "SCHEDULED") {
    throw conflict(`El llamado ya está en estado ${call.status} y no puede volver a liberarse`);
  }

  const plan = call.maintenance_plans;
  const items = plan.maintenance_items;
  if (items.length === 0) {
    throw badRequest("El plan no tiene ítems de mantenimiento (equipo/hoja de ruta) configurados");
  }

  const basicEndDate = new Date(call.scheduled_date);
  basicEndDate.setDate(basicEndDate.getDate() + plan.planned_completion_offset_days);

  const result = await prisma.$transaction(async (tx) => {
    const createdOrders = [];
    for (const [index, item] of items.entries()) {
      const code = `${plan.code}-C${call.call_number}${items.length > 1 ? `-${index + 1}` : ""}`;
      const order = await tx.work_orders.create({
        data: {
          code,
          order_type: item.order_type,
          origin_maintenance_call_id: call.id,
          equipment_id: item.equipment_id,
          functional_location_id: item.functional_location_id,
          task_list_id: item.task_list_id,
          description: item.description ?? `Generada por plan ${plan.code} - llamado ${call.call_number}`,
          priority: item.priority,
          planner_group: item.planner_group,
          basic_start_date: call.scheduled_date,
          basic_end_date: basicEndDate,
          created_by: session.userId,
        },
      });
      createdOrders.push(order);
    }

    const updatedCall = await tx.maintenance_calls.update({
      where: { id: call.id },
      data: { status: "CALLED", work_order_id: createdOrders[0].id, generated_at: new Date() },
    });

    await tx.maintenance_plans.update({
      where: { id: plan.id },
      data: {
        last_call_date: call.scheduled_date,
        last_call_counter: call.due_counter_reading ?? undefined,
      },
    });

    return { updatedCall, createdOrders };
  });

  return NextResponse.json(result, { status: 201 });
});
