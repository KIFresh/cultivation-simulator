import { safeJsonParse } from "@/lib/json-helper";
import { consumeNarrativeStream } from "@/lib/sse-client";
import { parseAttrs, deriveStoreFields } from "./game-helpers";
import { applyNarrativeResult } from "./game-narrative";
import type { CultivatorData } from "@/app/dashboard/types";

let lastRequest: { endpoint: string; body: Record<string, unknown> } | null = null;

export function initActions(set: (partial: any) => void, get: () => any) {
  return {
    setUserId: (id: string | null) => set({ userId: id }),

    setCultivator: (data: Partial<CultivatorData> | null) => {
      if (!data) {
        set({
          cultivator: null,
          gold: 0,
          inventory: [],
          location: null,
          unlockedLocations: null,
          availableActions: [],
          canBreakthrough: false,
        });
        return;
      }
      set((state: any) => {
        const merged = { ...(state.cultivator || {}), ...data } as CultivatorData;
        const derived = deriveStoreFields(merged);
        return { ...derived };
      });
    },

    loadCultivator: async (userId: string) => {
      if (!userId) return;
      set({ userId });
      try {
        const res = await fetch(`/api/cultivator?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const raw = data?.user?.cultivator ?? data?.cultivator ?? null;
        if (!raw) return;
        set((state: any) => ({ ...state, ...deriveStoreFields(raw), userId }));
      } catch {
        // 静默失败：保留现有状态
      }
    },

    bootstrap: () => {
      if (typeof window === "undefined") return;
      const id = window.localStorage.getItem("userId");
      if (id) {
        void get().loadCultivator(id);
      }
    },

    performAction: async (actionId: string, input?: string, selectedNpcIds: string[] = []) => {
      const { userId, cultivator, actionLoading } = get();
      if (!userId) throw new Error("未找到用户，请先创建修炼者");
      if (actionLoading) return;
      set({ actionLoading: true, narrativeError: null, streamingText: "" });
      let familyData: Record<string, unknown> | null = null;
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("family") : null;
        if (raw) familyData = JSON.parse(raw);
      } catch {}
      const npcIdsForAction = selectedNpcIds?.length ? selectedNpcIds : undefined;
      const npcNames = npcIdsForAction;
      const body = {
        actionId,
        freeInput: input,
        worldId: cultivator?.worldId || "earth",
        family: familyData,
        attributes: parseAttrs(cultivator?.attributes),
        ...(npcIdsForAction?.length ? { npcIds: npcIdsForAction } : {}),
        ...(npcNames?.length ? { npcNames } : {}),
      };
      lastRequest = { endpoint: "/api/action?stream=true", body };
      try {
        const res = await fetch("/api/action?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/event-stream")) {
          await consumeNarrativeStream(res, {
            onChunk: (c: string) => set((s: any) => ({ streamingText: (s.streamingText || "") + c })),
            onDone: (data: Record<string, unknown>) => applyNarrativeResult(set, data),
            onError: (e: Error | { message?: string }) =>
              set({
                actionLoading: false,
                streamingText: null,
                narrativeError: { message: e?.message || "叙事生成失败" },
              }),
          });
        } else {
          applyNarrativeResult(set, await res.json());
        }
      } catch (e) {
        set({
          actionLoading: false,
          streamingText: null,
          narrativeError: { message: e instanceof Error ? e.message : "行动执行失败" },
        });
      }
    },

    breakthrough: async (protector?: string) => {
      const { userId, actionLoading } = get();
      if (!userId) throw new Error("未找到用户，请先创建修炼者");
      if (actionLoading) return;
      set({ actionLoading: true, narrativeError: null, streamingText: "" });
      const body = { userId, protector };
      lastRequest = { endpoint: "/api/breakthrough?stream=true", body };
      try {
        const res = await fetch("/api/breakthrough?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/event-stream")) {
          await consumeNarrativeStream(res, {
            onChunk: (c: string) => set((s: any) => ({ streamingText: (s.streamingText || "") + c })),
            onDone: (data: Record<string, unknown>) => applyNarrativeResult(set, data),
            onError: (e: Error | { message?: string }) =>
              set({
                actionLoading: false,
                streamingText: null,
                narrativeError: { message: e?.message || "叙事生成失败" },
              }),
          });
        } else {
          applyNarrativeResult(set, await res.json());
        }
      } catch (e) {
        set({
          actionLoading: false,
          streamingText: null,
          narrativeError: { message: e instanceof Error ? e.message : "突破失败" },
        });
      }
    },

    advanceQuarter: async () => {
      const { userId, cultivator, actionLoading } = get();
      if (!userId) throw new Error("未找到用户，请先创建修炼者");
      if (actionLoading) return;
      set({ actionLoading: true, narrativeError: null });
      const body = {
        worldId: cultivator?.worldId || "earth",
      };
      lastRequest = { endpoint: "/api/advance-quarter", body };
      try {
        const res = await fetch("/api/advance-quarter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 409) {
          set({ actionLoading: false, narrativeError: { message: "状态已变化，已刷新最新进度" } });
          if (userId) get().loadCultivator(userId);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.daoXiao) {
          set((state: any) => ({
            ...state,
            ...(data.cultivator ? deriveStoreFields(data.cultivator) : {}),
            actionLoading: false,
            narrativeError: { message: "道消！时序流转中断。", params: data.summary },
          }));
          return;
        }
        applyNarrativeResult(set, data);
      } catch (e) {
        set({
          actionLoading: false,
          narrativeError: { message: e instanceof Error ? e.message : "推进季度失败" },
        });
      }
    },

    useItem: async (itemId: string, quantity = 1) => {
      const { userId, actionLoading } = get();
      if (!userId) throw new Error("未找到用户，请先创建修炼者");
      if (actionLoading) return;
      set({ actionLoading: true, narrativeError: null });
      try {
        const res = await fetch("/api/cultivator/use-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, itemId, quantity }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.cultivator) set((state: any) => ({ ...state, ...deriveStoreFields(data.cultivator) }));
        set({ actionLoading: false });
      } catch (e) {
        set({
          actionLoading: false,
          narrativeError: { message: e instanceof Error ? e.message : "使用物品失败" },
        });
      }
    },

    retryNarrative: async () => {
      if (!lastRequest) return;
      set({ narrativeRetrying: true, narrativeError: null });
      try {
        const res = await fetch(lastRequest.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lastRequest.body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.daoXiao) {
          set((state: any) => ({
            ...state,
            ...deriveStoreFields(data.cultivator || state.cultivator),
            narrativeError: { message: "道消！叙事生成中断。", params: data.summary },
            narrativeRetrying: false,
          }));
          return;
        }
        set((state: any) => ({
          ...state,
          ...deriveStoreFields(data.cultivator || state.cultivator),
          narrative: data.narrative ?? state.narrative,
          narrativeRetrying: false,
        }));
      } catch (e) {
        set({
          narrativeError: { message: e instanceof Error ? e.message : "重试失败" },
          narrativeRetrying: false,
        });
      }
    },

    setNarrative: (narrative: any) => set({ narrative }),

    setLastActionResult: (result: any) => set({ lastActionResult: result }),

    setLocation: async (loc: string) => {
      const { userId, cultivator } = get();
      set((state: any) => ({ ...state, ...deriveStoreFields({ ...(cultivator || {}), location: loc }) }));
      if (userId) {
        try {
          await fetch("/api/cultivator", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, location: loc }),
          });
        } catch {
          // 忽略持久化失败
        }
      }
    },
  };
}