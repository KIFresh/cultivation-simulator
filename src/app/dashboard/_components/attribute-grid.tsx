"use client";

import React from "react";

const ATTR_INFO = [
  { key: "root", label: "根骨" },
  { key: "spirit", label: "神识" },
  { key: "insight", label: "悟性" },
  { key: "luck", label: "气运" },
  { key: "charm", label: "魅力" },
  { key: "mind", label: "道心" },
];

interface AttributeGridProps {
  attributes: Record<string, number>;
}

export const AttributeGrid = React.memo(function AttributeGrid({ attributes }: AttributeGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ATTR_INFO.map((a) => (
        <div key={a.key} className="rounded-2xl border border-[#EADCD0] bg-white p-3 text-center shadow-sm">
          <p className="text-[10px] text-gray-400">{a.label}</p>
          <p className="font-mono font-bold text-sm text-[#2C1E1E]">{Math.round(attributes[a.key] || 0)}</p>
        </div>
      ))}
    </div>
  );
});
