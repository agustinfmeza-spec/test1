import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const belowReorderPoint = url.searchParams.get("belowReorderPoint") === "true";

  const where: Prisma.stockWhereInput = {};
  if (warehouseId) where.warehouse_id = warehouseId;
  if (query.search) {
    where.materials = {
      OR: [
        { description: { contains: query.search, mode: "insensitive" } },
        { code: { contains: query.search, mode: "insensitive" } },
      ],
    };
  }

  const rows = await prisma.stock.findMany({
    where,
    orderBy: { materials: { code: "asc" } },
    include: { materials: true, warehouses: true },
  });

  // quantity_on_hand <= reorder_point compara dos columnas de la misma fila:
  // Prisma no soporta esto en `where`, así que se filtra en memoria (aprovecha
  // el índice parcial idx_stock_below_reorder que respalda esta misma condición).
  const filtered = belowReorderPoint
    ? rows.filter((r) => Number(r.quantity_on_hand) <= Number(r.reorder_point))
    : rows;

  const page = filtered.slice(query.skip, query.skip + query.take);
  return NextResponse.json(paginated(page, filtered.length, query));
});
