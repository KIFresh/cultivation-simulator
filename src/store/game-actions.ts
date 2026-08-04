import { safeJsonParse } from "@/lib/json-helper";
import { consumeNarrativeStream } from "@/lib/sse-client";
import { parseAttrs, deriveStoreFields } from "./game-helpers";
import { applyNarrativeResult } from "./game-narrative";
import { getActionById } from "@/lib/cultivation-data";
import type { CultivatorData, NarrativeDisplay } from "@/app/dashboard/types";
import type { GameStore } from "./game-store";

type StoreSet = (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void;

let lastRequest: { endpoint: string; body: Record<string, unknown> } | null = null;

export function initActions(set: StoreSet, get: () => GameStore) {
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
      set((state) => {
        const merged = { ...(state.cultivator || {}), ...data } as CultivatorData;
        const derived = deriveStoreFields(merged);
        return { ...derived };
      });
    },

    loadCultivator: async (userId: string) => {
      if (!userId) return;
      set({ userId });

      // Try cache first
      try {
        const { getCachedCultivator } = await import("@/lib/cache");
        const cached = await getCachedCultivator(userId);
        if (cached) {
          set((state) => ({ ...state, ...deriveStoreFields(cached), userId }));
        }
      } catch {
        // Cache miss is fine
      }

      // Then fetch fresh data
      try {
        const res = await fetch(`/api/cultivator?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const raw = data?.user?.cultivator ?? data?.cultivator ?? null;
        if (!raw) return;
        set((state) => ({ ...state, ...deriveStoreFields(raw), userId }));
      } catch {
        // Silent fail: keep cached data
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
      // 乐观叙事：AI 返回前先显示占位文本，首段流式内容到达时替换
      const actionName = getActionById(actionId)?.name || "行动";
      const optimistic =
        input && input.trim()
          ? `你决定${actionName}，${input.trim()}……`
          : `你开始了「${actionName}」，静下心来感受此刻……`;
      set({ actionLoading: true, narrativeError: null, streamingText: optimistic });
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
          let replaced = false;
          await consumeNarrativeStream(res, {
            onChunk: (c: string) =>
              set((s) => {
                if (!replaced) {
                  replaced = true;
                  return { streamingText: c };
                }
                return { streamingText: (s.streamingText || "") + c };
              }),
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
      // 乐观叙事：突破等待较长，先显示占位，首段流式到达后替换
      const optimistic = protector
        ? `你闭目凝神，在${protector}的护法下冲击瓶颈……`
        : "你闭目凝神，调动全身灵力冲击瓶颈……";
      set({ actionLoading: true, narrativeError: null, streamingText: optimistic });
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
          let replaced = false;
          await consumeNarrativeStream(res, {
            onChunk: (c: string) =>
              set((s) => {
                if (!replaced) {
                  replaced = true;
                  return { streamingText: c };
                }
                return { streamingText: (s.streamingText || "") + c };
              }),
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
          set((state) => ({
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
        if (data.cultivator) set((state) => ({ ...state, ...deriveStoreFields(data.cultivator) }));
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
          set((state) => ({
            ...state,
            ...deriveStoreFields(data.cultivator || state.cultivator),
            narrativeError: { message: "道消！叙事生成中断。", params: data.summary },
            narrativeRetrying: false,
          }));
          return;
        }
        set((state) => ({
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

    setNarrative: (narrative: NarrativeDisplay | null) => set({ narrative }),

    setLastActionResult: (result: Record<string, unknown> | null) => set({ lastActionResult: result }),

    setLocation: async (loc: string) => {
      const { userId, cultivator } = get();
      set((state) => ({ ...state, ...deriveStoreFields({ ...(cultivator || {}), location: loc }) }));
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