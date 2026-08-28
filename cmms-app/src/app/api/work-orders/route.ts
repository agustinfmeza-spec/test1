import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { order_type, priority_level } from "@/generated/prisma/enums";
import { badRequest } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z
  .object({
    code: z.string().min(1).max(40),
    order_type: z.enum(order_type),
    equipment_id: z.uuid().optional(),
    functional_location_id: z.uuid().optional(),
    task_list_id: z.uuid().optional(),
    description: z.string().min(1).max(255),
    priority: z.enum(priority_level).optional(),
    work_center_responsible_id: z.uuid().optional(),
    cost_center_id: z.uuid().optional(),
    basic_start_date: z.coerce.date().optional(),
    basic_end_date: z.coerce.date().optional(),
  })
  .refine((v) => !!v.equipment_id || !!v.functional_location_id, {
    message: "Debe indicar equipment_id o functional_location_id",
  });

export const GET = withHandler(async (req) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const status = url.searchParams.get("status") ?? undefined;
  const equipmentId = url.searchParams.get("equipmentId") ?? undefined;
  const overdue = url.searchParams.get("overdue") === "true";

  const where: Prisma.work_ordersWhereInput = {};
  if (query.search) where.description = { contains: query.search, mode: "insensitive" };
  if (status) where.status = status as Prisma.work_ordersWhereInput["status"];
  if (equipmentId) where.equipment_id = equipmentId;
  if (overdue) {
    where.basic_end_date = { lt: new Date() };
    where.status = { notIn: ["CLOSED", "CANCELLED", "TECHNICALLY_COMPLETED"] };
  }
  // Un técnico solo ve las órdenes de su propio puesto de trabajo
  if (session.role === "TECHNICIAN") {
    where.work_center_responsible_id = session.workCenterId ?? "__none__";
  }

  const [data, total] = await Promise.all([
    prisma.work_orders.findMany({
      where,
      orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { basic_start_date: "asc" },
      skip: query.skip,
      take: query.take,
      include: { equipment: true, functional_locations: true, work_centers: true },
    }),
    prisma.work_orders.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  const session = await requireRole("PLANNER");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest("Datos inválidos", parsed.error.flatten());
  const order = await prisma.work_orders.create({ data: { ...parsed.data, created_by: session.userId } });
  return NextResponse.json(order, { status: 201 });
});
