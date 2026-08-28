"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { getMonthMatrix, toDateKey, WEEKDAY_LABELS, MONTH_LABELS } from "@/lib/calendar-utils";

interface MaintenanceCall {
  id: string;
  call_number: number;
  scheduled_date: string;
  status: string;
  work_order_id: string | null;
  maintenance_plans: {
    id: string;
    code: string;
    maintenance_items: { equipment: { description: string } | null; functional_locations: { description: string } | null }[];
  };
}

const CALL_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  SIMULATED: "neutral",
  SCHEDULED: "warning",
  CALLED: "info",
  COMPLETED: "success",
  SKIPPED: "danger",
};
const CALL_STATUS_LABELS: Record<string, string> = {
  SIMULATED: "Simulado",
  SCHEDULED: "A liberar",
  CALLED: "Liberado",
  COMPLETED: "Completado",
  SKIPPED: "Omitido",
};

export default function SchedulingPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calls, setCalls] = useState<MaintenanceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizonMonths, setHorizonMonths] = useState("6");
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<MaintenanceCall | null>(null);

  const weeks = useMemo(() => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const load = useCallback(() => {
    setLoading(true);
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    apiFetch<MaintenanceCall[]>(`/maintenance-calls?from=${toDateKey(from)}&to=${toDateKey(to)}`)
      .then(setCalls)
      .finally(() => setLoading(false));
  }, [cursor]);

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar de mes"; load() setea loading
    // sincrónicamente antes de la llamada async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const callsByDay = useMemo(() => {
    const map = new Map<string, MaintenanceCall[]>();
    for (const call of calls) {
      const key = toDateKey(new Date(call.scheduled_date));
      map.set(key, [...(map.get(key) ?? []), call]);
    }
    return map;
  }, [calls]);

  async function simulateAll() {
    setSimulating(true);
    setSimMessage(null);
    try {
      const res = await apiFetch<{ generatedCalls: number; dueNowCount: number; skippedPlans: { code: string; reason: string }[] }>(
        "/maintenance-plans/simulate",
        { method: "POST", body: JSON.stringify({ horizonMonths: Number(horizonMonths) }) },
      );
      let msg = `${res.generatedCalls} llamados proyectados, ${res.dueNowCount} listos para liberar.`;
      if (res.skippedPlans.length) msg += ` (${res.skippedPlans.length} planes omitidos, ver consola)`;
      if (res.skippedPlans.length) console.warn("Planes omitidos en la simulación:", res.skippedPlans);
      setSimMessage(msg);
      load();
    } catch (err) {
      setSimMessage(err instanceof Error ? err.message : "Error al simular");
    } finally {
      setSimulating(false);
    }
  }

  async function releaseCall(callId: string) {
    try {
      await apiFetch(`/maintenance-calls/${callId}/release`, { method: "POST" });
      setSelectedCall(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al liberar el llamado");
    }
  }

  const today = toDateKey(new Date());

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-foreground">Calendario de Simulación</h1>
        <div className="flex items-center gap-2 text-xs">
          <select value={horizonMonths} onChange={(e) => setHorizonMonths(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="6">Horizonte: 6 meses</option>
            <option value="12">Horizonte: 12 meses</option>
          </select>
          <button
            disabled={simulating}
            onClick={simulateAll}
            className="rounded bg-accent px-3 py-1.5 font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {simulating ? "Simulando..." : "Simular todos los planes"}
          </button>
        </div>
      </div>
      {simMessage && <p className="text-xs text-muted-fg">{simMessage}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
            ← Anterior
          </button>
          <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
            Hoy
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
            Siguiente →
          </button>
        </div>
        <h2 className="text-sm font-medium text-foreground">
          {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <span className="text-xs text-muted-fg">{loading ? "Cargando..." : `${calls.length} llamados`}</span>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="bg-surface-muted px-2 py-1 text-center font-medium text-muted-fg">
            {d}
          </div>
        ))}
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            const key = day ? toDateKey(day) : `empty-${wi}-${di}`;
            const dayCalls = day ? (callsByDay.get(key) ?? []) : [];
            const isToday = day && key === today;
            return (
              <div key={key} className={`min-h-[86px] bg-surface p-1 ${!day ? "bg-surface-muted/40" : ""}`}>
                {day && (
                  <>
                    <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-accent" : "text-muted-fg"}`}>{day.getDate()}</div>
                    <div className="flex flex-col gap-0.5">
                      {dayCalls.slice(0, 3).map((c) => {
                        const item = c.maintenance_plans.maintenance_items[0];
                        const label = item?.equipment?.description ?? item?.functional_locations?.description ?? c.maintenance_plans.code;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCall(c)}
                            className="truncate rounded border border-border bg-surface-muted px-1 py-0.5 text-left text-[10px] hover:border-accent"
                            title={`${c.maintenance_plans.code} — ${label}`}
                          >
                            {c.maintenance_plans.code}: {label}
                          </button>
                        );
                      })}
                      {dayCalls.length > 3 && <span className="text-[10px] text-muted-fg">+{dayCalls.length - 3} más</span>}
                    </div>
                  </>
                )}
              </div>
            );
          }),
        )}
      </div>

      {selectedCall && (
        <Modal title={`Llamado #${selectedCall.call_number} — ${selectedCall.maintenance_plans.code}`} onClose={() => setSelectedCall(null)}>
          <div className="flex flex-col gap-2 text-xs">
            <p>
              Fecha programada: <strong>{new Date(selectedCall.scheduled_date).toLocaleDateString("es-AR")}</strong>
            </p>
            <p className="flex items-center gap-2">
              Estado: <StatusBadge label={CALL_STATUS_LABELS[selectedCall.status] ?? selectedCall.status} tone={CALL_STATUS_TONE[selectedCall.status] ?? "neutral"} />
            </p>
            <p>
              <Link href={`/maintenance-plans/${selectedCall.maintenance_plans.id}`} className="text-accent hover:underline">
                Ver plan completo →
              </Link>
            </p>
            {selectedCall.work_order_id ? (
              <Link href={`/work-orders/${selectedCall.work_order_id}`} className="rounded bg-accent px-3 py-1.5 text-center text-accent-fg hover:bg-accent-hover">
                Ver orden de trabajo generada
              </Link>
            ) : (
              (selectedCall.status === "SCHEDULED" || selectedCall.status === "SIMULATED") && (
                <button onClick={() => releaseCall(selectedCall.id)} className="rounded bg-accent px-3 py-1.5 text-accent-fg hover:bg-accent-hover">
                  Liberar → generar Orden de Trabajo
                </button>
              )
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
