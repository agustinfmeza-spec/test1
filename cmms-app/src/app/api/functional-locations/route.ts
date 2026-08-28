import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { fl_status } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  plant_id: z.uuid(),
  code: z.string().min(1).max(60),
  description: z.string().min(1).max(255),
  parent_id: z.uuid().optional(),
  category: z.string().max(30).optional(),
  cost_center_id: z.uuid().optional(),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const parentId = url.searchParams.get("parentId");
  const flat = url.searchParams.get("flat") === "true";

  const where: Prisma.functional_locationsWhereInput = {};
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
    ];
  }
  // Modo árbol: sin flat=true, filtra por el padre indicado (o raíces si no se pasa parentId)
  if (!flat) {
    where.parent_id = parentId ?? null;
  }

  const [data, total] = await Promise.all([
    prisma.functional_locations.findMany({
      where,
      orderBy: { code: "asc" },
      skip: query.skip,
      take: query.take,
      include: { _count: { select: { other_functional_locations: true, equipment: true } } },
    }),
    prisma.functional_locations.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const body = createSchema.parse(await req.json());
  const location = await prisma.functional_locations.create({
    data: { ...body, status: fl_status.ACTIVE },
  });
  return NextResponse.json(location, { status: 201 });
});
