"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";
import { Modal } from "@/components/modal";

interface MaterialRow {
  id: string;
  code: string;
  description: string;
  material_type: string;
  unit_of_measure: string;
  unit_cost: string;
  criticality: number | null;
}

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  SPARE_PART: "Repuesto",
  CONSUMABLE: "Consumible",
  TOOL: "Herramienta",
  RAW_MATERIAL: "Materia prima",
};

const COLUMNS: ColDef<MaterialRow>[] = [
  {
    headerName: "Código",
    field: "code",
    width: 140,
    cellRenderer: (p: { data?: MaterialRow }) =>
      p.data ? (
        <Link href={`/materials/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.code}
        </Link>
      ) : null,
  },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 220 },
  { headerName: "Tipo", field: "material_type", width: 130, valueFormatter: (p) => MATERIAL_TYPE_LABELS[p.value as string] ?? p.value },
  { headerName: "UM", field: "unit_of_measure", width: 80 },
  { headerName: "Costo unit.", field: "unit_cost", width: 110 },
  { headerName: "Criticidad", field: "criticality", width: 100 },
];

export default function MaterialsPage() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar búsqueda": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const qs = new URLSearchParams({ pageSize: "200", ...(search ? { search } : {}) });
    const t = setTimeout(() => {
      apiFetch<{ data: MaterialRow[]; total: number }>(`/materials?${qs}`)
        .then((res) => {
          setRows(res.data);
          setTotal(res.total);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, reloadToken]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Materiales</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-fg">{total} resultados</span>
          <button type="button" onClick={() => setShowModal(true)} className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover">
            + Nuevo material
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          rows={rows}
          columns={COLUMNS}
          loading={loading}
          onQuickSearch={setSearch}
          quickSearchPlaceholder="Buscar por código, descripción..."
          exportFileName="materiales"
        />
      </div>

      {showModal && (
        <CreateMaterialModal
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

function CreateMaterialModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/materials", { method: "POST", body: JSON.stringify({ code, description, unit_cost: Number(unitCost) }) });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuevo material" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Costo unitario
          <input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear
        </button>
      </form>
    </Modal>
  );
}
