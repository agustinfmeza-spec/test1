"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";

interface TaskListRow {
  id: string;
  group_code: string;
  description: string;
  task_list_type: string;
  status: string;
  _count: { task_list_operations: number };
}

const TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: "Equipo",
  FUNCTIONAL_LOCATION: "Ubicación técnica",
  GENERAL: "General",
};

const COLUMNS: ColDef<TaskListRow>[] = [
  {
    headerName: "Grupo",
    field: "group_code",
    width: 150,
    cellRenderer: (p: { data?: TaskListRow }) =>
      p.data ? (
        <Link href={`/task-lists/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.group_code}
        </Link>
      ) : null,
  },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 220 },
  { headerName: "Tipo", field: "task_list_type", width: 160, valueFormatter: (p) => TYPE_LABELS[p.value as string] ?? p.value },
  { headerName: "Operaciones", valueGetter: (p) => p.data?._count.task_list_operations ?? 0, width: 120 },
  { headerName: "Estado", field: "status", width: 120 },
];

export default function TaskListsPage() {
  const [rows, setRows] = useState<TaskListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar búsqueda": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ data: TaskListRow[]; total: number }>(`/task-lists?pageSize=200${search ? `&search=${encodeURIComponent(search)}` : ""}`)
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
        <h1 className="text-base font-semibold text-foreground">Hojas de Ruta</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-fg">{total} resultados</span>
          <Link href="/task-lists/new" className="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover">
            + Nueva hoja de ruta
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DataGrid rows={rows} columns={COLUMNS} loading={loading} onQuickSearch={setSearch} quickSearchPlaceholder="Buscar..." exportFileName="hojas-de-ruta" />
      </div>
    </div>
  );
}
