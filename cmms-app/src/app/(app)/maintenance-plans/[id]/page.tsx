"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";

interface Equipment {
  id: string;
  code: string;
  description: string;
}
interface TaskList {
  id: string;
  group_code: string;
  description: string;
}

interface MaintenanceItem {
  id: string;
  priority: string;
  order_type: string;
  equipment: Equipment | null;
  functional_locations: { code: string; description: string } | null;
  task_lists: TaskList;
}

interface MaintenanceCall {
  id: string;
  call_number: number;
  scheduled_date: string;
  status: string;
}

interface PlanDetail {
  id: string;
  code: string;
  description: string;
  plan_type: string;
  cycle_value: number | null;
  cycle_unit: string | null;
  start_date: string;
  status: string;
  call_horizon_pct: string;
  maintenance_items: MaintenanceItem[];
  maintenance_calls: MaintenanceCall[];
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
  SCHEDULED: "Vencido / a liberar",
  CALLED: "Liberado (OT creada)",
  COMPLETED: "Completado",
  SKIPPED: "Omitido",
};

export default function MaintenancePlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [selectedTaskList, setSelectedTaskList] = useState("");
  const [simResult, setSimResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<PlanDetail>(`/maintenance-plans/${id}`).then(setPlan).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<{ data: Equipment[] }>("/equipment?pageSize=200").then((res) => setEquipmentList(res.data));
  }, [load]);

  useEffect(() => {
    if (!selectedEquipment) {
      // Reset al cambiar de equipo, antes del fetch async de sus hojas de ruta.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskLists([]);
      return;
    }
    apiFetch<{ data: TaskList[] }>(`/task-lists?equipmentId=${selectedEquipment}&pageSize=100`).then((res) => setTaskLists(res.data));
  }, [selectedEquipment]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance-plans/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ equipment_id: selectedEquipment, task_list_id: selectedTaskList }),
      });
      setSelectedEquipment("");
      setSelectedTaskList("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    setBusy(true);
    setSimResult(null);
    setError(null);
    try {
      const res = await apiFetch<{ generatedCalls: number; dueNowCount: number }>("/maintenance-plans/simulate", {
        method: "POST",
        body: JSON.stringify({ planIds: [id], horizonMonths: 12 }),
      });
      setSimResult(`Se proyectaron ${res.generatedCalls} llamados, ${res.dueNowCount} listos para liberar.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al simular");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!plan) return <p className="text-sm text-muted-fg">Cargando...</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/maintenance-plans" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded border border-border bg-surface p-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {plan.code} — {plan.description}
          </h1>
          <p className="mt-1 text-xs text-muted-fg">
            {plan.plan_type} · Ciclo: {plan.cycle_value} {plan.cycle_unit} · Inicio: {new Date(plan.start_date).toLocaleDateString("es-AR")} · Horizonte de
            llamado: {plan.call_horizon_pct}%
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button disabled={busy} onClick={simulate} className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50">
            Simular este plan
          </button>
          {simResult && <span className="text-[11px] text-muted-fg">{simResult}</span>}
        </div>
      </div>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Ítems de mantenimiento</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Objeto técnico</th>
              <th className="px-4 py-2 font-medium">Hoja de ruta</th>
              <th className="px-4 py-2 font-medium">Prioridad</th>
              <th className="px-4 py-2 font-medium">Tipo de orden</th>
            </tr>
          </thead>
          <tbody>
            {plan.maintenance_items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{item.equipment?.description ?? item.functional_locations?.description}</td>
                <td className="px-4 py-2">
                  <Link href={`/task-lists/${item.task_lists.id}`} className="text-accent hover:underline">
                    {item.task_lists.group_code}
                  </Link>
                </td>
                <td className="px-4 py-2">{item.priority}</td>
                <td className="px-4 py-2">{item.order_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addItem} className="flex flex-wrap items-end gap-2 border-t border-border p-3 text-xs">
          <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)} className="w-56 rounded border border-border bg-surface px-2 py-1.5">
            <option value="">+ Agregar equipo...</option>
            {equipmentList.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.code} — {eq.description}
              </option>
            ))}
          </select>
          <select
            value={selectedTaskList}
            onChange={(e) => setSelectedTaskList(e.target.value)}
            disabled={!selectedEquipment}
            className="w-56 rounded border border-border bg-surface px-2 py-1.5 disabled:opacity-50"
          >
            <option value="">Hoja de ruta...</option>
            {taskLists.map((tl) => (
              <option key={tl.id} value={tl.id}>
                {tl.group_code}
              </option>
            ))}
          </select>
          <button disabled={busy || !selectedTaskList} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-50">
            Agregar ítem
          </button>
          {error && <span className="text-danger">{error}</span>}
        </form>
      </section>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Próximos llamados</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Fecha programada</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {plan.maintenance_calls.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{c.call_number}</td>
                <td className="px-4 py-2">{new Date(c.scheduled_date).toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-2">
                  <StatusBadge label={CALL_STATUS_LABELS[c.status] ?? c.status} tone={CALL_STATUS_TONE[c.status] ?? "neutral"} />
                </td>
              </tr>
            ))}
            {plan.maintenance_calls.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-fg">
                  Todavía no se simuló este plan.{" "}
                  <Link href="/scheduling" className="text-accent hover:underline">
                    Ver calendario
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
