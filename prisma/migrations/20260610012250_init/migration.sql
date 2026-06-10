-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "bilibiliId" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cultivator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spiritualRoot" TEXT NOT NULL DEFAULT '杂灵根',
    "realm" TEXT NOT NULL DEFAULT '炼气期',
    "realmLevel" INTEGER NOT NULL DEFAULT 1,
    "cultivationExp" INTEGER NOT NULL DEFAULT 0,
    "totalExp" INTEGER NOT NULL DEFAULT 0,
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "breakthroughCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cultivator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STUDY',
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "cultivationBonus" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cultivatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DAILY_CULTIVATION',
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "choices" TEXT,
    "chosenOption" INTEGER,
    "reward" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_cultivatorId_fkey" FOREIGN KEY ("cultivatorId") REFERENCES "Cultivator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cultivatorId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bilibiliUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_bilibiliId_key" ON "User"("bilibiliId");

-- CreateIndex
CREATE UNIQUE INDEX "Cultivator_userId_key" ON "Cultivator"("userId");
