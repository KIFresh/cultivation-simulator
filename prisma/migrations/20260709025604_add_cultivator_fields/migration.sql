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
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "breakthroughCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "worldId" TEXT,
    "age" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "npcRelations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cultivator" ("breakthroughCount", "createdAt", "cultivationExp", "id", "name", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId", "worldId") SELECT "breakthroughCount", "createdAt", "cultivationExp", "id", "name", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId", "worldId" FROM "Cultivator";
DROP TABLE "Cultivator";
ALTER TABLE "new_Cultivator" RENAME TO "Cultivator";
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
CREATE TABLE "new_GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cultivatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTION',
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "choices" TEXT,
    "chosenOption" INTEGER,
    "reward" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_cultivatorId_fkey" FOREIGN KEY ("cultivatorId") REFERENCES "Cultivator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GameEvent" ("choices", "chosenOption", "createdAt", "cultivatorId", "id", "narrative", "reward", "title", "type") SELECT "choices", "chosenOption", "createdAt", "cultivatorId", "id", "narrative", "reward", "title", "type" FROM "GameEvent";
DROP TABLE "GameEvent";
ALTER TABLE "new_GameEvent" RENAME TO "GameEvent";
CREATE INDEX "GameEvent_cultivatorId_createdAt_idx" ON "GameEvent"("cultivatorId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
