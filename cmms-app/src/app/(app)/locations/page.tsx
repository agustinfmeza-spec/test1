"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";
import { Modal } from "@/components/modal";
import { usePlants } from "@/lib/use-plants";
import { LocationTreeNode, type LocationNode } from "./location-tree";

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

interface EquipmentRow {
  id: string;
  code: string;
  description: string;
  manufacturer: string | null;
  status: string;
  functional_locations: { code: string; description: string } | null;
}

const EQUIPMENT_COLUMNS: ColDef<EquipmentRow>[] = [
  {
    headerName: "Código",
    field: "code",
    width: 140,
    cellRenderer: (p: { data?: EquipmentRow }) =>
      p.data ? (
        <Link href={`/equipment/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.code}
        </Link>
      ) : null,
  },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 200 },
  { headerName: "Fabricante", field: "manufacturer", width: 150 },
  { headerName: "Ubicación", valueGetter: (p) => p.data?.functional_locations?.description ?? "—", width: 180 },
  { headerName: "Estado", field: "status", width: 120 },
];

export default function LocationsPage() {
  const [roots, setRoots] = useState<LocationNode[]>([]);
  const [selected, setSelected] = useState<LocationNode | null>(null);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    apiFetch<PaginatedResponse<LocationNode>>("/functional-locations?pageSize=200").then((res) => setRoots(res.data));
  }, [reloadToken]);

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar filtro": loading debe activarse
    // sincrónicamente al iniciar el efecto, antes del fetch async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const qs = selected ? `functionalLocationId=${selected.id}&pageSize=200` : "pageSize=200";
    apiFetch<PaginatedResponse<EquipmentRow>>(`/equipment?${qs}`)
      .then((res) => {
        setEquipment(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [selected, reloadToken]);

  return (
    <div className="flex h-full gap-3">
      <aside className="flex w-72 shrink-0 flex-col rounded border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold text-foreground">Ubicaciones Técnicas</h2>
          <button type="button" onClick={() => setShowLocationModal(true)} className="text-xs text-accent hover:underline">
            + Nueva
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <div
            onClick={() => setSelected(null)}
            className={`cursor-pointer rounded px-3 py-1 text-xs ${!selected ? "bg-info-bg text-info" : "text-muted-fg hover:bg-surface-muted"}`}
          >
            Todas las ubicaciones
          </div>
          {roots.map((r) => (
            <LocationTreeNode key={r.id} node={r} level={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
          ))}
          {roots.length === 0 && <p className="px-3 py-2 text-xs text-muted-fg">Sin ubicaciones creadas.</p>}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">
            {selected ? `Equipos en ${selected.description}` : "Todos los equipos"}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-fg">{total} resultados</span>
            <button
              type="button"
              onClick={() => setShowEquipmentModal(true)}
              className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover"
            >
              + Nuevo equipo
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <DataGrid rows={equipment} columns={EQUIPMENT_COLUMNS} loading={loading} exportFileName="equipos" emptyMessage="Sin equipos" />
        </div>
      </div>

      {showLocationModal && (
        <CreateLocationModal
          parent={selected}
          onClose={() => setShowLocationModal(false)}
          onCreated={() => {
            setShowLocationModal(false);
            setReloadToken((t) => t + 1);
          }}
        />
      )}
      {showEquipmentModal && (
        <CreateEquipmentModal
          location={selected}
          onClose={() => setShowEquipmentModal(false)}
          onCreated={() => {
            setShowEquipmentModal(false);
            setReloadToken((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function CreateLocationModal({ parent, onClose, onCreated }: { parent: LocationNode | null; onClose: () => void; onCreated: () => void }) {
  const plants = usePlants();
  const [plantId, setPlantId] = useState("");
  // Sin selección explícita, se usa la primera planta disponible (derivado, sin efecto).
  const effectivePlantId = plantId || plants[0]?.id || "";
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/functional-locations", {
        method: "POST",
        body: JSON.stringify({ plant_id: effectivePlantId, code, description, parent_id: parent?.id }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={parent ? `Nueva ubicación dentro de ${parent.description}` : "Nueva ubicación técnica (raíz)"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Planta
          <select value={effectivePlantId} onChange={(e) => setPlantId(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Descripción
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="rounded border border-border bg-surface px-2 py-1.5"
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy || !effectivePlantId} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear
        </button>
      </form>
    </Modal>
  );
}

function CreateEquipmentModal({ location, onClose, onCreated }: { location: LocationNode | null; onClose: () => void; onCreated: () => void }) {
  const plants = usePlants();
  const [plantId, setPlantId] = useState("");
  const effectivePlantId = plantId || plants[0]?.id || "";
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/equipment", {
        method: "POST",
        body: JSON.stringify({
          plant_id: effectivePlantId,
          code,
          description,
          manufacturer: manufacturer || undefined,
          functional_location_id: location?.id,
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
    <Modal title={location ? `Nuevo equipo en ${location.description}` : "Nuevo equipo"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Planta
          <select value={effectivePlantId} onChange={(e) => setPlantId(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Descripción
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="rounded border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          Fabricante
          <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy || !effectivePlantId} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear
        </button>
      </form>
    </Modal>
  );
}
