"use client";

import React, { useState } from "react";
import { ScrollText } from "lucide-react";
import type { NarrativeDisplay } from "@/app/dashboard/types";

interface NarrativePanelProps {
  narrative: NarrativeDisplay | null;
  streamingText: string | null;
  availableActions: any[];
  activeActionId: string | null;
  actionLoading: boolean;
  actionInput: string;
  cultivator: any;
  onExpandToggle: () => void;
  narrativeExpanded: boolean;
  onActionClick: (actionId: string) => void;
  onActionSubmit: (actionId: string) => void;
  onActionInputChange: (value: string) => void;
}

export function NarrativePanel({
  narrative,
  streamingText,
  availableActions,
  activeActionId,
  actionLoading,
  actionInput,
  cultivator,
  onExpandToggle,
  narrativeExpanded,
  onActionClick,
  onActionSubmit,
  onActionInputChange,
}: NarrativePanelProps) {
  return (
    <div className="rounded-3xl border border-[#EADCD0] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b border-[#EADCD0] pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FDF2F0] text-[#B83227]">
          <ScrollText className="h-4 w-4" />
        </div>
        <div>
          <h3 className="calligraphy text-xl font-bold tracking-widest text-[#2C1E1E]">
            {streamingText !== null ? "✍️ 叙事流转中…" : narrative?.title}
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D49B4B]">
            {streamingText !== null ? "Streaming" : "Main Event"}
          </p>
        </div>
      </div>

      <div className="relative group">
        {streamingText !== null ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed tracking-wide text-amber-950/80">
            {streamingText}
            <span className="ml-0.5 inline-block h-4 w-1.5 align-middle bg-[#B83227] animate-pulse" />
          </p>
        ) : (
          <p
            className={`text-sm leading-relaxed tracking-wide text-amber-950/80 ${
              !narrativeExpanded && (narrative?.narrative?.length || 0) > 150 ? "line-clamp-4" : ""
            }`}
          >
            {narrative?.narrative}
          </p>
        )}
        {streamingText === null && (narrative?.narrative?.length || 0) > 150 && (
          <button
            onClick={onExpandToggle}
            className="mt-3 flex items-center gap-1 text-xs font-bold text-[#B83227] hover:underline"
          >
            <span>{narrativeExpanded ? "▲ 收起全文" : "▼ 展开全文"}</span>
          </button>
        )}
      </div>

      {streamingText === null && narrative?.hint && (
        <p className="mt-3 text-xs italic text-gray-400">💡 {narrative.hint}</p>
      )}

      <div className="mt-8">
        <p className="mb-4 flex items-center gap-1 text-[10px] font-bold tracking-widest text-gray-400">
          <span className="h-[1px] w-4 bg-red-300" />
          当下抉择
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {availableActions.filter((a) => a.id !== "FREE").slice(0, 6).map((action) => {
            const isActive = activeActionId === action.id;
            const cant = cultivator.stamina < action.actionPointCost;
            return (
              <div key={action.id} className="flex flex-col gap-1">
                <button
                  disabled={actionLoading || cant}
                  onClick={() => onActionClick(action.id)}
                  className={`group flex items-center justify-between rounded-2xl border px-4 py-4 text-left shadow-sm transition-all hover:border-[#B83227] hover:bg-[#FDF2F0] ${
                    cant ? "opacity-40" : isActive ? "border-[#B83227] bg-[#FDF2F0]" : "border-[#EADCD0] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF4EB] text-amber-900/70 transition-colors group-hover:bg-[#B83227] group-hover:text-white">
                      <span className="text-base leading-none">{action.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#2C1E1E]">{action.name}</h4>
                      <p className="mt-0.5 text-[9px] text-gray-400">尝试行动</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#D49B4B]">-{action.actionPointCost}</span>
                </button>
                {isActive && (
                  <div className="flex gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <input
                      value={actionInput}
                      onChange={(e) => onActionInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onActionSubmit(action.id);
                      }}
                      className="h-7 flex-1 rounded-lg border border-[#EADCD0] bg-white px-2 text-[11px] text-[#2C1E1E] focus:outline-none focus:border-[#B83227]"
                      placeholder="描述你想怎么做…"
                      disabled={actionLoading}
                      autoFocus
                    />
                    <button
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B83227] text-white hover:bg-[#7A1F18] disabled:opacity-50"
                      disabled={actionLoading}
                      onClick={() => onActionSubmit(action.id)}
                    >
                      <span className="text-xs">➤</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {availableActions.filter((a) => a.id !== "FREE").length === 0 && (
          <p className="py-2 text-center text-xs text-gray-400">当前无可用的行动</p>
        )}
      </div>
    </div>
  );
}
