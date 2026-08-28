"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";

interface Material {
  id: string;
  code: string;
  description: string;
}

interface Requisition {
  id: string;
  code: string;
  status: string;
  requested_date: string;
  purchase_requisition_items: { id: string; quantity: string; materials: Material }[];
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

export default function RequisitionsPage() {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Patrón estándar de "fetch al montar/recargar": ver justificación en work-orders/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch<Requisition[]>("/purchase-requisitions")
      .then(setRows)
      .finally(() => setLoading(false));
  }, [reloadToken]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">Requisiciones de Compra</h1>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/purchasing/orders" className="text-accent hover:underline">
            Ver órdenes de compra →
          </Link>
          <button type="button" onClick={() => setShowModal(true)} className="rounded bg-accent px-2.5 py-1.5 font-medium text-accent-fg hover:bg-accent-hover">
            + Nueva requisición
          </button>
        </div>
      </div>

      <div className="rounded border border-border bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Materiales</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{r.code}</td>
                <td className="px-4 py-2">{r.purchase_requisition_items.map((i) => `${i.materials.code} (${i.quantity})`).join(", ")}</td>
                <td className="px-4 py-2">
                  <StatusBadge label={STATUS_LABELS[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
                </td>
                <td className="px-4 py-2">{new Date(r.requested_date).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-fg">
                  Sin requisiciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateRequisitionModal
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

function CreateRequisitionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [code, setCode] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Material[] }>("/materials?pageSize=200").then((res) => setMaterials(res.data));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/purchase-requisitions", {
        method: "POST",
        body: JSON.stringify({ code, items: [{ material_id: materialId, quantity: Number(quantity) }] }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nueva requisición" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Material
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} required className="rounded border border-border bg-surface px-2 py-1.5">
            <option value="">Seleccionar...</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Cantidad
          <input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5" />
        </label>
        {error && <p className="text-danger">{error}</p>}
        <button disabled={busy} className="mt-1 rounded bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-50">
          Crear
        </button>
      </form>
    </Modal>
  );
}
