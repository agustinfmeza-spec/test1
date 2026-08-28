import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { notification_type, priority_level } from "@/generated/prisma/enums";
import { badRequest } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z
  .object({
    code: z.string().min(1).max(40),
    notification_type: z.enum(notification_type).optional(),
    equipment_id: z.uuid().optional(),
    functional_location_id: z.uuid().optional(),
    description: z.string().min(1).max(255),
    long_text: z.string().optional(),
    required_start: z.coerce.date().optional(),
    required_end: z.coerce.date().optional(),
    priority: z.enum(priority_level).optional(),
    is_breakdown: z.boolean().optional(),
    malfunction_start: z.coerce.date().optional(),
  })
  .refine((v) => !!v.equipment_id || !!v.functional_location_id, {
    message: "Debe indicar equipment_id o functional_location_id",
  });

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const status = url.searchParams.get("status") ?? undefined;
  const equipmentId = url.searchParams.get("equipmentId") ?? undefined;

  const where: Prisma.notificationsWhereInput = {};
  if (query.search) where.description = { contains: query.search, mode: "insensitive" };
  if (status) where.status = status as Prisma.notificationsWhereInput["status"];
  if (equipmentId) where.equipment_id = equipmentId;

  const [data, total] = await Promise.all([
    prisma.notifications.findMany({
      where,
      orderBy: { reported_date: "desc" },
      skip: query.skip,
      take: query.take,
      include: { equipment: true, functional_locations: true, users: { select: { id: true, full_name: true } } },
    }),
    prisma.notifications.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  const session = await requireSession();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest("Datos inválidos", parsed.error.flatten());

  const notification = await prisma.notifications.create({
    data: { ...parsed.data, reported_by: session.userId },
  });
  return NextResponse.json(notification, { status: 201 });
});
