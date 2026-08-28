import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { Prisma } from "@/generated/prisma/client";

/**
 * KPIs del dashboard, calculados sobre las vistas SQL del esquema
 * (vw_maintenance_backlog, vw_preventive_compliance, vw_mtbf_by_equipment,
 * vw_mttr_by_equipment, vw_equipment_availability). Prisma no introspecta
 * vistas por defecto, así que se consultan con SQL crudo tipado.
 */
export const GET = withHandler(async () => {
  await requireSession();

  const [backlog, compliance, availability] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM vw_maintenance_backlog`),
    prisma.$queryRaw<{ period: Date; completed: bigint; total_due: bigint; compliance_pct: string | null }[]>(
      Prisma.sql`SELECT period, completed, total_due, compliance_pct FROM vw_preventive_compliance ORDER BY period DESC LIMIT 12`,
    ),
    prisma.$queryRaw<
      { equipment_id: string; code: string; description: string; mtbf_hours: string | null; mttr_hours: string | null; availability_pct: string | null }[]
    >(Prisma.sql`
      SELECT e.id AS equipment_id, e.code, e.description,
             a.mtbf_hours, a.mttr_hours, a.availability_pct
      FROM vw_equipment_availability a
      JOIN equipment e ON e.id = a.equipment_id
      ORDER BY a.availability_pct ASC NULLS LAST
      LIMIT 20
    `),
  ]);

  const backlogTopOverdue = await prisma.work_orders.findMany({
    where: { status: { notIn: ["CLOSED", "CANCELLED", "TECHNICALLY_COMPLETED"] }, basic_end_date: { lt: new Date() } },
    orderBy: { basic_end_date: "asc" },
    take: 10,
    include: { equipment: true },
  });

  return NextResponse.json({
    backlog: {
      count: Number(backlog[0]?.count ?? 0),
      topOverdue: backlogTopOverdue,
    },
    preventiveCompliance: compliance.map((c) => ({
      period: c.period,
      completed: Number(c.completed),
      totalDue: Number(c.total_due),
      compliancePct: c.compliance_pct !== null ? Number(c.compliance_pct) : null,
    })),
    equipmentAvailability: availability.map((a) => ({
      equipmentId: a.equipment_id,
      code: a.code,
      description: a.description,
      mtbfHours: a.mtbf_hours !== null ? Number(a.mtbf_hours) : null,
      mttrHours: a.mttr_hours !== null ? Number(a.mttr_hours) : null,
      availabilityPct: a.availability_pct !== null ? Number(a.availability_pct) : null,
    })),
  });
});
