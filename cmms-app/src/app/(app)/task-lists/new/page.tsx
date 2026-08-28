"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Equipment {
  id: string;
  code: string;
  description: string;
}
interface WorkCenter {
  id: string;
  code: string;
  name: string;
}
interface Material {
  id: string;
  code: string;
  description: string;
}

export default function NewTaskListPage() {
  const router = useRouter();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [groupCode, setGroupCode] = useState("");
  const [description, setDescription] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [opDescription, setOpDescription] = useState("");
  const [workCenterId, setWorkCenterId] = useState("");
  const [durationValue, setDurationValue] = useState("1");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Equipment[] }>("/equipment?pageSize=200").then((res) => setEquipmentList(res.data));
    apiFetch<WorkCenter[]>("/work-centers").then(setWorkCenters);
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const taskList = await apiFetch<{ id: string }>("/task-lists", {
        method: "POST",
        body: JSON.stringify({
          group_code: groupCode,
          description,
          task_list_type: "EQUIPMENT",
          equipment_id: equipmentId,
          operations: [
            {
              operation_number: 10,
              description: opDescription,
              work_center_id: workCenterId,
              duration_value: Number(durationValue),
              components: materialId ? [{ material_id: materialId, quantity: Number(quantity) }] : undefined,
            },
          ],
        }),
      });
      router.push(`/task-lists/${taskList.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link href="/task-lists" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>
      <h1 className="text-base font-semibold text-foreground">Nueva Hoja de Ruta</h1>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded border border-border bg-surface p-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Código de grupo
            <input value={groupCode} onChange={(e) => setGroupCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
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
        </div>
        <label className="flex flex-col gap-1">
          Descripción de la hoja de ruta
          <input value={description} onChange={(e) => setDescription(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>

        <hr className="border-border" />
        <p className="font-medium text-foreground">Primera operación (podrás agregar más luego)</p>

        <label className="flex flex-col gap-1">
          Descripción de la operación
          <input value={opDescription} onChange={(e) => setOpDescription(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Puesto de trabajo
            <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
              <option value="">Seleccionar...</option>
              {workCenters.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Duración estimada (hs)
            <input
              type="number"
              step="0.25"
              min="0"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1.5"
            />
          </label>
        </div>

        <p className="font-medium text-foreground">Repuesto necesario (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            Material
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
              <option value="">Ninguno</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.description}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Cantidad
            <input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!materialId}
              className="rounded border border-border bg-surface px-2 py-1.5 disabled:opacity-50"
            />
          </label>
        </div>

        {error && <p className="rounded bg-danger-bg px-2 py-1.5 text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 self-start rounded bg-accent px-4 py-1.5 text-accent-fg disabled:opacity-50">
          Crear hoja de ruta
        </button>
      </form>
    </div>
  );
}
