"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";

interface Material {
  id: string;
  code: string;
  description: string;
}
interface Warehouse {
  id: string;
  code: string;
  description: string;
}

interface OrderItem {
  id: string;
  quantity_ordered: string;
  quantity_received: string;
  unit_cost: string | null;
  materials: Material;
  warehouses: Warehouse;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  purchase_order_items: OrderItem[];
}

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  REQUESTED: "neutral",
  APPROVED: "info",
  ORDERED: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};
const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  ORDERED: "Ordenada",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Patrón estándar de "fetch al montar/recargar": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch<PurchaseOrder[]>("/purchase-orders")
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [reloadToken]);

  async function receive(orderId: string, itemId: string, quantity: number) {
    await apiFetch(`/purchase-orders/${orderId}/items/${itemId}/receive`, { method: "POST", body: JSON.stringify({ quantity }) });
    setReloadToken((t) => t + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Órdenes de Compra</h1>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/purchasing/requisitions" className="text-accent hover:underline">
            Ver requisiciones →
          </Link>
          <button type="button" onClick={() => setShowModal(true)} className="rounded bg-accent px-2.5 py-1.5 font-medium text-accent-fg hover:bg-accent-hover">
            + Nueva orden de compra
          </button>
        </div>
      </div>

      <div className="rounded border border-border bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{o.code}</td>
                  <td className="px-4 py-2">{o.supplier_name}</td>
                  <td className="px-4 py-2">
                    <StatusBadge label={STATUS_LABELS[o.status] ?? o.status} tone={STATUS_TONE[o.status] ?? "neutral"} />
                  </td>
                  <td className="px-4 py-2">{new Date(o.order_date).toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} className="text-accent hover:underline">
                      {expandedId === o.id ? "Ocultar ítems" : "Ver ítems"}
                    </button>
                  </td>
                </tr>
                {expandedId === o.id && (
                  <tr className="bg-surface-muted">
                    <td colSpan={5} className="px-4 py-3">
                      <ItemsTable order={o} onReceive={receive} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-fg">
                  Sin órdenes de compra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateOrderModal
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

function ItemsTable({ order, onReceive }: { order: PurchaseOrder; onReceive: (orderId: string, itemId: string, qty: number) => Promise<void> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-muted-fg">
        <tr>
          <th className="py-1 font-medium">Material</th>
          <th className="py-1 font-medium">Almacén</th>
          <th className="py-1 font-medium">Pedido</th>
          <th className="py-1 font-medium">Recibido</th>
          <th className="py-1 font-medium">Recibir</th>
        </tr>
      </thead>
      <tbody>
        {order.purchase_order_items.map((item) => (
          <ItemRow key={item.id} orderId={order.id} item={item} onReceive={onReceive} />
        ))}
      </tbody>
    </table>
  );
}

function ItemRow({
  orderId,
  item,
  onReceive,
}: {
  orderId: string;
  item: OrderItem;
  onReceive: (orderId: string, itemId: string, qty: number) => Promise<void>;
}) {
  const pending = Number(item.quantity_ordered) - Number(item.quantity_received);
  const [qty, setQty] = useState(String(pending));
  const [busy, setBusy] = useState(false);

  return (
    <tr>
      <td className="py-1">
        {item.materials.code} — {item.materials.description}
      </td>
      <td className="py-1">{item.warehouses.code}</td>
      <td className="py-1">{item.quantity_ordered}</td>
      <td className="py-1">{item.quantity_received}</td>
      <td className="py-1">
        {pending > 0 ? (
          <span className="flex items-center gap-1">
            <input type="number" step="0.01" min="0" max={pending} value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 rounded border border-border bg-surface px-1.5 py-1" />
            <button
              disabled={busy || Number(qty) <= 0}
              onClick={async () => {
                setBusy(true);
                await onReceive(orderId, item.id, Number(qty));
                setBusy(false);
              }}
              className="rounded border border-border px-2 py-1 hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Recibir
            </button>
          </span>
        ) : (
          <StatusBadge label="Completo" tone="success" />
        )}
      </td>
    </tr>
  );
}

interface DraftItem {
  materialId: string;
  warehouseId: string;
  quantity: string;
  unitCost: string;
}

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [code, setCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ materialId: "", warehouseId: "", quantity: "1", unitCost: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
    apiFetch<Warehouse[]>("/warehouses").then(setWarehouses);
  }, []);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          code,
          supplier_name: supplierName,
          items: items.map((it) => ({
            material_id: it.materialId,
            warehouse_id: it.warehouseId,
            quantity_ordered: Number(it.quantity),
            unit_cost: it.unitCost ? Number(it.unitCost) : undefined,
          })),
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
    <Modal title="Nueva orden de compra" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            Código
            <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Proveedor
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
          </label>
        </div>

        <p className="mt-1 font-medium text-foreground">Ítems</p>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-4 gap-1.5">
            <select value={item.materialId} onChange={(e) => updateItem(i, { materialId: e.target.value })} required className="rounded border border-border bg-surface px-1.5 py-1.5">
              <option value="">Material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code}
                </option>
              ))}
            </select>
            <select value={item.warehouseId} onChange={(e) => updateItem(i, { warehouseId: e.target.value })} required className="rounded border border-border bg-surface px-1.5 py-1.5">
              <option value="">Almacén...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Cant."
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
              className="rounded border border-border bg-surface px-1.5 py-1.5"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Costo unit."
              value={item.unitCost}
              onChange={(e) => updateItem(i, { unitCost: e.target.value })}
              className="rounded border border-border bg-surface px-1.5 py-1.5"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { materialId: "", warehouseId: "", quantity: "1", unitCost: "" }])}
          className="self-start text-accent hover:underline"
        >
          + Agregar ítem
        </button>

        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear orden
        </button>
      </form>
    </Modal>
  );
}
