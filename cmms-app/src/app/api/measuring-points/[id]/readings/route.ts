import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  reading_date: z.coerce.date(),
  counter_reading: z.number().nonnegative(),
});

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const readings = await prisma.measurement_documents.findMany({
    where: { measuring_point_id: id },
    orderBy: { reading_date: "desc" },
  });
  return NextResponse.json(readings);
});

export const POST = withHandler<Ctx>(async (req, ctx) => {
  const session = await requireRole("PLANNER", "TECHNICIAN");
  const { id } = await ctx.params;
  const body = createSchema.parse(await req.json());

  const previous = await prisma.measurement_documents.findFirst({
    where: { measuring_point_id: id },
    orderBy: { reading_date: "desc" },
  });

  const reading = await prisma.measurement_documents.create({
    data: {
      measuring_point_id: id,
      reading_date: body.reading_date,
      counter_reading: body.counter_reading,
      reading_difference: previous ? body.counter_reading - Number(previous.counter_reading) : null,
      recorded_by: session.userId,
    },
  });
  return NextResponse.json(reading, { status: 201 });
});
