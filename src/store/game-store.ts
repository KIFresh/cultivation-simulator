"use client";

import { create } from "zustand";
import type { Action } from "@/lib/cultivation-data";
import type { CultivatorData, NarrativeDisplay, FamilyMember } from "@/app/dashboard/types";
import type { InventoryItem } from "@/lib";
import { initActions } from "./game-actions";

export type { CultivatorData, NarrativeDisplay, FamilyMember } from "@/app/dashboard/types";
export type { InventoryItem } from "@/lib";

export interface CompetitionPrizeInfo {
  name: string;
  subjectExp: number;
  insightExp: number;
  charmExp: number;
}

export interface CompetitionResult {
  semester: string;
  events: {
    id: string;
    subject: string;
    subjectName: string;
    prizes: CompetitionPrizeInfo[];
  }[];
}

export interface FinalExamResult {
  text: string;
  subject: string;
  gained: number;
}

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
  competitionResults: CompetitionResult[] | null;
  finalExamResult: FinalExamResult | null;

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
  setCompetitionResults: (results: CompetitionResult[] | null) => void;
  setFinalExamResult: (result: FinalExamResult | null) => void;
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
  competitionResults: null,
  finalExamResult: null,

  ...initActions(set, get),
}));