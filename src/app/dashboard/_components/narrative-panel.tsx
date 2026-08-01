"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ScrollText } from "lucide-react";
import type { NarrativeDisplay } from "@/app/dashboard/types";
import { mergeNpcs } from "@/lib/npc-utils";

interface NarrativePanelProps {
  narrative: NarrativeDisplay | null;
  streamingText: string | null;
  availableActions: any[];
  activeActionId: string | null;
  actionLoading: boolean;
  cultivator: any;
  currentNPCs?: any[];
  familyMembers?: any[];
  isAwake?: boolean;
  currentLoc?: string;
  onExpandToggle: () => void;
  narrativeExpanded: boolean;
  onActionClick: (actionId: string, selectedNpcIds: string[]) => void;
  onActionSubmit: (actionId: string, input: string, selectedNpcIds: string[]) => void;
}

export const NarrativePanel = React.memo(function NarrativePanel({
  narrative,
  streamingText,
  availableActions,
  activeActionId,
  actionLoading,
  cultivator,
  currentNPCs = [],
  familyMembers = [],
  isAwake = false,
  currentLoc = "home",
  onExpandToggle,
  narrativeExpanded,
  onActionClick,
  onActionSubmit,
}: NarrativePanelProps) {
  const [draft, setDraft] = useState("");
  const [selectedNpcs, setSelectedNpcs] = useState<string[]>([]);

  useEffect(() => {
    setDraft("");
    setSelectedNpcs([]);
  }, [activeActionId, currentLoc]);

  const toggleNpc = useCallback((npcId: string) => {
    setSelectedNpcs((prev) =>
      prev.includes(npcId) ? prev.filter((id) => id !== npcId) : [...prev, npcId]
    );
  }, []);

  const handleSubmitAction = useCallback(
    (actionId: string) => {
      onActionSubmit(actionId, draft, selectedNpcs);
      setDraft("");
      setSelectedNpcs([]);
    },
    [draft, selectedNpcs, onActionSubmit]
  );

  const mergedNpcs = useMemo(
    () => mergeNpcs(familyMembers, currentNPCs),
    [familyMembers, currentNPCs]
  );

  const selectedNpcNames = useMemo(() => {
    return mergedNpcs.filter((npc: any) => selectedNpcs.includes(npc.name));
  }, [mergedNpcs, selectedNpcs]) as any[];

  const actionPlaceholder = useMemo(() => {
    if (selectedNpcNames.length === 1) {
      const npc = selectedNpcNames[0];
      return `对【${npc.name}】说些什么…`;
    }
    if (selectedNpcNames.length > 1) {
      const names = selectedNpcNames.map((n: any) => n.name).join("、");
      return `向【${names}】行动…`;
    }
    return "描述你想怎么做…";
  }, [selectedNpcNames]);

  const visibleActions = useMemo(
    () => availableActions.filter((a) => a.id !== "FREE").slice(0, 6),
    [availableActions]
  );
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
            {streamingText !== null ? "Streaming" : isAwake ? "Awake" : "Main Event"}
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
        {actionLoading && <p className="mb-3 text-xs text-gray-400">叙事生成中，请稍候…</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleActions.map((action) => {
            const isActive = activeActionId === action.id;
            const cant = cultivator.stamina < action.actionPointCost;
            const isLocked = action.locked;
            const lockReason = action.lockReason || "";
            const disabled = actionLoading || cant || isLocked;
            return (
              <div key={action.id} className="flex flex-col gap-1">
                <button
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onActionClick(action.id, selectedNpcs);
                    handleSubmitAction(action.id);
                  }}
                  className={`group flex items-center justify-between rounded-2xl border px-4 py-4 text-left shadow-sm transition-all hover:border-[#B83227] hover:bg-[#FDF2F0] ${
                    cant
                      ? "opacity-40"
                      : isLocked
                        ? "opacity-30"
                        : isActive
                          ? "border-[#B83227] bg-[#FDF2F0]"
                          : "border-[#EADCD0] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF4EB] text-amber-900/70 transition-colors group-hover:bg-[#B83227] group-hover:text-white">
                      <span className="text-base leading-none">{action.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#2C1E1E]">{action.name}</h4>
                      <p className="mt-0.5 text-[9px] text-gray-400">
                        {isLocked ? lockReason : "尝试行动"}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#D49B4B]">
                    -{action.actionPointCost}
                  </span>
                </button>
                {isActive && !actionLoading && (
                  <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => setSelectedNpcs([])}
                        className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] transition-colors ${
                          selectedNpcs.length === 0
                            ? "border-[#B83227] bg-[#FDF2F0] text-[#B83227]"
                            : "border-[#EADCD0] bg-white text-[#2C1E1E] hover:border-[#B83227]/40"
                        }`}
                      >
                        不指定 NPC
                      </button>
                      {mergedNpcs.map((npc: any) => {
                        const active = selectedNpcs.includes(npc.name);
                        return (
                          <button
                            key={npc._key}
                            type="button"
                            onClick={() => toggleNpc(npc.name)}
                            className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] transition-colors ${
                              active
                                ? "border-[#B83227] bg-[#FDF2F0] text-[#B83227]"
                                : "border-[#EADCD0] bg-white text-[#2C1E1E] hover:border-[#B83227]/40"
                            }`}
                          >
                            <span className="mr-1">
                              {npc._src === "family" ? "👨‍👩‍👧‍👦" : npc.avatar}
                            </span>
                            <span className="font-bold">{npc.name}</span>
                            {npc.age != null ? (
                              <span className="ml-1 font-normal opacity-70 text-[9px]">
                                ({npc.age}岁)
                              </span>
                            ) : null}
                            {npc._src !== "family" && isAwake && npc.realm ? (
                              <span className="ml-1 font-normal opacity-70 text-[9px]">
                                {npc.realm}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
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
});

const ACTION_CHIPS: Record<string, string[]> = {
  TALK: ["闲聊", "问候", "搭话", "打听"],
  TRAIN: ["切磋", "请教", "对练", "陪练"],
  EXPLORE: ["仔细观察", "四处搜寻", "翻找", "探索"],
  WORK: ["帮忙", "接活", "打听机会", "讨教经验"],
  STUDY: ["请教问题", "复习", "借笔记", "讨论"],
  DEFAULT: ["闲聊", "切磋", "请教", "陪陪", "帮忙", "探索"],
};

const Chips = React.memo(function Chips({
  actionId,
  onPick,
  disabled = false,
}: {
  actionId: string;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const items = ACTION_CHIPS[actionId] ?? ACTION_CHIPS.DEFAULT;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          className="rounded-full border border-[#EADCD0] bg-white px-2 py-1 text-[10px] text-[#2C1E1E] hover:border-[#B83227]/60 disabled:opacity-50"
        >
          {text}
        </button>
      ))}
    </div>
  );
});
