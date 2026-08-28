"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { WORK_ORDER_COLUMNS, type WorkOrderRow } from "./work-orders-columns";

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

const STATUS_OPTIONS = ["", ...Object.keys(ORDER_STATUS_LABELS)];

export default function WorkOrdersPage() {
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ pageSize: "200" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (overdueOnly) params.set("overdue", "true");
    return params.toString();
  }, [search, status, overdueOnly]);

  useEffect(() => {
    let cancelled = false;
    // Patrón estándar de "fetch al cambiar filtros": el loading debe activarse
    // sincrónicamente al iniciar el efecto, antes del debounce/fetch async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      apiFetch<PaginatedResponse<WorkOrderRow>>(`/work-orders?${queryString}`)
        .then((res) => {
          if (cancelled) return;
          setRows(res.data);
          setTotal(res.total);
        })
        .catch((err) => !cancelled && setError(err.message))
        .finally(() => !cancelled && setLoading(false));
    }, 250); // debounce de búsqueda

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [queryString]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Órdenes de Trabajo</h1>
        <span className="text-xs text-muted-fg">{total} resultados</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1.5 text-foreground outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? ORDER_STATUS_LABELS[s] : "Todos los estados"}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-muted-fg">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Solo vencidas
        </label>

        {error && <span className="rounded bg-danger-bg px-2 py-1 text-danger">{error}</span>}
      </div>

      <div className="min-h-0 flex-1">
        <DataGrid
          rows={rows}
          columns={WORK_ORDER_COLUMNS}
          loading={loading}
          quickSearchPlaceholder="Buscar por código, descripción..."
          onQuickSearch={setSearch}
          exportFileName="ordenes-de-trabajo"
          emptyMessage="No hay órdenes de trabajo que coincidan con los filtros"
        />
      </div>
    </div>
  );
}
