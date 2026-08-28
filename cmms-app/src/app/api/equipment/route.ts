import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { equipment_status } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  plant_id: z.uuid(),
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(255),
  functional_location_id: z.uuid().optional(),
  parent_equipment_id: z.uuid().optional(),
  equipment_category: z.string().max(30).optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  manufacture_date: z.coerce.date().optional(),
  acquisition_date: z.coerce.date().optional(),
  acquisition_value: z.number().nonnegative().optional(),
  warranty_start_date: z.coerce.date().optional(),
  warranty_end_date: z.coerce.date().optional(),
  cost_center_id: z.uuid().optional(),
  criticality: z.number().int().min(1).max(5).optional(),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const functionalLocationId = url.searchParams.get("functionalLocationId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const where: Prisma.equipmentWhereInput = {};
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { serial_number: { contains: query.search, mode: "insensitive" } },
      { manufacturer: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (functionalLocationId) where.functional_location_id = functionalLocationId;
  if (status) where.status = status as Prisma.equipmentWhereInput["status"];

  const [data, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { code: "asc" },
      skip: query.skip,
      take: query.take,
      include: { functional_locations: true, cost_centers: true },
    }),
    prisma.equipment.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const body = createSchema.parse(await req.json());
  const equipment = await prisma.equipment.create({ data: { ...body, status: equipment_status.ACTIVE } });
  return NextResponse.json(equipment, { status: 201 });
});
