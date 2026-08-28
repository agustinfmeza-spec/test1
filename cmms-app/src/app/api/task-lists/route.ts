import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { task_list_type, control_key } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const componentSchema = z.object({
  material_id: z.uuid(),
  quantity: z.number().positive().default(1),
  unit_of_measure: z.string().max(10).optional(),
});

const operationSchema = z.object({
  operation_number: z.number().int().positive(),
  description: z.string().min(1).max(255),
  work_center_id: z.uuid(),
  control_key: z.enum(control_key).optional(),
  duration_value: z.number().positive(),
  duration_unit: z.string().max(10).optional(),
  number_of_workers: z.number().int().positive().optional(),
  components: z.array(componentSchema).optional(),
});

const createSchema = z
  .object({
    group_code: z.string().min(1).max(40),
    description: z.string().min(1).max(255),
    task_list_type: z.enum(task_list_type),
    equipment_id: z.uuid().optional(),
    functional_location_id: z.uuid().optional(),
    operations: z.array(operationSchema).optional(),
  })
  .refine((v) => v.task_list_type !== "EQUIPMENT" || !!v.equipment_id, {
    message: "equipment_id es obligatorio para hojas de ruta de tipo EQUIPMENT",
    path: ["equipment_id"],
  })
  .refine((v) => v.task_list_type !== "FUNCTIONAL_LOCATION" || !!v.functional_location_id, {
    message: "functional_location_id es obligatorio para hojas de ruta de tipo FUNCTIONAL_LOCATION",
    path: ["functional_location_id"],
  });

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const equipmentId = url.searchParams.get("equipmentId") ?? undefined;

  const where: Prisma.task_listsWhereInput = {};
  if (query.search) where.description = { contains: query.search, mode: "insensitive" };
  if (equipmentId) where.equipment_id = equipmentId;

  const [data, total] = await Promise.all([
    prisma.task_lists.findMany({
      where,
      orderBy: { group_code: "asc" },
      skip: query.skip,
      take: query.take,
      include: { _count: { select: { task_list_operations: true } } },
    }),
    prisma.task_lists.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const body = createSchema.parse(await req.json());
  const { operations, ...header } = body;

  const taskList = await prisma.task_lists.create({
    data: {
      ...header,
      task_list_operations: operations
        ? {
            create: operations.map(({ components, ...op }) => ({
              ...op,
              task_list_components: components ? { create: components } : undefined,
            })),
          }
        : undefined,
    },
    include: { task_list_operations: { include: { task_list_components: true } } },
  });

  return NextResponse.json(taskList, { status: 201 });
});
