import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { material_type } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(255),
  material_type: z.enum(material_type).optional(),
  material_group: z.string().max(50).optional(),
  unit_of_measure: z.string().min(1).max(10).optional(),
  unit_cost: z.number().nonnegative().optional(),
  criticality: z.number().int().min(1).max(5).optional(),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);

  const where: Prisma.materialsWhereInput = { active: true };
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
    ];
  }
  // El filtro "bajo punto de pedido" compara dos columnas de la misma fila de `stock`
  // (quantity_on_hand <= reorder_point); se expone en GET /api/stock?belowReorderPoint=true
  // en vez de aquí, porque Prisma no soporta comparaciones columna-a-columna en `where`.

  const [data, total] = await Promise.all([
    prisma.materials.findMany({
      where,
      orderBy: query.sortBy ? { [query.sortBy]: query.sortDir } : { code: "asc" },
      skip: query.skip,
      take: query.take,
    }),
    prisma.materials.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER", "WAREHOUSE");
  const body = createSchema.parse(await req.json());
  const material = await prisma.materials.create({ data: body });
  return NextResponse.json(material, { status: 201 });
});
