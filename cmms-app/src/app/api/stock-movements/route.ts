import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, type Role } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { parseListQuery, paginated } from "@/lib/list-query";
import { movement_type } from "@/generated/prisma/enums";
import { forbidden } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  material_id: z.uuid(),
  warehouse_id: z.uuid(),
  movement_type: z.enum(movement_type),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional(),
  work_order_id: z.uuid().optional(),
  purchase_order_item_id: z.uuid().optional(),
  notes: z.string().max(255).optional(),
});

// Solo depósito/planificación puede hacer ingresos, ajustes o transferencias;
// el consumo/devolución en una OT también puede hacerse aquí (además del
// endpoint dedicado en work-orders) y ahí sí se permite a un Técnico.
const WAREHOUSE_ONLY_TYPES = new Set(["GR_101_PURCHASE", "TR_311_TRANSFER", "ADJ_701_POSITIVE", "ADJ_702_NEGATIVE"]);

export const GET = withHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const query = parseListQuery(url);
  const materialId = url.searchParams.get("materialId") ?? undefined;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

  const where: Prisma.stock_movementsWhereInput = {};
  if (materialId) where.material_id = materialId;
  if (warehouseId) where.warehouse_id = warehouseId;

  const [data, total] = await Promise.all([
    prisma.stock_movements.findMany({
      where,
      orderBy: { movement_date: "desc" },
      skip: query.skip,
      take: query.take,
      include: { materials: true, warehouses: true },
    }),
    prisma.stock_movements.count({ where }),
  ]);

  return NextResponse.json(paginated(data, total, query));
});

export const POST = withHandler(async (req) => {
  const session = await requireRole("WAREHOUSE", "PLANNER", "TECHNICIAN");
  const body = createSchema.parse(await req.json());

  if (WAREHOUSE_ONLY_TYPES.has(body.movement_type) && !["WAREHOUSE", "PLANNER", "ADMIN"].includes(session.role as Role)) {
    throw forbidden("Este tipo de movimiento requiere rol de Depósito o Planificador");
  }

  const totalCost = body.unit_cost !== undefined ? body.unit_cost * body.quantity : undefined;
  const movement = await prisma.stock_movements.create({
    data: { ...body, total_cost: totalCost, performed_by: session.userId },
    include: { materials: true, warehouses: true },
  });

  return NextResponse.json(movement, { status: 201 });
});
