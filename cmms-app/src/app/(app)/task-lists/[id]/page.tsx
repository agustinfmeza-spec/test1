"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Material {
  id: string;
  code: string;
  description: string;
}
interface WorkCenter {
  id: string;
  code: string;
  name: string;
}

interface Component {
  id: string;
  quantity: string;
  unit_of_measure: string;
  materials: Material;
}

interface Operation {
  id: string;
  operation_number: number;
  description: string;
  duration_value: string;
  duration_unit: string;
  work_centers: WorkCenter;
  task_list_components: Component[];
}

interface TaskListDetail {
  id: string;
  group_code: string;
  description: string;
  task_list_type: string;
  equipment: { code: string; description: string } | null;
  functional_locations: { code: string; description: string } | null;
  task_list_operations: Operation[];
}

export default function TaskListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [taskList, setTaskList] = useState<TaskListDetail | null>(null);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<TaskListDetail>(`/task-lists/${id}`).then(setTaskList).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<WorkCenter[]>("/work-centers").then(setWorkCenters);
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
  }, [load]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!taskList) return <p className="text-sm text-muted-fg">Cargando...</p>;

  const nextOperationNumber = Math.max(0, ...taskList.task_list_operations.map((o) => o.operation_number)) + 10;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/task-lists" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>

      <div className="rounded border border-border bg-surface p-4">
        <h1 className="text-base font-semibold text-foreground">
          {taskList.group_code} — {taskList.description}
        </h1>
        <p className="mt-1 text-xs text-muted-fg">
          Objeto técnico: {taskList.equipment?.description ?? taskList.functional_locations?.description ?? "—"}
        </p>
      </div>

      {taskList.task_list_operations.map((op) => (
        <section key={op.id} className="rounded border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">
            {op.operation_number} — {op.description}{" "}
            <span className="font-normal text-muted-fg">
              ({op.work_centers.name}, {op.duration_value} {op.duration_unit.toLowerCase()})
            </span>
          </h2>
          <ul className="p-3 text-xs">
            {op.task_list_components.map((c) => (
              <li key={c.id}>
                {c.materials.code} — {c.materials.description}: {c.quantity} {c.unit_of_measure}
              </li>
            ))}
            {op.task_list_components.length === 0 && <li className="text-muted-fg">Sin repuestos asociados.</li>}
          </ul>
          <AddComponentForm taskListId={id} operationId={op.id} materials={materials} onAdded={load} />
        </section>
      ))}

      <AddOperationForm taskListId={id} nextOperationNumber={nextOperationNumber} workCenters={workCenters} onAdded={load} />
    </div>
  );
}

function AddOperationForm({
  taskListId,
  nextOperationNumber,
  workCenters,
  onAdded,
}: {
  taskListId: string;
  nextOperationNumber: number;
  workCenters: WorkCenter[];
  onAdded: () => void;
}) {
  const [description, setDescription] = useState("");
  const [workCenterId, setWorkCenterId] = useState("");
  const [duration, setDuration] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/task-lists/${taskListId}/operations`, {
        method: "POST",
        body: JSON.stringify({ operation_number: nextOperationNumber, description, work_center_id: workCenterId, duration_value: Number(duration) }),
      });
      setDescription("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-3 text-xs">
      <span className="font-medium text-foreground">+ Operación {nextOperationNumber}</span>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción"
        required
        className="w-56 rounded border border-border bg-surface px-2 py-1.5"
      />
      <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
        <option value="">Puesto de trabajo...</option>
        {workCenters.map((wc) => (
          <option key={wc.id} value={wc.id}>
            {wc.code}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.25"
        min="0"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className="w-20 rounded border border-border bg-surface px-2 py-1.5"
      />
      <button disabled={busy} className="rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
        Agregar
      </button>
      {error && <span className="text-danger">{error}</span>}
    </form>
  );
}

function AddComponentForm({
  taskListId,
  operationId,
  materials,
  onAdded,
}: {
  taskListId: string;
  operationId: string;
  materials: Material[];
  onAdded: () => void;
}) {
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) return;
    setBusy(true);
    try {
      await apiFetch(`/task-lists/${taskListId}/operations/${operationId}/components`, {
        method: "POST",
        body: JSON.stringify({ material_id: materialId, quantity: Number(quantity) }),
      });
      setMaterialId("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3 text-xs">
      <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-56 rounded border border-border bg-surface px-2 py-1.5">
        <option value="">+ Agregar repuesto...</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.code} — {m.description}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        min="0"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-20 rounded border border-border bg-surface px-2 py-1.5"
      />
      <button disabled={busy || !materialId} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-50">
        Agregar
      </button>
    </form>
  );
}
