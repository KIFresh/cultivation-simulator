// ============================================================
// AI 叙事引擎 — 类型定义（已迁移至 @/lib/narrative）
// ============================================================
// @deprecated 请直接从 @/lib/narrative 导入类型。
// 本文件仅保留 re-export 以兼容旧引用，将在后续清理中删除。

export type {
  MoodType,
  NarrativeType,
  StoryEntry,
  NarrativeBase,
  EncounterChoice,
  EncounterNarrative,
  NPCDialogueNarrative,
  FamilyDialogueNarrative,
  RegularNarrative,
  UnifiedNarrative,
  NarrativeResult,
} from "./narrative";