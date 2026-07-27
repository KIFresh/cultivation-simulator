-- AlterTable
ALTER TABLE "Cultivator" ADD COLUMN "inheritedItems" TEXT;
ALTER TABLE "Cultivator" ADD COLUMN "inheritedTalent" TEXT;
ALTER TABLE "Cultivator" ADD COLUMN "subjectExp" TEXT DEFAULT '{}';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cultivatorId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "intimacy" INTEGER NOT NULL DEFAULT 50,
    "dialogueHistory" TEXT,
    "occupation" TEXT,
    "incomeLevel" INTEGER,
    "contribution" TEXT,
    "savings" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FamilyMember_cultivatorId_fkey" FOREIGN KEY ("cultivatorId") REFERENCES "Cultivator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FamilyMember" ("age", "alive", "cultivatorId", "dialogueHistory", "id", "intimacy", "name", "relation") SELECT "age", "alive", "cultivatorId", "dialogueHistory", "id", "intimacy", "name", "relation" FROM "FamilyMember";
DROP TABLE "FamilyMember";
ALTER TABLE "new_FamilyMember" RENAME TO "FamilyMember";
CREATE INDEX "FamilyMember_cultivatorId_idx" ON "FamilyMember"("cultivatorId");
CREATE UNIQUE INDEX "FamilyMember_cultivatorId_relation_name_key" ON "FamilyMember"("cultivatorId", "relation", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
