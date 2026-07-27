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
    "inheritedTalent" TEXT,
    "inheritedItems" TEXT,
    "injuryDebuff" INTEGER NOT NULL DEFAULT 0,
    "mindDemon" INTEGER NOT NULL DEFAULT 0,
    "attributes" TEXT,
    "attributeExp" TEXT DEFAULT '{}',
    "subjectExp" TEXT DEFAULT '{}',
    "unlockedLocations" TEXT,
    "occupation" TEXT,
    "gender" TEXT,
    "schoolRank" INTEGER NOT NULL DEFAULT 0,
    "unlockedFormulas" TEXT,
    "toxicity" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 100,
    "furnaceEquipped" TEXT,
    "properties" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cultivator" ("age", "attributeExp", "attributes", "bonusAge", "breakthroughBuff", "breakthroughCount", "createdAt", "cultivationExp", "furnaceEquipped", "gender", "gold", "id", "inheritedItems", "inheritedTalent", "injuryDebuff", "inventory", "location", "maxAge", "mindDemon", "name", "npcRelations", "occupation", "properties", "realm", "realmLevel", "reincarnationCount", "schoolRank", "spiritualRoot", "stamina", "storyEntries", "storyEntriesUpdatedAt", "storySummary", "storySummaryUpdatedAt", "subjectExp", "talents", "title", "totalExp", "toxicity", "unlockedFormulas", "unlockedLocations", "userId", "worldId") SELECT "age", "attributeExp", "attributes", "bonusAge", "breakthroughBuff", "breakthroughCount", "createdAt", "cultivationExp", "furnaceEquipped", "gender", "gold", "id", "inheritedItems", "inheritedTalent", "injuryDebuff", "inventory", "location", "maxAge", "mindDemon", "name", "npcRelations", "occupation", "properties", "realm", "realmLevel", "reincarnationCount", "schoolRank", "spiritualRoot", "stamina", "storyEntries", "storyEntriesUpdatedAt", "storySummary", "storySummaryUpdatedAt", "subjectExp", "talents", "title", "totalExp", "toxicity", "unlockedFormulas", "unlockedLocations", "userId", "worldId" FROM "Cultivator";
DROP TABLE "Cultivator";
ALTER TABLE "new_Cultivator" RENAME TO "Cultivator";
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
