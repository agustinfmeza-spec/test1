import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createSchema = z.object({
  plant_id: z.uuid(),
  code: z.string().min(1).max(20),
  description: z.string().min(1).max(150),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const plantId = new URL(req.url).searchParams.get("plantId") ?? undefined;
  const warehouses = await prisma.warehouses.findMany({
    where: plantId ? { plant_id: plantId } : undefined,
    orderBy: { code: "asc" },
  });
  return NextResponse.json(warehouses);
});

export const POST = withHandler(async (req) => {
  await requireRole("ADMIN", "PLANNER", "WAREHOUSE");
  const body = createSchema.parse(await req.json());
  const warehouse = await prisma.warehouses.create({ data: body });
  return NextResponse.json(warehouse, { status: 201 });
});
