"use client";

import { useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridReadyEvent } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Tema de AG Grid construido a partir de nuestras variables CSS (--surface,
 * --accent, --border, etc.): al referenciarlas con var(...), la grilla cambia
 * de claro a oscuro automáticamente junto con el resto de la app, sin lógica
 * de tema propia.
 */
const ERP_GRID_THEME = themeQuartz.withParams({
  accentColor: "var(--accent)",
  backgroundColor: "var(--surface)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border)",
  chromeBackgroundColor: "var(--surface-muted)",
  headerBackgroundColor: "var(--surface-muted)",
  headerTextColor: "var(--foreground)",
  headerFontWeight: 600,
  oddRowBackgroundColor: "var(--surface-muted)",
  rowHoverColor: "var(--surface-muted)",
  selectedRowBackgroundColor: "var(--info-bg)",
  fontFamily: "inherit",
  fontSize: 12.5,
  headerFontSize: 12,
  spacing: 6,
  wrapperBorder: true,
  wrapperBorderRadius: 4,
  rowVerticalPaddingScale: 0.7,
});

interface DataGridProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  loading?: boolean;
  quickSearchPlaceholder?: string;
  onQuickSearch?: (value: string) => void;
  exportFileName?: string;
  onRowClicked?: (row: T) => void;
  emptyMessage?: string;
}

export function DataGrid<T>({
  rows,
  columns,
  loading,
  quickSearchPlaceholder = "Buscar...",
  onQuickSearch,
  exportFileName = "export",
  onRowClicked,
  emptyMessage = "Sin resultados",
}: DataGridProps<T>) {
  const gridApiRef = useRef<GridReadyEvent<T>["api"] | null>(null);
  const [quickFilter, setQuickFilter] = useState("");

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      minWidth: 100,
    }),
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <input
          value={quickFilter}
          onChange={(e) => {
            setQuickFilter(e.target.value);
            onQuickSearch?.(e.target.value);
          }}
          placeholder={quickSearchPlaceholder}
          className="w-72 rounded border border-border bg-surface px-2.5 py-1.5 text-foreground outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => gridApiRef.current?.exportDataAsCsv({ fileName: `${exportFileName}.csv` })}
          className="rounded border border-border bg-surface px-2.5 py-1.5 text-muted-fg hover:border-border-strong hover:text-foreground"
        >
          Exportar CSV
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <AgGridReact<T>
          theme={ERP_GRID_THEME}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          quickFilterText={onQuickSearch ? undefined : quickFilter}
          loading={loading}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200]}
          animateRows={false}
          rowHeight={30}
          headerHeight={32}
          overlayNoRowsTemplate={`<span style="font-size:12.5px;color:var(--muted-fg)">${emptyMessage}</span>`}
          onGridReady={(e) => {
            gridApiRef.current = e.api;
          }}
          onRowClicked={onRowClicked ? (e) => e.data && onRowClicked(e.data) : undefined}
        />
      </div>
    </div>
  );
}
