"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface NpcChatPanelProps {
  npc: {
    name: string;
    avatar: string;
    realm?: string;
    greeting: string;
  };
  npcChatHistory: { role: string; content: string }[];
  npcMessage: string;
  cultivatorStamina: number;
  onSend: (message: string) => void;
  onMessageChange: (value: string) => void;
  onClose: () => void;
}

export function NpcChatPanel({
  npc,
  npcChatHistory,
  npcMessage,
  cultivatorStamina,
  onSend,
  onMessageChange,
  onClose,
}: NpcChatPanelProps) {
  return (
    <div className="silk-card rounded-3xl p-6">
      <div className="flex flex-row items-center justify-between pb-2">
        <p className="text-xs text-[var(--foreground)] font-bold">
          {npc.avatar} 与{npc.name}交谈
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-[var(--destructive)] text-xs">
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-[var(--foreground)]">
          {npcChatHistory.length === 0 && <p className="text-gray-400 italic">{npc.greeting}</p>}
          {npcChatHistory.map((h, i) => (
            <p
              key={i}
              className={h.role === "player" ? "text-right text-[var(--destructive)]" : "text-[var(--foreground)]"}
            >
              {h.content}
            </p>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={npcMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && npcMessage.trim() && cultivatorStamina >= 1) {
                onSend(npcMessage);
              }
            }}
            placeholder="说点什么...（消耗1行动力）"
            className="flex-1 h-7 text-[11px] bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-2 focus:outline-none focus:border-[var(--destructive)]"
          />
          <button
            className="h-7 w-7 bg-[var(--destructive)] hover:bg-[var(--primary)] shrink-0 text-white rounded-lg flex items-center justify-center disabled:opacity-50"
            disabled={!npcMessage.trim() || cultivatorStamina < 1}
            onClick={() => onSend(npcMessage)}
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
