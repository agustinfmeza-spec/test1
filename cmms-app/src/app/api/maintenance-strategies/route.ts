import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { cycle_unit } from "@/generated/prisma/enums";

const createSchema = z.object({
  code: z.string().min(1).max(20),
  description: z.string().min(1).max(150),
  packages: z
    .array(
      z.object({
        package_key: z.string().min(1).max(10),
        cycle_value: z.number().int().positive(),
        cycle_unit: z.enum(cycle_unit),
      }),
    )
    .min(1),
});

export const GET = withHandler(async () => {
  await requireSession();
  const strategies = await prisma.maintenance_strategies.findMany({
    include: { maintenance_packages: true },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(strategies);
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const { packages, ...header } = createSchema.parse(await req.json());
  const strategy = await prisma.maintenance_strategies.create({
    data: { ...header, maintenance_packages: { create: packages } },
    include: { maintenance_packages: true },
  });
  return NextResponse.json(strategy, { status: 201 });
});
