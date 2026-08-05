"use client";

import React from "react";

interface StatusGaugeProps {
  label: string;
  value: number;
  max: number;
  hint?: string;
}

export const StatusGauge = React.memo(function StatusGauge({
  label,
  value,
  max,
  hint,
}: StatusGaugeProps) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <p className="font-mono font-bold text-sm text-[var(--foreground)]">{Math.max(0, Math.round(value))}</p>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--destructive)] transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
});
