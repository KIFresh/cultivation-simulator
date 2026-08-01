import type { Action, InventoryItem, NPC } from "@/lib";

export interface CultivatorData {
  id: string;
  name: string;
  spiritualRoot: string;
  realm: string;
  realmLevel: number;
  cultivationExp: number;
  totalExp: number;
  stamina: number;
  age: number;
  worldYear: number;
  quarter?: number;
  quarterAccum?: string | null;
  worldId: string | null;
  title: string | null;
  breakthroughCount: number;
  location: string | null;
  gold: number;
  maxAge: number | null;
  bonusAge: number;
  reincarnationCount: number;
  talents: string | null;
  injuryDebuff: number;
  health: number;
  mindDemon: number;
  attributes: Record<string, number> | string | null;
  attributeExp?: Record<string, { exp: number; level: number }> | string | null;
  subjectExp?: Record<string, { exp: number; level: number }> | string | null;
  storyEntries?: any[] | string | null;
  inventory?: string | null;
  npcRelations?: string | null;
  unlockedLocations: string[] | string | null;
  occupation: string | null;
  gender: string | null;
  schoolRank: number;
  clique?: string | null;
  examResults?: string | null;
  milestones?: string | null;
  pet?: string | null;
  classEnroll?: string | null;
  savings?: number | null;
  arcadeStats?: string | null;
  readingLog?: string | null;
  breakthroughBuff?: number;
}

export interface NarrativeDisplay {
  title: string;
  narrative: string;
  mood: string;
  hint?: string;
  actionOptions?: string[];
}

export interface Attributes {
  root?: number;
  spirit?: number;
  insight?: number;
  luck?: number;
  charm?: number;
  mind?: number;
}

export type InventoryItemExt = InventoryItem;

export interface FamilyMember {
  id?: string;
  name: string;
  relation: string;
  alive: boolean;
  age?: number;
  intimacy?: number;
  occupation?: string | null;
  incomeLevel?: number | null;
  careerCategory?: import("@/lib/family-career").CareerCategory | null;
  careerLevel?: number;
  careerStatus?: import("@/lib/family-career").CareerStatus;
  monthlyIncome?: number;
  careerUpdatedYear?: number | null;
}

export interface AwakenEvent {
  title: string;
  narrative: string;
}

export interface DaoXiaoEvent {
  summary: any;
  name: string;
}

export interface YearNarrative {
  title?: string;
  narrative: string;
  changes?: Record<string, number>;
}

export interface TechniqueEvent {
  techniqueName: string;
  icon: string;
  profGained: number;
  eventNarrative?: string;
  leveledUp?: boolean;
}
