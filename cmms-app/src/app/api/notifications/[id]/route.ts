import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound, badRequest } from "@/lib/api-error";
import { notification_status } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(notification_status).optional(),
  malfunction_end: z.coerce.date().optional(),
  long_text: z.string().optional(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const notification = await prisma.notifications.findUnique({
    where: { id },
    include: { equipment: true, functional_locations: true, work_orders: true, users: { select: { id: true, full_name: true } } },
  });
  if (!notification) throw notFound("Aviso no encontrado");
  return NextResponse.json(notification);
});

export const PATCH = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER", "TECHNICIAN");
  const { id } = await ctx.params;
  const body = updateSchema.parse(await req.json());

  if (body.status === "CLOSED" || body.malfunction_end) {
    const current = await prisma.notifications.findUnique({ where: { id } });
    if (!current) throw notFound("Aviso no encontrado");
    if (body.status === "CLOSED" && current.is_breakdown && !current.malfunction_end && !body.malfunction_end) {
      throw badRequest("Debe indicar malfunction_end para cerrar un aviso de avería (se usa para calcular MTTR)");
    }
    if (body.malfunction_end && current.malfunction_start && body.malfunction_end < current.malfunction_start) {
      throw badRequest("malfunction_end no puede ser anterior a malfunction_start");
    }
  }

  const notification = await prisma.notifications.update({ where: { id }, data: body });
  return NextResponse.json(notification);
});
