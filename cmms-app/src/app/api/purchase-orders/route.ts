import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createSchema = z.object({
  code: z.string().min(1).max(40),
  supplier_name: z.string().min(1).max(150),
  expected_delivery_date: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        material_id: z.uuid(),
        warehouse_id: z.uuid(),
        purchase_requisition_item_id: z.uuid().optional(),
        quantity_ordered: z.number().positive(),
        unit_cost: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const orders = await prisma.purchase_orders.findMany({
    where: status ? { status: status as "REQUESTED" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED" } : undefined,
    orderBy: { order_date: "desc" },
    include: { purchase_order_items: { include: { materials: true, warehouses: true } } },
  });
  return NextResponse.json(orders);
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER", "WAREHOUSE");
  const { items, ...header } = createSchema.parse(await req.json());
  const order = await prisma.purchase_orders.create({
    data: { ...header, purchase_order_items: { create: items } },
    include: { purchase_order_items: { include: { materials: true, warehouses: true } } },
  });
  return NextResponse.json(order, { status: 201 });
});
