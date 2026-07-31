"use client";

import React from "react";

interface ActionInputRowProps {
  actionId: string;
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (actionId: string) => void;
}

export const ActionInputRow = React.memo(function ActionInputRow({
  actionId,
  value,
  loading,
  onChange,
  onSubmit,
}: ActionInputRowProps) {
  console.log("[ActionInputRow] render", { actionId, value, loading });
  return (
    <div className="flex gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
      <input
        value={value}
        disabled={loading}
        onChange={(e) => {
          const next = e.target.value;
          console.log("[ActionInputRow] onChange", next);
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(actionId);
          }
        }}
        className="h-7 flex-1 rounded-lg border border-[#EADCD0] bg-white px-2 text-[11px] text-[#2C1E1E] focus:outline-none focus:border-[#B83227] disabled:opacity-50"
        placeholder="描述你想怎么做…"
        autoFocus
      />
      <button
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B83227] text-white hover:bg-[#7A1F18] disabled:opacity-50"
        disabled={loading}
        onClick={(e) => {
          e.preventDefault();
          onSubmit(actionId);
        }}
      >
        <span className="text-xs">➤</span>
      </button>
    </div>
  );
});
