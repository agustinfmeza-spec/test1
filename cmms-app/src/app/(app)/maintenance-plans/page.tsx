"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";

interface PlanRow {
  id: string;
  code: string;
  description: string;
  plan_type: string;
  cycle_value: number | null;
  cycle_unit: string | null;
  status: string;
  _count: { maintenance_items: number };
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  TIME_BASED: "Por tiempo",
  COUNTER_BASED: "Por contador",
  MULTIPLE_COUNTER: "Multi-contador",
  CONDITION_BASED: "Por condición",
};

const CYCLE_UNIT_LABELS: Record<string, string> = {
  DAY: "días",
  WEEK: "semanas",
  MONTH: "meses",
  YEAR: "años",
  HOUR_METER: "horas",
  KM: "km",
  CYCLE_COUNT: "ciclos",
};

const COLUMNS: ColDef<PlanRow>[] = [
  {
    headerName: "Código",
    field: "code",
    width: 150,
    cellRenderer: (p: { data?: PlanRow }) =>
      p.data ? (
        <Link href={`/maintenance-plans/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.code}
        </Link>
      ) : null,
  },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 220 },
  { headerName: "Tipo", field: "plan_type", width: 140, valueFormatter: (p) => PLAN_TYPE_LABELS[p.value as string] ?? p.value },
  {
    headerName: "Ciclo",
    valueGetter: (p) => (p.data?.cycle_value ? `${p.data.cycle_value} ${CYCLE_UNIT_LABELS[p.data.cycle_unit ?? ""] ?? p.data.cycle_unit}` : "—"),
    width: 130,
  },
  { headerName: "Ítems", valueGetter: (p) => p.data?._count.maintenance_items ?? 0, width: 90 },
  { headerName: "Estado", field: "status", width: 110 },
];

export default function MaintenancePlansPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar búsqueda": loading debe activarse
    // sincrónicamente al iniciar el efecto, antes del debounce/fetch async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ data: PlanRow[]; total: number }>(`/maintenance-plans?pageSize=200${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((res) => {
          setRows(res.data);
          setTotal(res.total);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Planes de Mantenimiento</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-fg">{total} resultados</span>
          <Link href="/scheduling" className="rounded border border-border px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:text-accent">
            Ver calendario
          </Link>
          <Link href="/maintenance-plans/new" className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover">
            + Nuevo plan
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DataGrid rows={rows} columns={COLUMNS} loading={loading} onQuickSearch={setSearch} quickSearchPlaceholder="Buscar..." exportFileName="planes-mantenimiento" />
      </div>
    </div>
  );
}
