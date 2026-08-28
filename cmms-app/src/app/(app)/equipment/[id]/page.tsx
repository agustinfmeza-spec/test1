"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface Material {
  id: string;
  code: string;
  description: string;
  unit_of_measure: string;
}

interface BomItem {
  id: string;
  quantity: string;
  unit_of_measure: string;
  item_category: string;
  materials: Material;
}

interface EquipmentDetail {
  id: string;
  code: string;
  description: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  status: string;
  functional_locations: { code: string; description: string } | null;
  cost_centers: { code: string; name: string } | null;
  equipment_bom_headers: { equipment_bom_items: BomItem[] }[];
  task_lists: { id: string; group_code: string; description: string }[];
  measuring_points: { id: string; code: string; description: string; unit_of_measure: string }[];
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("es-AR") : "—";
}

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<EquipmentDetail>(`/equipment/${id}`).then(setEquipment).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
  }, [load]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!equipment) return <p className="text-sm text-muted-fg">Cargando...</p>;

  const bomItems = equipment.equipment_bom_headers.flatMap((h) => h.equipment_bom_items);

  async function addBomItem(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/equipment/${id}/bom`, { method: "POST", body: JSON.stringify({ material_id: materialId, quantity: Number(quantity) }) });
      setMaterialId("");
      setQuantity("1");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/locations" className="text-xs text-accent hover:underline">
        ← Volver a ubicaciones y equipos
      </Link>

      <div className="rounded border border-border bg-surface p-4">
        <h1 className="text-base font-semibold text-foreground">
          {equipment.code} — {equipment.description}
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-fg">Ubicación técnica</dt>
            <dd>{equipment.functional_locations?.description ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Fabricante / Modelo</dt>
            <dd>
              {equipment.manufacturer ?? "—"} {equipment.model ? `/ ${equipment.model}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-fg">N° de serie</dt>
            <dd>{equipment.serial_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Centro de costo</dt>
            <dd>{equipment.cost_centers?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Garantía</dt>
            <dd>
              {fmtDate(equipment.warranty_start_date)} — {fmtDate(equipment.warranty_end_date)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-fg">Estado</dt>
            <dd>{equipment.status}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Lista de Materiales (BOM)</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Material</th>
              <th className="px-4 py-2 font-medium">Cantidad</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {bomItems.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  {item.materials.code} — {item.materials.description}
                </td>
                <td className="px-4 py-2">
                  {item.quantity} {item.unit_of_measure}
                </td>
                <td className="px-4 py-2">{item.item_category === "MANDATORY" ? "Obligatorio" : "Recomendado"}</td>
              </tr>
            ))}
            {bomItems.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-fg">
                  Sin repuestos definidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form onSubmit={addBomItem} className="flex items-end gap-2 border-t border-border p-3 text-xs">
          <label className="flex flex-col gap-1">
            Material
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-64 rounded border border-border bg-surface px-2 py-1.5">
              <option value="">Seleccionar...</option>
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
              className="w-20 rounded border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <button disabled={busy || !materialId} className="rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
            Agregar
          </button>
          {error && <span className="text-danger">{error}</span>}
        </form>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Hojas de Ruta</h2>
          <ul className="p-3 text-xs">
            {equipment.task_lists.map((tl) => (
              <li key={tl.id}>
                <Link href={`/task-lists/${tl.id}`} className="text-accent hover:underline">
                  {tl.group_code} — {tl.description}
                </Link>
              </li>
            ))}
            {equipment.task_lists.length === 0 && <li className="text-muted-fg">Sin hojas de ruta asociadas.</li>}
          </ul>
        </section>

        <section className="rounded border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Puntos de Medición</h2>
          <ul className="p-3 text-xs">
            {equipment.measuring_points.map((mp) => (
              <li key={mp.id}>
                {mp.code} — {mp.description} ({mp.unit_of_measure})
              </li>
            ))}
            {equipment.measuring_points.length === 0 && <li className="text-muted-fg">Sin puntos de medición.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
