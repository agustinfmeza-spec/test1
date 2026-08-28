"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

interface MaterialDetail {
  id: string;
  code: string;
  description: string;
  material_type: string;
  unit_of_measure: string;
  unit_cost: string;
  criticality: number | null;
  active: boolean;
  stock: { id: string; quantity_on_hand: string; quantity_reserved: string; min_stock: string; reorder_point: string; warehouses: { code: string; description: string } }[];
}

export default function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MaterialDetail>(`/materials/${id}`).then(setMaterial).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!material) return <p className="text-sm text-muted-fg">Cargando...</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/materials" className="text-xs text-accent hover:underline">
        ← Volver al listado
      </Link>

      <div className="rounded border border-border bg-surface p-4">
        <h1 className="text-base font-semibold text-foreground">
          {material.code} — {material.description}
        </h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-fg">Unidad de medida</dt>
            <dd>{material.unit_of_measure}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Costo unitario</dt>
            <dd>{material.unit_cost}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Criticidad</dt>
            <dd>{material.criticality ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-fg">Estado</dt>
            <dd>{material.active ? "Activo" : "Inactivo"}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">Stock por almacén</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-fg">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Almacén</th>
              <th className="px-4 py-2 font-medium">En mano</th>
              <th className="px-4 py-2 font-medium">Reservado</th>
              <th className="px-4 py-2 font-medium">Mínimo</th>
              <th className="px-4 py-2 font-medium">Punto de pedido</th>
            </tr>
          </thead>
          <tbody>
            {material.stock.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  {s.warehouses.code} — {s.warehouses.description}
                </td>
                <td className={`px-4 py-2 font-medium ${Number(s.quantity_on_hand) <= Number(s.reorder_point) ? "text-danger" : ""}`}>
                  {s.quantity_on_hand}
                </td>
                <td className="px-4 py-2">{s.quantity_reserved}</td>
                <td className="px-4 py-2">{s.min_stock}</td>
                <td className="px-4 py-2">{s.reorder_point}</td>
              </tr>
            ))}
            {material.stock.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-muted-fg">
                  Sin stock registrado en ningún almacén.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
