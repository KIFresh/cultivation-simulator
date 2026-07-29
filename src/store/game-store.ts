"use client";

import { create } from "zustand";
import { getAvailableActions, canBreakthrough } from "@/lib";
import type { Action } from "@/lib/cultivation-data";
import { safeJsonParse } from "@/lib/json-helper";
import type {
  CultivatorData,
  NarrativeDisplay,
  FamilyMember,
} from "@/app/dashboard/types";
import type { InventoryItem } from "@/lib";
import { consumeNarrativeStream } from "@/lib/sse-client";

export type { CultivatorData, NarrativeDisplay, FamilyMember } from "@/app/dashboard/types";
export type { InventoryItem } from "@/lib";

let lastRequest: { endpoint: string; body: Record<string, unknown> } | null = null;

export interface NarrativeErrorPayload {
  type?: string;
  code?: string;
  message?: string;
  gameEventId?: string | null;
  params?: unknown;
}

export interface GameStore {
  userId: string | null;
  cultivator: CultivatorData | null;
  availableActions: Action[];
  actionLoading: boolean;
  canBreakthrough: boolean;
  inventory: InventoryItem[];
  gold: number;
  narrative: NarrativeDisplay | null;
  streamingText: string | null;
  narrativeError: NarrativeErrorPayload | null;
  narrativeRetrying: boolean;
  location: string | null;
  unlockedLocations: string[] | null;
  currentNPCs: any[];
  /** 最近一次 action 完成的完整结果，供 dashboard 订阅处理 side-effect */
  lastActionResult: Record<string, any> | null;

  setUserId: (id: string | null) => void;
  setCultivator: (data: Partial<CultivatorData> | null) => void;
  loadCultivator: (userId: string) => Promise<void>;
  bootstrap: () => void;
  performAction: (actionId: string, input?: string, selectedNpcIds?: string[]) => Promise<void>;
  breakthrough: (protector?: string) => Promise<void>;
  advanceQuarter: () => Promise<void>;
  useItem: (itemId: string, quantity?: number) => Promise<void>;
  retryNarrative: () => Promise<void>;
  setLocation: (loc: string) => Promise<void>;
  setNarrative: (narrative: NarrativeDisplay | null) => void;
  setLastActionResult: (result: Record<string, any> | null) => void;
}

function parseAttrs(raw: unknown): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "string") return safeJsonParse<Record<string, number>>(raw, {});
  return raw as Record<string, number>;
}

function deriveStoreFields(raw: any) {
  if (!raw) return {};
  const attributes = parseAttrs(raw.attributes);
  const inventory: InventoryItem[] = safeJsonParse<InventoryItem[]>(raw.inventory || "[]", []);
  const unlockedLocations: string[] = raw.unlockedLocations
    ? typeof raw.unlockedLocations === "string"
      ? safeJsonParse<string[]>(raw.unlockedLocations, ["home"])
      : raw.unlockedLocations
    : raw.location
      ? [raw.location]
      : ["home"];

  const worldId = raw.worldId || "earth";
  const age = Number(raw.age || 0);
  const location = raw.location || null;

  const cultivator: CultivatorData = {
    id: raw.id,
    name: raw.name,
    spiritualRoot: raw.spiritualRoot,
    realm: raw.realm,
    realmLevel: Number(raw.realmLevel || 0),
    cultivationExp: Number(raw.cultivationExp || 0),
    totalExp: Number(raw.totalExp || 0),
    stamina: Number(raw.stamina || 0),
    age,
    worldYear: Number(raw.worldYear ?? 2025),
    quarter: raw.quarter ?? undefined,
    quarterAccum: raw.quarterAccum ?? null,
    worldId: raw.worldId ?? null,
    title: raw.title ?? null,
    breakthroughCount: Number(raw.breakthroughCount || 0),
    location,
    gold: Number(raw.gold || 0),
    maxAge: raw.maxAge ?? null,
    bonusAge: Number(raw.bonusAge || 0),
    reincarnationCount: Number(raw.reincarnationCount || 0),
    talents: raw.talents ?? null,
    injuryDebuff: Number(raw.injuryDebuff || 0),
    health: Number(raw.health || 0),
    mindDemon: Number(raw.mindDemon || 0),
    attributes: raw.attributes ?? null,
    attributeExp: raw.attributeExp ?? null,
    subjectExp: raw.subjectExp ?? null,
    storyEntries: raw.storyEntries ?? null,
    inventory: raw.inventory ?? null,
    npcRelations: raw.npcRelations ?? null,
    unlockedLocations,
    occupation: raw.occupation ?? null,
    gender: raw.gender ?? null,
    schoolRank: Number(raw.schoolRank || 0),
    clique: raw.clique ?? null,
    examResults: raw.examResults ?? null,
    milestones: raw.milestones ?? null,
    pet: raw.pet ?? null,
    classEnroll: raw.classEnroll ?? null,
    savings: raw.savings ?? null,
    arcadeStats: raw.arcadeStats ?? null,
    readingLog: raw.readingLog ?? null,
    breakthroughBuff: Number(raw.breakthroughBuff || 0),
  };

  const cb = canBreakthrough(
    cultivator.realm,
    cultivator.realmLevel,
    cultivator.cultivationExp,
    cultivator.spiritualRoot,
    cultivator.breakthroughBuff || 0,
  );
  const actions = getAvailableActions(worldId, age, cultivator.realm, location || undefined);

  return {
    cultivator,
    gold: cultivator.gold,
    inventory,
    location,
    unlockedLocations,
    availableActions: actions,
    canBreakthrough: cb,
  };
}

/** 统一回填：处理道消 / 叙事 / 修炼者派生 / 突破门控 */
function applyNarrativeResult(set: (partial: any) => void, data: any): void {
  if (data?.daoXiao) {
    set((s: any) => ({
      ...s,
      ...(data.cultivator ? deriveStoreFields(data.cultivator) : {}),
      actionLoading: false,
      streamingText: null,
      lastActionResult: data,
      narrativeError: { message: "道消！修炼之路中断。", params: data.summary },
    }));
    return;
  }
  const derived = data.cultivator ? deriveStoreFields(data.cultivator) : {};
  set((s: any) => ({
    ...s,
    ...derived,
    narrative: data.narrative ?? s.narrative,
    streamingText: null,
    lastActionResult: data,
    actionLoading: false,
    canBreakthrough: typeof data.canBreakthrough === "boolean" ? data.canBreakthrough : derived.canBreakthrough ?? s.canBreakthrough,
  }));
}

export const useGameStore = create<GameStore>((set, get) => ({
  userId: null,
  cultivator: null,
  availableActions: [],
  actionLoading: false,
  canBreakthrough: false,
  inventory: [],
  gold: 0,
  narrative: null,
  streamingText: null,
  narrativeError: null,
  narrativeRetrying: false,
  location: null,
  unlockedLocations: null,
  currentNPCs: [],
  lastActionResult: null,

  setUserId: (id) => set({ userId: id }),

  setCultivator: (data) => {
    if (!data) {
      set({ cultivator: null, gold: 0, inventory: [], location: null, unlockedLocations: null, availableActions: [], canBreakthrough: false });
      return;
    }
    set((state) => {
      const merged = { ...(state.cultivator || {}), ...data } as CultivatorData;
      const derived = deriveStoreFields(merged);
      return { ...derived };
    });
  },

  loadCultivator: async (userId) => {
    if (!userId) return;
    set({ userId });
    try {
      const res = await fetch(`/api/cultivator?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const raw = data?.user?.cultivator ?? data?.cultivator ?? null;
      if (!raw) return;
      set((state) => ({ ...state, ...deriveStoreFields(raw), userId }));
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

  performAction: async (actionId, input, selectedNpcIds = []) => {
    const { userId, cultivator, actionLoading } = get();
    if (!userId) throw new Error("未找到用户，请先创建修炼者");
    if (actionLoading) return; // 拒绝重复请求
    set({ actionLoading: true, narrativeError: null, streamingText: "" });
    let familyData: Record<string, any> | null = null;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("family") : null;
      if (raw) familyData = JSON.parse(raw);
    } catch {}
    // NarrativePanel 当前以 NPC 名称作为选择值；直接保留名称，确保家庭成员与地点 NPC 都能成为叙事目标。
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
          onChunk: (c) => set((s: any) => ({ streamingText: (s.streamingText || "") + c })),
          onDone: (data) => applyNarrativeResult(set, data),
          onError: (e) => set({ actionLoading: false, streamingText: null, narrativeError: { message: e?.message || "叙事生成失败" } }),
        });
      } else {
        applyNarrativeResult(set, await res.json());
      }
    } catch (e) {
      set({ actionLoading: false, streamingText: null, narrativeError: { message: e instanceof Error ? e.message : "行动执行失败" } });
    }
  },

  breakthrough: async (protector) => {
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
          onChunk: (c) => set((s: any) => ({ streamingText: (s.streamingText || "") + c })),
          onDone: (data) => applyNarrativeResult(set, data),
          onError: (e) => set({ actionLoading: false, streamingText: null, narrativeError: { message: e?.message || "叙事生成失败" } }),
        });
      } else {
        applyNarrativeResult(set, await res.json());
      }
    } catch (e) {
      set({ actionLoading: false, streamingText: null, narrativeError: { message: e instanceof Error ? e.message : "突破失败" } });
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
      set({ actionLoading: false, narrativeError: { message: e instanceof Error ? e.message : "推进季度失败" } });
    }
  },

  useItem: async (itemId, quantity = 1) => {
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
      set({ actionLoading: false, narrativeError: { message: e instanceof Error ? e.message : "使用物品失败" } });
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
      set((state: any) => ({
        ...state,
        ...deriveStoreFields(data.cultivator || state.cultivator),
        narrative: data.narrative ?? state.narrative,
        narrativeRetrying: false,
      }));
    } catch (e) {
      set({ narrativeError: { message: e instanceof Error ? e.message : "重试失败" }, narrativeRetrying: false });
    }
  },

  setNarrative: (narrative) => set({ narrative }),

  setLastActionResult: (result) => set({ lastActionResult: result }),

  setLocation: async (loc) => {
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
}));
