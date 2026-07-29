-- Drop storySummary and storySummaryUpdatedAt columns (replaced by storyEntries)
ALTER TABLE "Cultivator" DROP COLUMN "storySummary";
ALTER TABLE "Cultivator" DROP COLUMN "storySummaryUpdatedAt";