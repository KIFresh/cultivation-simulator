"use client";

import React from "react";
import { useGameStore } from "@/store";
import { isAwakened, ATTR_INFO } from "@/lib/cultivation-data";

interface AttributeGridProps {
  attributes: Record<string, number>;
}

export const AttributeGrid = React.memo(function AttributeGrid({ attributes }: AttributeGridProps) {
  const cultivator = useGameStore((s) => s.cultivator);
  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;
  return (
    <div className="grid grid-cols-3 gap-3">
      {ATTR_INFO.map((a) => (
        <div
          key={a.key}
          title={a.description}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-center shadow-sm"
        >
          <p className="text-[10px] text-gray-400">
            {a.key === "spirit" && !isAwake ? "感知" : a.label}
          </p>
          <p className="font-mono font-bold text-sm text-[var(--foreground)]">
            {Math.round(attributes[a.key] || 0)}
          </p>
        </div>
      ))}
    </div>
  );
});
