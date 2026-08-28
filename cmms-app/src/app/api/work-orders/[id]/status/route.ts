import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound, conflict, forbidden } from "@/lib/api-error";
import { order_status } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ status: z.enum(order_status) });

// Transiciones válidas del ciclo de vida de la Orden de Trabajo (equivalente a SAP: CRTD -> REL -> ... -> CLSD)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROCESS", "COMPLETED", "CANCELLED"],
  IN_PROCESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["TECHNICALLY_COMPLETED"],
  TECHNICALLY_COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

// Solo Planificador/Admin pueden liberar, cerrar formalmente o cancelar
const PLANNER_ONLY_TARGETS = new Set(["RELEASED", "TECHNICALLY_COMPLETED", "CLOSED", "CANCELLED"]);

export const PATCH = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("PLANNER", "TECHNICIAN");
  const { id } = await ctx.params;
  const { status } = bodySchema.parse(await req.json());

  if (PLANNER_ONLY_TARGETS.has(status) && session.role === "TECHNICIAN") {
    throw forbidden("Solo un Planificador puede realizar esta transición de estado");
  }

  const order = await prisma.work_orders.findUnique({ where: { id } });
  if (!order) throw notFound("Orden de trabajo no encontrada");

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw conflict(`No se puede pasar de ${order.status} a ${status}`);
  }

  const now = new Date();
  const timestampField: Record<string, object> = {
    RELEASED: { released_at: now },
    IN_PROCESS: { actual_start_date: order.actual_start_date ?? now },
    COMPLETED: { actual_end_date: now },
    TECHNICALLY_COMPLETED: { technically_completed_at: now },
    CLOSED: { closed_at: now },
    CANCELLED: {},
  };

  const updated = await prisma.work_orders.update({
    where: { id },
    data: { status, ...timestampField[status] },
  });

  // Si la orden proviene de un plan preventivo, al completarla se marca el llamado
  // como COMPLETED — insumo del KPI "Cumplimiento del Plan Preventivo".
  if (status === "COMPLETED" && order.origin_maintenance_call_id) {
    await prisma.maintenance_calls.update({
      where: { id: order.origin_maintenance_call_id },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json(updated);
});
