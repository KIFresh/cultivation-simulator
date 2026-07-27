-- Add personality and resistance columns to Cultivator
-- 2026-07-23 schema 三件套（主理人区）：性格单标签 + 丹毒耐药性 per-type JSON

ALTER TABLE "Cultivator" ADD COLUMN "personality" TEXT;

ALTER TABLE "Cultivator" ADD COLUMN "resistance" TEXT NOT NULL DEFAULT '{}';
