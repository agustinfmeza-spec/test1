"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { StatCard } from "@/components/stat-card";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";
import { StatusBadge } from "@/components/status-badge";

interface OverdueOrder {
  id: string;
  code: string;
  description: string;
  status: string;
  priority: string;
  basic_end_date: string | null;
  equipment: { code: string; description: string } | null;
}

interface CompliancePoint {
  period: string;
  completed: number;
  totalDue: number;
  compliancePct: number | null;
}

interface AvailabilityRow {
  equipmentId: string;
  code: string;
  description: string;
  mtbfHours: number | null;
  mttrHours: number | null;
  availabilityPct: number | null;
}

interface DashboardKpis {
  backlog: { count: number; topOverdue: OverdueOrder[] };
  preventiveCompliance: CompliancePoint[];
  equipmentAvailability: AvailabilityRow[];
}

function daysOverdue(dateStr: string | null) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardKpis>("/dashboard/kpis").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-muted-fg">Cargando...</p>;

  const latestCompliance = data.preventiveCompliance[0];
  const availabilities = data.equipmentAvailability.map((a) => a.availabilityPct).filter((v): v is number => v !== null);
  const avgAvailability = availabilities.length ? availabilities.reduce((a, b) => a + b, 0) / availabilities.length : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-base font-semibold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Backlog de Mantenimiento"
          value={String(data.backlog.count)}
          hint="OTs vencidas y no cerradas"
          tone={data.backlog.count > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Cumplimiento Preventivo"
          value={latestCompliance?.compliancePct != null ? `${latestCompliance.compliancePct}%` : "—"}
          hint={latestCompliance ? `${latestCompliance.completed}/${latestCompliance.totalDue} llamados` : "Sin llamados vencidos aún"}
          tone={latestCompliance?.compliancePct != null && latestCompliance.compliancePct < 80 ? "warning" : "success"}
        />
        <StatCard
          label="Disponibilidad Promedio"
          value={avgAvailability != null ? `${avgAvailability.toFixed(1)}%` : "—"}
          hint="Promedio sobre equipos con historial de fallas"
        />
        <StatCard label="Equipos monitoreados" value={String(data.equipmentAvailability.length)} hint="Con al menos una falla registrada" />
      </div>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">OTs más vencidas</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Equipo</th>
              <th className="px-4 py-2 font-medium">Prioridad</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Días vencida</th>
            </tr>
          </thead>
          <tbody>
            {data.backlog.topOverdue.map((wo) => (
              <tr key={wo.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/work-orders/${wo.id}`} className="font-medium text-accent hover:underline">
                    {wo.code}
                  </Link>
                </td>
                <td className="px-4 py-2">{wo.description}</td>
                <td className="px-4 py-2">{wo.equipment?.description ?? "—"}</td>
                <td className="px-4 py-2">
                  <StatusBadge label={PRIORITY_LABELS[wo.priority] ?? wo.priority} tone={PRIORITY_TONE[wo.priority] ?? "neutral"} />
                </td>
                <td className="px-4 py-2">
                  <StatusBadge label={ORDER_STATUS_LABELS[wo.status] ?? wo.status} tone={ORDER_STATUS_TONE[wo.status] ?? "neutral"} />
                </td>
                <td className="px-4 py-2 text-danger">{daysOverdue(wo.basic_end_date)}</td>
              </tr>
            ))}
            {data.backlog.topOverdue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-fg">
                  Sin órdenes vencidas. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Disponibilidad por equipo (MTBF / MTTR)</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Equipo</th>
              <th className="px-4 py-2 font-medium">MTBF (hs)</th>
              <th className="px-4 py-2 font-medium">MTTR (hs)</th>
              <th className="px-4 py-2 font-medium">Disponibilidad</th>
            </tr>
          </thead>
          <tbody>
            {data.equipmentAvailability.map((a) => (
              <tr key={a.equipmentId} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{a.description} ({a.code})</td>
                <td className="px-4 py-2">{a.mtbfHours?.toFixed(1) ?? "—"}</td>
                <td className="px-4 py-2">{a.mttrHours?.toFixed(1) ?? "—"}</td>
                <td className="px-4 py-2 font-medium">{a.availabilityPct != null ? `${a.availabilityPct}%` : "—"}</td>
              </tr>
            ))}
            {data.equipmentAvailability.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-fg">
                  Aún no hay historial de fallas suficiente para calcular MTBF/MTTR.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
