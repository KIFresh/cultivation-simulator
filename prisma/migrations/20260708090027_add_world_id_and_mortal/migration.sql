/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
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
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "breakthroughCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "worldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cultivator" ("breakthroughCount", "createdAt", "cultivationExp", "id", "name", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId") SELECT "breakthroughCount", "createdAt", "cultivationExp", "id", "name", "realm", "realmLevel", "spiritualRoot", "stamina", "title", "totalExp", "userId" FROM "Cultivator";
DROP TABLE "Cultivator";
ALTER TABLE "new_Cultivator" RENAME TO "Cultivator";
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyTask_userId_date_idx" ON "DailyTask"("userId", "date");

-- CreateIndex
CREATE INDEX "GameEvent_cultivatorId_createdAt_idx" ON "GameEvent"("cultivatorId", "createdAt");

-- CreateIndex
CREATE INDEX "ShareCard_cultivatorId_idx" ON "ShareCard"("cultivatorId");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
