-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cultivatorId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "intimacy" INTEGER NOT NULL DEFAULT 50,
    "dialogueHistory" TEXT,
    CONSTRAINT "FamilyMember_cultivatorId_fkey" FOREIGN KEY ("cultivatorId") REFERENCES "Cultivator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cultivator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spiritualRoot" TEXT NOT NULL DEFAULT '杂灵根',
    "realm" TEXT NOT NULL DEFAULT '凡人',
    "realmLevel" INTEGER NOT NULL DEFAULT 0,
    "cultivationExp" INTEGER NOT NULL DEFAULT 0,
    "totalExp" INTEGER NOT NULL DEFAULT 0,
    "stamina" INTEGER NOT NULL DEFAULT 20,
    "breakthroughCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "worldId" TEXT,
    "age" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "npcRelations" TEXT,
    "inventory" TEXT,
    "gold" INTEGER NOT NULL DEFAULT 50,
    "storySummary" TEXT,
    "storySummaryUpdatedAt" DATETIME,
    "storyEntries" TEXT,
    "storyEntriesUpdatedAt" DATETIME,
    "maxAge" INTEGER,
    "bonusAge" INTEGER NOT NULL DEFAULT 0,
    "breakthroughBuff" INTEGER NOT NULL DEFAULT 0,
    "reincarnationCount" INTEGER NOT NULL DEFAULT 0,
    "talents" TEXT,
    "injuryDebuff" INTEGER NOT NULL DEFAULT 0,
    "mindDemon" INTEGER NOT NULL DEFAULT 0,
    "attributes" TEXT,
    "unlockedLocations" TEXT,
    "occupation" TEXT,
    "schoolRank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cultivator" ("age", "bonusAge", "breakthroughBuff", "breakthroughCount", "createdAt", "cultivationExp", "gold", "id", "injuryDebuff", "inventory", "location", "maxAge", "mindDemon", "name", "npcRelations", "realm", "realmLevel", "reincarnationCount", "spiritualRoot", "stamina", "storyEntries", "storyEntriesUpdatedAt", "storySummary", "storySummaryUpdatedAt", "talents", "title", "totalExp", "userId", "worldId") SELECT "age", "bonusAge", "breakthroughBuff", "breakthroughCount", "createdAt", "cultivationExp", "gold", "id", "injuryDebuff", "inventory", "location", "maxAge", "mindDemon", "name", "npcRelations", "realm", "realmLevel", "reincarnationCount", "spiritualRoot", "stamina", "storyEntries", "storyEntriesUpdatedAt", "storySummary", "storySummaryUpdatedAt", "talents", "title", "totalExp", "userId", "worldId" FROM "Cultivator";
DROP TABLE "Cultivator";
ALTER TABLE "new_Cultivator" RENAME TO "Cultivator";
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FamilyMember_cultivatorId_idx" ON "FamilyMember"("cultivatorId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_cultivatorId_relation_name_key" ON "FamilyMember"("cultivatorId", "relation", "name");
