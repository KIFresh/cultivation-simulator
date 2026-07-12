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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cultivator" ("age", "breakthroughCount", "createdAt", "cultivationExp", "id", "location", "name", "npcRelations", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId", "worldId") SELECT "age", "breakthroughCount", "createdAt", "cultivationExp", "id", "location", "name", "npcRelations", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId", "worldId" FROM "Cultivator";
DROP TABLE "Cultivator";
ALTER TABLE "new_Cultivator" RENAME TO "Cultivator";
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
