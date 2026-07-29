"use client";

import React from "react";

interface StatusGaugeProps {
  label: string;
  value: number;
  max: number;
  hint?: string;
}

export const StatusGauge = React.memo(function StatusGauge({ label, value, max, hint }: StatusGaugeProps) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="rounded-2xl border border-[#EADCD0] bg-white/80 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <p className="font-mono font-bold text-sm text-[#2C1E1E]">{Math.max(0, Math.round(value))}</p>
      <div className="mt-1 h-1.5 rounded-full bg-[#FAF4EB]">
        <div
          className="h-full rounded-full bg-[#B83227] transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
});
