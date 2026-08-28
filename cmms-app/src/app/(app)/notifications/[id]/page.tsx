"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_STATUS_TONE, NOTIFICATION_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";

interface WorkCenter {
  id: string;
  code: string;
  name: string;
}

interface NotificationDetail {
  id: string;
  code: string;
  notification_type: string;
  description: string;
  long_text: string | null;
  priority: string;
  status: string;
  is_breakdown: boolean;
  malfunction_start: string | null;
  malfunction_end: string | null;
  reported_date: string;
  equipment: { id: string; code: string; description: string } | null;
  functional_locations: { code: string; description: string } | null;
  users: { full_name: string };
  work_orders: { id: string; code: string; status: string }[];
}

export default function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [notification, setNotification] = useState<NotificationDetail | null>(null);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [workCenterId, setWorkCenterId] = useState("");
  const [malfunctionEnd, setMalfunctionEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<NotificationDetail>(`/notifications/${id}`).then(setNotification).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<WorkCenter[]>("/work-centers").then(setWorkCenters);
  }, [load]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!notification) return <p className="text-sm text-muted-fg">Cargando...</p>;

  async function convertToWorkOrder() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/notifications/${id}/convert-to-work-order`, {
        method: "POST",
        body: JSON.stringify({ work_center_responsible_id: workCenterId || undefined }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function closeNotification() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "CLOSED",
          malfunction_end: notification!.is_breakdown && !notification!.malfunction_end ? new Date(malfunctionEnd).toISOString() : undefined,
        }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function completeNotification() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const needsMalfunctionEnd = notification.is_breakdown && !notification.malfunction_end;
  const isOpen = notification.status !== "CLOSED";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/notifications" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>

      <div className="rounded border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-foreground">{notification.code}</h1>
          <StatusBadge label={NOTIFICATION_STATUS_LABELS[notification.status] ?? notification.status} tone={NOTIFICATION_STATUS_TONE[notification.status] ?? "neutral"} />
          <StatusBadge label={PRIORITY_LABELS[notification.priority] ?? notification.priority} tone={PRIORITY_TONE[notification.priority] ?? "neutral"} />
          {notification.is_breakdown && <StatusBadge label="Parada de equipo" tone="danger" />}
        </div>
        <p className="mt-1 text-xs text-muted-fg">{notification.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-fg">Tipo</dt>
            <dd>{NOTIFICATION_TYPE_LABELS[notification.notification_type] ?? notification.notification_type}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Equipo</dt>
            <dd>{notification.equipment?.description ?? notification.functional_locations?.description ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Reportado por</dt>
            <dd>{notification.users.full_name}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Fecha</dt>
            <dd>{new Date(notification.reported_date).toLocaleString("es-AR")}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-foreground">Órdenes de Trabajo generadas</h2>
        {notification.work_orders.length > 0 ? (
          <ul className="text-xs">
            {notification.work_orders.map((wo) => (
              <li key={wo.id}>
                <Link href={`/work-orders/${wo.id}`} className="text-accent hover:underline">
                  {wo.code}
                </Link>{" "}
                — {wo.status}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-end gap-2 text-xs">
            <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
              <option value="">Puesto de trabajo (opcional)...</option>
              {workCenters.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </select>
            <button disabled={busy} onClick={convertToWorkOrder} className="rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
              Convertir a Orden de Trabajo Correctiva
            </button>
          </div>
        )}
      </section>

      {isOpen && (
        <section className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-4 text-xs">
          {needsMalfunctionEnd && (
            <label className="flex flex-col gap-1">
              Fin de la avería
              <input
                type="datetime-local"
                value={malfunctionEnd}
                onChange={(e) => setMalfunctionEnd(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1.5"
              />
            </label>
          )}
          <button disabled={busy} onClick={completeNotification} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-50">
            Marcar completado
          </button>
          <button
            disabled={busy || (needsMalfunctionEnd && !malfunctionEnd)}
            onClick={closeNotification}
            className="rounded border border-border px-3 py-1.5 hover:border-danger hover:text-danger disabled:opacity-50"
          >
            Cerrar aviso
          </button>
        </section>
      )}

      {error && <p className="rounded bg-danger-bg px-3 py-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
