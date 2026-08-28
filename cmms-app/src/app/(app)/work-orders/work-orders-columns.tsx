import Link from "next/link";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import { StatusBadge } from "@/components/status-badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";

export interface WorkOrderRow {
  id: string;
  code: string;
  description: string;
  order_type: string;
  priority: string;
  status: string;
  basic_start_date: string | null;
  basic_end_date: string | null;
  equipment: { code: string; description: string } | null;
  functional_locations: { code: string; description: string } | null;
  work_centers: { code: string; name: string } | null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR");
}

export const WORK_ORDER_COLUMNS: ColDef<WorkOrderRow>[] = [
  {
    headerName: "Código",
    field: "code",
    width: 150,
    pinned: "left",
    cellRenderer: (p: { data?: WorkOrderRow }) =>
      p.data ? (
        <Link href={`/work-orders/${p.data.id}`} className="font-medium text-accent hover:underline">
          {p.data.code}
        </Link>
      ) : null,
  },
  { headerName: "Descripción", field: "description", flex: 1, minWidth: 220 },
  {
    headerName: "Objeto técnico",
    valueGetter: (p) => p.data?.equipment?.description ?? p.data?.functional_locations?.description ?? "—",
    minWidth: 180,
  },
  {
    headerName: "Tipo",
    field: "order_type",
    width: 130,
    valueFormatter: (p: ValueFormatterParams<WorkOrderRow>) => ORDER_TYPE_LABELS[p.value as string] ?? p.value,
  },
  {
    headerName: "Prioridad",
    field: "priority",
    width: 120,
    cellRenderer: (p: { value?: string }) =>
      p.value ? <StatusBadge label={PRIORITY_LABELS[p.value] ?? p.value} tone={PRIORITY_TONE[p.value] ?? "neutral"} /> : null,
  },
  {
    headerName: "Estado",
    field: "status",
    width: 140,
    cellRenderer: (p: { value?: string }) =>
      p.value ? <StatusBadge label={ORDER_STATUS_LABELS[p.value] ?? p.value} tone={ORDER_STATUS_TONE[p.value] ?? "neutral"} /> : null,
  },
  {
    headerName: "Puesto de trabajo",
    valueGetter: (p) => p.data?.work_centers?.name ?? "—",
    width: 160,
  },
  {
    headerName: "Inicio prog.",
    field: "basic_start_date",
    width: 120,
    valueFormatter: (p: ValueFormatterParams<WorkOrderRow>) => formatDate(p.value as string),
  },
  {
    headerName: "Fin prog.",
    field: "basic_end_date",
    width: 120,
    valueFormatter: (p: ValueFormatterParams<WorkOrderRow>) => formatDate(p.value as string),
  },
];
