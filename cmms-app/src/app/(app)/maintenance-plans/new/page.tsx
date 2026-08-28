"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

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
interface MeasuringPoint {
  id: string;
  code: string;
  description: string;
  unit_of_measure: string;
}

const TIME_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"];
const COUNTER_UNITS = ["HOUR_METER", "KM", "CYCLE_COUNT"];
const UNIT_LABELS: Record<string, string> = {
  DAY: "Días",
  WEEK: "Semanas",
  MONTH: "Meses",
  YEAR: "Años",
  HOUR_METER: "Horas de uso",
  KM: "Kilómetros",
  CYCLE_COUNT: "Ciclos",
};

export default function NewMaintenancePlanPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [planType, setPlanType] = useState<"TIME_BASED" | "COUNTER_BASED" | "MULTIPLE_COUNTER">("TIME_BASED");
  const [cycleValue, setCycleValue] = useState("30");
  const [cycleUnit, setCycleUnit] = useState("DAY");
  const [measuringPointId, setMeasuringPointId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [callHorizonPct, setCallHorizonPct] = useState("90");

  const [equipmentId, setEquipmentId] = useState("");
  const [taskListId, setTaskListId] = useState("");

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [measuringPoints, setMeasuringPoints] = useState<MeasuringPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCounterBased = planType === "COUNTER_BASED" || planType === "MULTIPLE_COUNTER";
  const availableUnits = useMemo(() => (isCounterBased ? COUNTER_UNITS : TIME_UNITS), [isCounterBased]);
  // Si el tipo de plan cambia y la unidad elegida ya no aplica, se deriva la
  // primera unidad válida en vez de sincronizarla con un efecto.
  const effectiveCycleUnit = availableUnits.includes(cycleUnit) ? cycleUnit : availableUnits[0];

  useEffect(() => {
    apiFetch<{ data: Equipment[] }>("/equipment?pageSize=200").then((res) => setEquipmentList(res.data));
    apiFetch<MeasuringPoint[]>("/measuring-points").then(setMeasuringPoints);
  }, []);

  useEffect(() => {
    if (!equipmentId) {
      // Reset al cambiar de equipo, antes del fetch async de sus hojas de ruta.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskLists([]);
      return;
    }
    apiFetch<{ data: TaskList[] }>(`/task-lists?equipmentId=${equipmentId}&pageSize=100`).then((res) => setTaskLists(res.data));
  }, [equipmentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const plan = await apiFetch<{ id: string }>("/maintenance-plans", {
        method: "POST",
        body: JSON.stringify({
          code,
          description,
          plan_type: planType,
          cycle_value: Number(cycleValue),
          cycle_unit: effectiveCycleUnit,
          measuring_point_id: isCounterBased ? measuringPointId : undefined,
          start_date: startDate,
          call_horizon_pct: Number(callHorizonPct),
        }),
      });
      await apiFetch(`/maintenance-plans/${plan.id}/items`, {
        method: "POST",
        body: JSON.stringify({ equipment_id: equipmentId, task_list_id: taskListId }),
      });
      router.push(`/maintenance-plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link href="/maintenance-plans" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>
      <h1 className="text-base font-semibold text-foreground">Nuevo Plan de Mantenimiento</h1>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded border border-border bg-surface p-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Código
            <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Tipo de plan
            <select value={planType} onChange={(e) => setPlanType(e.target.value as typeof planType)} className="rounded border border-border bg-surface px-2 py-1.5">
              <option value="TIME_BASED">Por tiempo</option>
              <option value="COUNTER_BASED">Por contador</option>
              <option value="MULTIPLE_COUNTER">Multi-contador</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Cada
            <input type="number" min="1" value={cycleValue} onChange={(e) => setCycleValue(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Unidad
            <select value={effectiveCycleUnit} onChange={(e) => setCycleUnit(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isCounterBased && (
          <label className="flex flex-col gap-1">
            Punto de medición (contador)
            <select value={measuringPointId} onChange={(e) => setMeasuringPointId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
              <option value="">Seleccionar...</option>
              {measuringPoints.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.code} — {mp.description} ({mp.unit_of_measure})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Fecha de inicio
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Horizonte de llamado (%)
            <input
              type="number"
              min="0"
              max="100"
              value={callHorizonPct}
              onChange={(e) => setCallHorizonPct(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1.5"
            />
          </label>
        </div>

        <hr className="border-border" />
        <p className="font-medium text-foreground">Objeto técnico a mantener (podrás agregar más luego)</p>

        <label className="flex flex-col gap-1">
          Equipo
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="">Seleccionar...</option>
            {equipmentList.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.code} — {eq.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Hoja de ruta
          <select
            value={taskListId}
            onChange={(e) => setTaskListId(e.target.value)}
            required
            disabled={!equipmentId}
            className="rounded border border-border bg-surface px-2 py-1.5 disabled:opacity-50"
          >
            <option value="">{equipmentId ? "Seleccionar..." : "Elegí un equipo primero"}</option>
            {taskLists.map((tl) => (
              <option key={tl.id} value={tl.id}>
                {tl.group_code} — {tl.description}
              </option>
            ))}
          </select>
          {equipmentId && taskLists.length === 0 && (
            <span className="text-muted-fg">
              Este equipo no tiene hojas de ruta.{" "}
              <Link href="/task-lists/new" className="text-accent hover:underline">
                Crear una
              </Link>
              .
            </span>
          )}
        </label>

        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 self-start rounded bg-accent px-4 py-1.5 text-accent-fg disabled:opacity-50">
          Crear plan
        </button>
      </form>
    </div>
  );
}
