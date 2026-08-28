"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import { apiFetch } from "@/lib/api-client";
import { DataGrid } from "@/components/data-grid";

interface StockRow {
  id: string;
  quantity_on_hand: string;
  quantity_reserved: string;
  min_stock: string;
  reorder_point: string;
  materials: { id: string; code: string; description: string };
  warehouses: { code: string; description: string };
}

const COLUMNS: ColDef<StockRow>[] = [
  {
    headerName: "Material",
    valueGetter: (p) => `${p.data?.materials.code} — ${p.data?.materials.description}`,
    flex: 1,
    minWidth: 220,
    cellRenderer: (p: { data?: StockRow }) =>
      p.data ? (
        <Link href={`/materials/${p.data.materials.id}`} className="text-accent hover:underline">
          {p.data.materials.code} — {p.data.materials.description}
        </Link>
      ) : null,
  },
  { headerName: "Almacén", valueGetter: (p) => `${p.data?.warehouses.code} — ${p.data?.warehouses.description}`, width: 200 },
  {
    headerName: "En mano",
    field: "quantity_on_hand",
    width: 110,
    cellClassRules: {
      "text-danger font-medium": (p) => Number(p.data?.quantity_on_hand) <= Number(p.data?.reorder_point),
    },
  },
  { headerName: "Reservado", field: "quantity_reserved", width: 110 },
  { headerName: "Mínimo", field: "min_stock", width: 100 },
  { headerName: "Punto de pedido", field: "reorder_point", width: 130 },
];

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [belowReorder, setBelowReorder] = useState(false);

  useEffect(() => {
    // Patrón estándar de "fetch al cambiar filtros": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const qs = new URLSearchParams({ pageSize: "200" });
    if (search) qs.set("search", search);
    if (belowReorder) qs.set("belowReorderPoint", "true");
    const t = setTimeout(() => {
      apiFetch<{ data: StockRow[]; total: number }>(`/stock?${qs}`)
        .then((res) => {
          setRows(res.data);
          setTotal(res.total);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, belowReorder]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Stock de Repuestos</h1>
        <span className="text-xs text-muted-fg">{total} resultados</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-muted-fg">
          <input type="checkbox" checked={belowReorder} onChange={(e) => setBelowReorder(e.target.checked)} />
          Solo bajo punto de pedido
        </label>
        <Link href="/inventory/movements" className="text-accent hover:underline">
          Ver movimientos →
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <DataGrid rows={rows} columns={COLUMNS} loading={loading} onQuickSearch={setSearch} quickSearchPlaceholder="Buscar material..." exportFileName="stock" />
      </div>
    </div>
  );
}
