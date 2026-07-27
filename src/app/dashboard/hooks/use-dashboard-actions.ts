import { useCallback, useState } from "react";
import type { CultivatorData, NarrativeDisplay } from "@/app/dashboard/types";
import { consumeNarrativeStream } from "@/lib/sse-client";
import { toast } from "sonner";

export interface UseDashboardActionsOptions {
  userId: string | null;
  cultivator: CultivatorData | null;
  currentLoc: string;
  attributes: Record<string, number>;
  schoolRank: string;
  occupation: string;
  unlockedLocs: string[];
  actionLoading: boolean;
  onNarrative?: (data: {
    narrative: NarrativeDisplay;
    cultivator?: CultivatorData;
    awakenEvent?: { title: string; narrative: string };
    expGained?: number;
    techniqueEvents?: any[];
  }) => void;
  onAdvance?: (data: any) => void;
  onCultivatorUpdate?: (c: CultivatorData) => void;
  onActionError?: (message: string) => void;
  onActionSuccess?: () => void;
}

export interface UseDashboardActionsResult {
  performAction: (actionId: string, input?: string) => Promise<void>;
  advanceSeason: () => Promise<void>;
  handleBreakthrough: () => Promise<void>;
  handleUseItem: (itemId: string) => Promise<void>;
  sendNpcMessage: (msg: string, npcChat: any, npcChatHistory: { role: string; content: string }[]) => Promise<void>;
}

export function useDashboardActions({
  userId,
  cultivator,
  currentLoc,
  attributes,
  schoolRank,
  occupation,
  unlockedLocs,
  actionLoading,
  onNarrative,
  onAdvance,
  onCultivatorUpdate,
  onActionError,
  onActionSuccess,
}: UseDashboardActionsOptions): UseDashboardActionsResult {
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const syncCultivator = useCallback(
    (c: CultivatorData) => {
      onCultivatorUpdate?.(c);
    },
    [onCultivatorUpdate],
  );

  const applyNarrativeResponse = useCallback(
    (data: any) => {
      const narrative: NarrativeDisplay = {
        title: data.narrative.title,
        narrative: data.narrative.narrative,
        mood: data.narrative.mood,
        hint: data.narrative.hint,
      };
      onNarrative?.({
        narrative,
        cultivator: data.cultivator,
        awakenEvent: data.awakenEvent,
        expGained: data.expGained,
        techniqueEvents: data.techniqueEvents,
      });
    },
    [onNarrative],
  );

  const performAction = useCallback(
    async (actionId: string, input?: string) => {
      if (!userId || !cultivator || actionLoading) return;
      let familyData: Record<string, any> | null = null;
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("family") : null;
        if (raw) familyData = JSON.parse(raw);
      } catch {}

      const res = await fetch("/api/action?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
        body: JSON.stringify({
          actionId,
          freeInput: input || undefined,
          worldId: cultivator.worldId,
          family: familyData,
          attributes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onActionError?.(err.error || "行动失败");
        return;
      }

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/event-stream")) {
        await consumeNarrativeStream(res, {
          onChunk: (c) => setStreamingText((prev) => (prev || "") + c),
          onDone: (d) => {
            setStreamingText(null);
            if (!d) return;
            applyNarrativeResponse(d);
            if (d.cultivator) syncCultivator(d.cultivator);
            onActionSuccess?.();
          },
          onError: (e) => {
            setStreamingText(null);
            onActionError?.(e?.message || "行动叙事生成失败，请重试");
          },
        });
        return;
      }

      const data = await res.json();
      setStreamingText(null);
      if (data.updatedFamily) {
        try {
          window.localStorage.setItem("family", JSON.stringify(data.updatedFamily));
        } catch {}
      }
      applyNarrativeResponse(data);
      if (data.cultivator) syncCultivator(data.cultivator);
      onActionSuccess?.();
    },
    [userId, cultivator, actionLoading, attributes, applyNarrativeResponse, syncCultivator, onActionError, onActionSuccess],
  );

  const advanceSeason = useCallback(async () => {
    if (!userId || !cultivator) return;
    const res = await fetch("/api/advance-quarter", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
      body: JSON.stringify({ worldId: cultivator.worldId, attributes, schoolRank, occupation }),
    });
    const data = await res.json();
    if (!res.ok) {
      onActionError?.(data.error || "季节推进失败");
      return;
    }
    onAdvance?.(data);
    if (data.cultivator) syncCultivator(data.cultivator);
    onActionSuccess?.();
  }, [userId, cultivator, attributes, schoolRank, occupation, syncCultivator, onAdvance, onActionError, onActionSuccess]);

  const handleBreakthrough = useCallback(async () => {
    if (!userId || !cultivator) return;
    const res = await fetch("/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
      body: JSON.stringify({ type: "BREAKTHROUGH", worldId: cultivator.worldId }),
    });
    const data = await res.json();
    if (!res.ok) {
      onActionError?.(data.error || "突破失败");
      return;
    }
    applyNarrativeResponse(data);
    if (data.cultivator) syncCultivator(data.cultivator);
    onActionSuccess?.();
  }, [userId, cultivator, applyNarrativeResponse, syncCultivator, onActionError, onActionSuccess]);

  const handleUseItem = useCallback(async (itemId: string) => {
    if (!userId) return;
    const res = await fetch("/api/cultivator/use-item", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
      body: JSON.stringify({ itemId, quantity: 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      onActionError?.(data.error || "使用失败");
      return;
    }
    if (data.cultivator) syncCultivator(data.cultivator);
    if (data.message) toast.success(data.message);
    onActionSuccess?.();
  }, [userId, syncCultivator, onActionError, onActionSuccess]);

  const sendNpcMessage = useCallback(
    async (msg: string, npcChat: any, npcChatHistory: { role: string; content: string }[]) => {
      if (!userId || !cultivator || !npcChat || cultivator.stamina < 1) return;
      const res = await fetch("/api/npc-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId || "" },
        body: JSON.stringify({
          message: msg,
          npcName: npcChat.name,
          history: [...npcChatHistory, { role: "player", content: msg }],
        }),
      });
      const data = await res.json();
      if (data.cultivator) syncCultivator(data.cultivator);
      return data;
    },
    [userId, cultivator, syncCultivator],
  );

  return { performAction, advanceSeason, handleBreakthrough, handleUseItem, sendNpcMessage };
}
