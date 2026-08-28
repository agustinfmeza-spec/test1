import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

type Ctx = { params: Promise<{ id: string }> };

const addItemSchema = z.object({
  material_id: z.uuid(),
  quantity: z.number().positive().default(1),
  unit_of_measure: z.string().max(10).optional(),
  item_category: z.enum(["RECOMMENDED", "MANDATORY"]).optional(),
  notes: z.string().max(255).optional(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const items = await prisma.equipment_bom_items.findMany({
    where: { equipment_bom_headers: { equipment_id: id } },
    include: { materials: true },
  });
  return NextResponse.json(items);
});

export const POST = withHandler<Ctx>(async (req, ctx) => {
  await requireRole("PLANNER");
  const { id } = await ctx.params;
  const body = addItemSchema.parse(await req.json());

  const header = await prisma.equipment_bom_headers.upsert({
    where: { equipment_id_bom_usage: { equipment_id: id, bom_usage: "MAINTENANCE" } },
    update: {},
    create: { equipment_id: id, bom_usage: "MAINTENANCE" },
  });

  const item = await prisma.equipment_bom_items.create({
    data: { bom_header_id: header.id, ...body },
    include: { materials: true },
  });
  return NextResponse.json(item, { status: 201 });
});
