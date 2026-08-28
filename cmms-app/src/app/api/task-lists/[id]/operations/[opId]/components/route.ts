import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

type Ctx = { params: Promise<{ id: string; opId: string }> };

const createSchema = z.object({
  material_id: z.uuid(),
  quantity: z.number().positive().default(1),
  unit_of_measure: z.string().max(10).optional(),
});

export const POST = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { opId } = await ctx.params;
  const body = createSchema.parse(await req.json());
  const component = await prisma.task_list_components.create({
    data: { task_list_operation_id: opId, ...body },
    include: { materials: true },
  });
  return NextResponse.json(component, { status: 201 });
});
