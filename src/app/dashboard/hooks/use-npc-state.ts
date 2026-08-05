"use client";

import { useState, useCallback } from "react";
import type { CultivatorData } from "../types";
import type { NPC } from "@/lib/cultivation-data";

const STREAM_SPEED = 25;

type NpcChatMessage = { role: string; content: string };
type SyncData = Record<string, unknown>;

export interface NpcChatState {
  npcChat: NPC | null;
  npcMessage: string;
  npcChatHistory: NpcChatMessage[];
  setNpcChat: (chat: NPC | null) => void;
  setNpcMessage: (msg: string) => void;
  setNpcChatHistory: (history: NpcChatMessage[]) => void;
  resetNpcChat: () => void;
  sendNpcMessage: (
    msg: string,
    npcChat: NPC,
    history: NpcChatMessage[],
    userId: string | null,
    cultivator: CultivatorData | null,
    onDataSync: (data: SyncData) => void
  ) => Promise<SyncData | undefined>;
}

export function useNpcChat(onDataSync: (data: SyncData) => void): NpcChatState {
  const [npcChat, setNpcChat] = useState<NPC | null>(null);
  const [npcMessage, setNpcMessage] = useState("");
  const [npcChatHistory, setNpcChatHistory] = useState<NpcChatMessage[]>([]);

  const resetNpcChat = useCallback(() => {
    setNpcChat(null);
    setNpcMessage("");
    setNpcChatHistory([]);
  }, []);

  const sendNpcMessage = useCallback(
    async (
      msg: string,
      chat: NPC,
      history: NpcChatMessage[],
      userId: string | null,
      cultivator: CultivatorData | null,
      sync: (data: SyncData) => void
    ) => {
      if (!userId || !cultivator || !chat) return;
      if (cultivator.stamina < 1) {
        return;
      }
      const res = await fetch(`/api/npc-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: msg,
          npcName: chat.name,
          history: [...history, { role: "player", content: msg }],
        }),
      });
      const data = (await res.json()) as SyncData;
      if (!res.ok) {
        return data;
      }
      if (data.cultivator) sync({ cultivator: data.cultivator, syncFull: true });
      if (data.goldChanged) return;
      if (data.itemChanged) return;
      return data;
    },
    []
  );

  return {
    npcChat,
    npcMessage,
    npcChatHistory,
    setNpcChat,
    setNpcMessage,
    setNpcChatHistory,
    resetNpcChat,
    sendNpcMessage,
  };
}
