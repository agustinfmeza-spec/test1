"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";
import { OPERATION_STATUS_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_TONE } from "@/lib/labels";

interface Material {
  id: string;
  code: string;
  description: string;
  unit_of_measure: string;
}

interface Component {
  id: string;
  material_id: string;
  quantity_required: string;
  quantity_withdrawn: string;
  unit_of_measure: string;
  status: string;
  warehouse_id: string | null;
  materials: Material;
}

interface TimeConfirmation {
  id: string;
  technician_id: string;
  work_date: string;
  actual_hours: string;
}

interface Operation {
  id: string;
  operation_number: number;
  description: string;
  duration_planned: string;
  duration_actual: string;
  status: string;
  work_centers: { code: string; name: string };
  time_confirmations: TimeConfirmation[];
  work_order_components: Component[];
}

interface WorkOrderDetail {
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
  work_order_operations: Operation[];
}

const NEXT_STATUS: Record<string, string[]> = {
  CREATED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROCESS", "COMPLETED", "CANCELLED"],
  IN_PROCESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["TECHNICALLY_COMPLETED"],
  TECHNICALLY_COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [order, setOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<WorkOrderDetail>(`/work-orders/${id}`)
      .then(setOrder)
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // Patrón estándar de "fetch al montar/cambiar id"; load() setea loading
    // sincrónicamente antes de la llamada async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function changeStatus(status: string) {
    setActionPending(true);
    setError(null);
    try {
      await apiFetch(`/work-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar el estado");
    } finally {
      setActionPending(false);
    }
  }

  if (loading && !order) return <p className="text-sm text-muted-fg">Cargando...</p>;
  if (error && !order) return <p className="text-sm text-danger">{error}</p>;
  if (!order) return null;

  const nextStatuses = NEXT_STATUS[order.status] ?? [];
  const plannerOnly = new Set(["RELEASED", "TECHNICALLY_COMPLETED", "CLOSED", "CANCELLED"]);
  const canAct = (target: string) => role === "ADMIN" || role === "PLANNER" || !plannerOnly.has(target);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/work-orders" className="text-xs text-accent hover:underline">
          ← Volver al listado
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded border border-border bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground">{order.code}</h1>
            <StatusBadge label={ORDER_STATUS_LABELS[order.status] ?? order.status} tone={ORDER_STATUS_TONE[order.status] ?? "neutral"} />
            <StatusBadge label={PRIORITY_LABELS[order.priority] ?? order.priority} tone={PRIORITY_TONE[order.priority] ?? "neutral"} />
          </div>
          <p className="mt-1 text-sm text-muted-fg">{order.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-fg">Tipo</dt>
              <dd className="text-foreground">{ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Objeto técnico</dt>
              <dd className="text-foreground">{order.equipment?.description ?? order.functional_locations?.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Puesto de trabajo</dt>
              <dd className="text-foreground">{order.work_centers?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Fechas programadas</dt>
              <dd className="text-foreground">
                {order.basic_start_date ? new Date(order.basic_start_date).toLocaleDateString("es-AR") : "—"} —{" "}
                {order.basic_end_date ? new Date(order.basic_end_date).toLocaleDateString("es-AR") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextStatuses.filter(canAct).map((target) => (
            <button
              key={target}
              type="button"
              disabled={actionPending}
              onClick={() => changeStatus(target)}
              className="rounded border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {ORDER_STATUS_LABELS[target] ?? target}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg px-3 py-2 text-xs text-danger">{error}</p>}

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Operaciones</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Puesto</th>
              <th className="px-4 py-2 font-medium">Hs. planif.</th>
              <th className="px-4 py-2 font-medium">Hs. reales</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Repuestos</th>
            </tr>
          </thead>
          <tbody>
            {order.work_order_operations.map((op) => (
              <tr key={op.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{op.operation_number}</td>
                <td className="px-4 py-2">{op.description}</td>
                <td className="px-4 py-2">{op.work_centers?.name}</td>
                <td className="px-4 py-2">{op.duration_planned}</td>
                <td className="px-4 py-2">{op.duration_actual}</td>
                <td className="px-4 py-2">{OPERATION_STATUS_LABELS[op.status] ?? op.status}</td>
                <td className="px-4 py-2">
                  {op.work_order_components.length === 0
                    ? "—"
                    : op.work_order_components.map((c) => `${c.materials.description} (${c.quantity_withdrawn}/${c.quantity_required})`).join(", ")}
                </td>
              </tr>
            ))}
            {order.work_order_operations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-fg">
                  Sin operaciones cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {(role === "TECHNICIAN" || role === "PLANNER" || role === "ADMIN") && order.work_order_operations.length > 0 && (
        <TimeAndMaterials order={order} onChanged={load} />
      )}
    </div>
  );
}

interface Warehouse {
  id: string;
  code: string;
  description: string;
}

function TimeAndMaterials({ order, onChanged }: { order: WorkOrderDetail; onChanged: () => void }) {
  const [operationId, setOperationId] = useState(order.work_order_operations[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    apiFetch<Warehouse[]>("/warehouses").then(setWarehouses).catch(() => {});
  }, []);

  const componentsFlat = order.work_order_operations.flatMap((op) => op.work_order_components.map((c) => ({ ...c, operationId: op.id })));

  async function logHours(e: React.FormEvent) {
    e.preventDefault();
    if (!operationId || !hours) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/work-orders/${order.id}/operations/${operationId}/time-confirmations`, {
        method: "POST",
        body: JSON.stringify({ work_date: new Date().toISOString().slice(0, 10), actual_hours: Number(hours) }),
      });
      setHours("");
      setMsg("Horas registradas.");
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(componentId: string, quantity: number, warehouseId: string) {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/work-orders/${order.id}/components/${componentId}/withdraw`, {
        method: "POST",
        body: JSON.stringify({ quantity, warehouse_id: warehouseId || undefined }),
      });
      setMsg("Consumo registrado.");
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error al consumir el repuesto (¿falta almacén asignado?)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid grid-cols-1 gap-4 rounded border border-border bg-surface p-4 md:grid-cols-2">
      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Notificar horas</h2>
        <form onSubmit={logHours} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-fg">Operación</label>
            <select value={operationId} onChange={(e) => setOperationId(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5">
              {order.work_order_operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.operation_number} — {op.description}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-fg">Horas</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-24 rounded border border-border bg-surface px-2 py-1.5"
            />
          </div>
          <button disabled={busy} className="rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
            Cargar
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Consumir repuestos</h2>
        <ul className="flex flex-col gap-2">
          {componentsFlat.map((c) => (
            <WithdrawRow key={c.id} component={c} warehouses={warehouses} onWithdraw={(qty, wh) => withdraw(c.id, qty, wh)} disabled={busy} />
          ))}
          {componentsFlat.length === 0 && <li className="text-xs text-muted-fg">Sin repuestos reservados.</li>}
        </ul>
      </div>

      {msg && <p className="col-span-full text-xs text-muted-fg">{msg}</p>}
    </section>
  );
}

function WithdrawRow({
  component,
  warehouses,
  onWithdraw,
  disabled,
}: {
  component: Component;
  warehouses: Warehouse[];
  onWithdraw: (qty: number, warehouseId: string) => void;
  disabled: boolean;
}) {
  const [qty, setQty] = useState(String(Number(component.quantity_required) - Number(component.quantity_withdrawn)));
  const [warehouseId, setWarehouseId] = useState(component.warehouse_id ?? "");
  const pending = Number(component.quantity_required) - Number(component.quantity_withdrawn);

  if (component.status === "WITHDRAWN") {
    return (
      <li className="flex items-center justify-between text-xs">
        <span>{component.materials.description}</span>
        <StatusBadge label="Consumido" tone="success" />
      </li>
    );
  }

  const needsWarehouse = !component.warehouse_id;

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-2 text-xs last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <span>{component.materials.description}</span>
        <span className="text-muted-fg">
          {component.quantity_withdrawn}/{component.quantity_required} {component.unit_of_measure}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {needsWarehouse && (
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="rounded border border-border bg-surface px-1.5 py-1">
            <option value="">Almacén...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          step="0.01"
          min="0"
          max={pending}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 rounded border border-border bg-surface px-1.5 py-1"
        />
        <button
          disabled={disabled || !qty || Number(qty) <= 0 || (needsWarehouse && !warehouseId)}
          onClick={() => onWithdraw(Number(qty), warehouseId)}
          className="rounded border border-border px-2 py-1 hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Consumir
        </button>
      </div>
    </li>
  );
}
