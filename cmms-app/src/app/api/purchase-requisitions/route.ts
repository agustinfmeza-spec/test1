import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createSchema = z.object({
  code: z.string().min(1).max(40),
  work_order_id: z.uuid().optional(),
  items: z
    .array(
      z.object({
        material_id: z.uuid(),
        quantity: z.number().positive(),
        needed_by: z.coerce.date().optional(),
      }),
    )
    .min(1),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const requisitions = await prisma.purchase_requisitions.findMany({
    where: status ? { status: status as "REQUESTED" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED" } : undefined,
    orderBy: { requested_date: "desc" },
    include: { purchase_requisition_items: { include: { materials: true } } },
  });
  return NextResponse.json(requisitions);
});

export const POST = withHandler(async (req) => {
  const session = await requireRole("PLANNER", "WAREHOUSE");
  const { items, ...header } = createSchema.parse(await req.json());
  const requisition = await prisma.purchase_requisitions.create({
    data: { ...header, requested_by: session.userId, purchase_requisition_items: { create: items } },
    include: { purchase_requisition_items: { include: { materials: true } } },
  });
  return NextResponse.json(requisition, { status: 201 });
});
