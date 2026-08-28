import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { control_key } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  operation_number: z.number().int().positive(),
  description: z.string().min(1).max(255),
  work_center_id: z.uuid(),
  control_key: z.enum(control_key).optional(),
  duration_planned: z.number().positive(),
  number_of_workers: z.number().int().positive().optional(),
});

/** Agrega una operación manual a una orden (típico en correctivos sin hoja de ruta). */
export const POST = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { id } = await ctx.params;
  const body = createSchema.parse(await req.json());
  const operation = await prisma.work_order_operations.create({ data: { work_order_id: id, ...body } });
  return NextResponse.json(operation, { status: 201 });
});
