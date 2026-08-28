"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_STATUS_TONE, NOTIFICATION_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";

interface NotificationRow {
  id: string;
  code: string;
  notification_type: string;
  description: string;
  priority: string;
  status: string;
  reported_date: string;
  equipment: { code: string; description: string } | null;
}

const COLUMNS: ColDef<NotificationRow>[] = [
  {
    headerName: "Código",
    field: "code",
    width: 130,
    cellRenderer: (p: { data?: NotificationRow }) =>
      p.data ? (
        <Link href={`/notifications/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.code}
        </Link>
      ) : null,
  },
  { headerName: "Tipo", field: "notification_type", width: 110, valueFormatter: (p) => NOTIFICATION_TYPE_LABELS[p.value as string] ?? p.value },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 200 },
  { headerName: "Equipo", valueGetter: (p) => p.data?.equipment?.description ?? "—", width: 180 },
  {
    headerName: "Prioridad",
    field: "priority",
    width: 110,
    cellRenderer: (p: { value?: string }) => (p.value ? <StatusBadge label={PRIORITY_LABELS[p.value] ?? p.value} tone={PRIORITY_TONE[p.value] ?? "neutral"} /> : null),
  },
  {
    headerName: "Estado",
    field: "status",
    width: 120,
    cellRenderer: (p: { value?: string }) =>
      p.value ? <StatusBadge label={NOTIFICATION_STATUS_LABELS[p.value] ?? p.value} tone={NOTIFICATION_STATUS_TONE[p.value] ?? "neutral"} /> : null,
  },
  {
    headerName: "Reportado",
    field: "reported_date",
    width: 120,
    valueFormatter: (p) => new Date(p.value as string).toLocaleDateString("es-AR"),
  },
];

export default function NotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar búsqueda": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ data: NotificationRow[]; total: number }>(`/notifications?pageSize=200${search ? `&search=${encodeURIComponent(search)}` : ""}`)
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
        <h1 className="text-base font-semibold text-foreground">Avisos</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-fg">{total} resultados</span>
          <button type="button" onClick={() => setShowModal(true)} className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover">
            + Nuevo aviso
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DataGrid rows={rows} columns={COLUMNS} loading={loading} onQuickSearch={setSearch} quickSearchPlaceholder="Buscar..." exportFileName="avisos" />
      </div>

      {showModal && (
        <CreateNotificationModal
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

interface Equipment {
  id: string;
  code: string;
  description: string;
}

function CreateNotificationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [code, setCode] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [description, setDescription] = useState("");
  const [notificationType, setNotificationType] = useState("M2_REQUEST");
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Equipment[] }>("/equipment?pageSize=200").then((res) => setEquipmentList(res.data));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify({
          code,
          equipment_id: equipmentId,
          description,
          notification_type: notificationType,
          is_breakdown: notificationType === "M1_MALFUNCTION" ? isBreakdown : false,
          malfunction_start: notificationType === "M1_MALFUNCTION" && isBreakdown ? new Date().toISOString() : undefined,
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
    <Modal title="Nuevo aviso" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Tipo
          <select value={notificationType} onChange={(e) => setNotificationType(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="M2_REQUEST">Solicitud</option>
            <option value="M1_MALFUNCTION">Avería</option>
            <option value="M3_ACTIVITY_REPORT">Reporte de actividad</option>
          </select>
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
        <label className="flex flex-col gap-1">
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        {notificationType === "M1_MALFUNCTION" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isBreakdown} onChange={(e) => setIsBreakdown(e.target.checked)} />
            Es una parada de equipo (para cálculo de MTTR)
          </label>
        )}
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear
        </button>
      </form>
    </Modal>
  );
}
