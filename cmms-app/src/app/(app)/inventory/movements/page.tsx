"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";
import { Modal } from "@/components/modal";

interface Material {
  id: string;
  code: string;
  description: string;
}
interface Warehouse {
  id: string;
  code: string;
  description: string;
}

interface MovementRow {
  id: string;
  movement_type: string;
  quantity: string;
  movement_date: string;
  materials: Material;
  warehouses: Warehouse;
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  GR_101_PURCHASE: "Ingreso por compra",
  GI_261_CONSUMPTION: "Salida por consumo (OT)",
  GI_262_RETURN: "Devolución (OT)",
  TR_311_TRANSFER: "Transferencia",
  ADJ_701_POSITIVE: "Ajuste positivo",
  ADJ_702_NEGATIVE: "Ajuste negativo",
};

// Los movimientos manuales solo cubren los tipos que el trigger de stock aplica
// de punta a punta hoy. Consumo/devolución se hacen desde la Orden de Trabajo;
// la transferencia entre almacenes todavía no está implementada en el backend.
const MANUAL_MOVEMENT_TYPES = ["GR_101_PURCHASE", "ADJ_701_POSITIVE", "ADJ_702_NEGATIVE"];

const COLUMNS: ColDef<MovementRow>[] = [
  { headerName: "Fecha", field: "movement_date", width: 150, valueFormatter: (p) => new Date(p.value as string).toLocaleString("es-AR") },
  { headerName: "Tipo", field: "movement_type", width: 190, valueFormatter: (p) => MOVEMENT_TYPE_LABELS[p.value as string] ?? p.value },
  { headerName: "Material", valueGetter: (p) => `${p.data?.materials.code} — ${p.data?.materials.description}`, flex: 1, minWidth: 200 },
  { headerName: "Almacén", valueGetter: (p) => p.data?.warehouses.code, width: 110 },
  { headerName: "Cantidad", field: "quantity", width: 110 },
];

export default function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Patrón estándar de "fetch al montar/recargar": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch<{ data: MovementRow[]; total: number }>("/stock-movements?pageSize=200")
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [reloadToken]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Movimientos de Stock</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-fg">{total} resultados</span>
          <Link href="/inventory/stock" className="text-xs text-accent hover:underline">
            ← Ver stock
          </Link>
          <button type="button" onClick={() => setShowModal(true)} className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover">
            + Nuevo movimiento
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DataGrid rows={rows} columns={COLUMNS} loading={loading} exportFileName="movimientos-stock" />
      </div>

      {showModal && (
        <CreateMovementModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            setReloadToken((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function CreateMovementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState("GR_101_PURCHASE");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
    apiFetch<Warehouse[]>("/warehouses").then(setWarehouses);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          material_id: materialId,
          warehouse_id: warehouseId,
          movement_type: movementType,
          quantity: Number(quantity),
          unit_cost: unitCost ? Number(unitCost) : undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuevo movimiento de stock" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Tipo de movimiento
          <select value={movementType} onChange={(e) => setMovementType(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
            {MANUAL_MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Material
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="">Seleccionar...</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Almacén
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="">Seleccionar...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.description}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            Cantidad
            <input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
          {movementType === "GR_101_PURCHASE" && (
            <label className="flex flex-col gap-1">
              Costo unitario
              <input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
            </label>
          )}
        </div>
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Registrar
        </button>
      </form>
    </Modal>
  );
}
