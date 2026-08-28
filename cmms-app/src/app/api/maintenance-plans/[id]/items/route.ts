import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { badRequest } from "@/lib/api-error";
import { priority_level, order_type } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z
  .object({
    equipment_id: z.uuid().optional(),
    functional_location_id: z.uuid().optional(),
    task_list_id: z.uuid(),
    description: z.string().max(255).optional(),
    priority: z.enum(priority_level).optional(),
    order_type: z.enum(order_type).optional(),
    planner_group: z.string().max(50).optional(),
    package_ids: z.array(z.uuid()).optional(),
  })
  .refine((v) => !!v.equipment_id || !!v.functional_location_id, {
    message: "Debe indicar equipment_id o functional_location_id",
  });

export const POST = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { id } = await ctx.params;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest("Datos inválidos", parsed.error.flatten());
  const { package_ids, ...data } = parsed.data;

  const item = await prisma.maintenance_items.create({
    data: {
      maintenance_plan_id: id,
      ...data,
      maintenance_item_packages: package_ids
        ? { create: package_ids.map((maintenance_package_id) => ({ maintenance_package_id })) }
        : undefined,
    },
    include: { equipment: true, task_lists: true, maintenance_item_packages: true },
  });

  return NextResponse.json(item, { status: 201 });
});
