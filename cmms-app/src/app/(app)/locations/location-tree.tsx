"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface LocationNode {
  id: string;
  code: string;
  description: string;
  status: string;
  _count: { other_functional_locations: number; equipment: number };
}

interface PaginatedResponse<T> {
  data: T[];
}

export function LocationTreeNode({
  node,
  level,
  selectedId,
  onSelect,
}: {
  node: LocationNode;
  level: number;
  selectedId: string | null;
  onSelect: (node: LocationNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<LocationNode[] | null>(null);
  const hasChildren = node._count.other_functional_locations > 0;

  async function toggleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded && children === null) {
      const res = await apiFetch<PaginatedResponse<LocationNode>>(`/functional-locations?parentId=${node.id}&pageSize=200`);
      setChildren(res.data);
    }
    setExpanded((v) => !v);
  }

  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        onClick={() => onSelect(node)}
        style={{ paddingLeft: level * 14 + 6 }}
        className={`flex cursor-pointer items-center gap-1.5 rounded py-1 pr-2 text-xs ${
          isSelected ? "bg-info-bg text-info" : "text-foreground hover:bg-surface-muted"
        }`}
      >
        <button
          type="button"
          onClick={toggleExpand}
          className={`flex h-4 w-4 shrink-0 items-center justify-center ${hasChildren ? "text-muted-fg" : "invisible"}`}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="truncate">
          {node.code} <span className="text-muted-fg">— {node.description}</span>
        </span>
        {node._count.equipment > 0 && <span className="ml-auto shrink-0 text-[10px] text-muted-fg">{node._count.equipment}</span>}
      </div>
      {expanded && children?.map((c) => <LocationTreeNode key={c.id} node={c} level={level + 1} selectedId={selectedId} onSelect={onSelect} />)}
    </div>
  );
}
