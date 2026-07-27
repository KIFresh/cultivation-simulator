"use client";

import { useState, useCallback } from "react";
import type { CultivatorData } from "../types";

const STREAM_SPEED = 25;

export interface NpcChatState {
  npcChat: any;
  npcMessage: string;
  npcChatHistory: any[];
  setNpcChat: (chat: any) => void;
  setNpcMessage: (msg: string) => void;
  setNpcChatHistory: (history: any[]) => void;
  resetNpcChat: () => void;
  sendNpcMessage: (
    msg: string,
    npcChat: any,
    history: any[],
    userId: string | null,
    cultivator: CultivatorData | null,
    onDataSync: (data: any) => void
  ) => Promise<void>;
}

export function useNpcChat(onDataSync: (data: any) => void): NpcChatState {
  const [npcChat, setNpcChat] = useState<any>(null);
  const [npcMessage, setNpcMessage] = useState("");
  const [npcChatHistory, setNpcChatHistory] = useState<any[]>([]);

  const resetNpcChat = useCallback(() => {
    setNpcChat(null);
    setNpcMessage("");
    setNpcChatHistory([]);
  }, []);

  const sendNpcMessage = useCallback(
    async (
      msg: string,
      chat: any,
      history: any[],
      userId: string | null,
      cultivator: CultivatorData | null,
      sync: (data: any) => void
    ) => {
      if (!userId || !cultivator || !chat) return;
      if (cultivator.stamina < 2) {
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
      const data = await res.json();
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
