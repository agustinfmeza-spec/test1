import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

const createPlantSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
});

export const GET = withHandler(async () => {
  await requireSession();
  const plants = await prisma.plants.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json(plants);
});

export const POST = withHandler(async (req) => {
  await requireRole("ADMIN");
  const body = createPlantSchema.parse(await req.json());
  const plant = await prisma.plants.create({ data: body });
  return NextResponse.json(plant, { status: 201 });
});
