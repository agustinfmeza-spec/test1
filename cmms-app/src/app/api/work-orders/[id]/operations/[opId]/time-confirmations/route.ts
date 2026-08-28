import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

type Ctx = { params: Promise<{ id: string; opId: string }> };

const createSchema = z.object({
  work_date: z.coerce.date(),
  actual_hours: z.number().positive(),
  is_final_confirmation: z.boolean().optional(),
  notes: z.string().max(255).optional(),
});

/** Notificación de horas del técnico. El trigger SQL acumula duration_actual en la operación. */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("TECHNICIAN", "PLANNER");
  const { opId } = await ctx.params;
  const body = createSchema.parse(await req.json());

  const confirmation = await prisma.time_confirmations.create({
    data: { work_order_operation_id: opId, technician_id: session.userId, ...body },
  });
  return NextResponse.json(confirmation, { status: 201 });
});
