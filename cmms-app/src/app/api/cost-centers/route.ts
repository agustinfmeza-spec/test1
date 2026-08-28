import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createSchema = z.object({
  plant_id: z.uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
});

export const GET = withHandler(async (req) => {
  await requireSession();
  const plantId = new URL(req.url).searchParams.get("plantId") ?? undefined;
  const costCenters = await prisma.cost_centers.findMany({
    where: plantId ? { plant_id: plantId } : undefined,
    orderBy: { code: "asc" },
  });
  return NextResponse.json(costCenters);
});

export const POST = withHandler(async (req) => {
  await requireRole("ADMIN");
  const body = createSchema.parse(await req.json());
  const costCenter = await prisma.cost_centers.create({ data: body });
  return NextResponse.json(costCenter, { status: 201 });
});
