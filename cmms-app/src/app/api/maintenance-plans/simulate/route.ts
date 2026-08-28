import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { runAndPersistSimulation } from "@/lib/plan-engine-adapter";

const bodySchema = z.object({
  planIds: z.array(z.uuid()).optional(),
  horizonMonths: z.number().int().min(1).max(36).optional(),
});

export const POST = withHandler(async (req) => {
  await requireRole("PLANNER");
  const raw = await req.text();
  const body = bodySchema.parse(raw ? JSON.parse(raw) : {});

  const result = await runAndPersistSimulation({
    planIds: body.planIds,
    horizonMonths: body.horizonMonths ?? 12,
  });

  return NextResponse.json({
    generatedCalls: result.calendar.length,
    dueNowCount: result.dueNow.length,
    skippedPlans: result.skippedPlans,
    calendar: result.calendar,
  });
});
