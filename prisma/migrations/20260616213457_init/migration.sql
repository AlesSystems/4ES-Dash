-- CreateTable
CREATE TABLE "User" (
    "steamId" TEXT NOT NULL PRIMARY KEY,
    "personaName" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Game" (
    "appId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "headerUrl" TEXT,
    "releaseDate" DATETIME,
    "genres" TEXT NOT NULL,
    "hasStats" BOOLEAN NOT NULL DEFAULT false,
    "refreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OwnedGame" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "acquiredAt" DATETIME,
    "playtimeForever" INTEGER NOT NULL,
    "playtimeTwoWeeks" INTEGER NOT NULL,
    "lastPlayedAt" DATETIME,
    "refreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("steamId", "appId"),
    CONSTRAINT "OwnedGame_steamId_fkey" FOREIGN KEY ("steamId") REFERENCES "User" ("steamId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnedGame_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Game" ("appId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "appId" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "iconGrayUrl" TEXT,
    "globalUnlockPercent" REAL,

    PRIMARY KEY ("appId", "apiName"),
    CONSTRAINT "Achievement_appId_fkey" FOREIGN KEY ("appId") REFERENCES "Game" ("appId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaytimeSnapshot" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "playtimeForever" INTEGER NOT NULL,

    PRIMARY KEY ("steamId", "appId", "date"),
    CONSTRAINT "PlaytimeSnapshot_steamId_fkey" FOREIGN KEY ("steamId") REFERENCES "User" ("steamId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AchievementSnapshot" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "unlockedCount" INTEGER NOT NULL,

    PRIMARY KEY ("steamId", "appId", "date"),
    CONSTRAINT "AchievementSnapshot_steamId_fkey" FOREIGN KEY ("steamId") REFERENCES "User" ("steamId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" TEXT
);

-- CreateIndex
CREATE INDEX "OwnedGame_steamId_playtimeForever_idx" ON "OwnedGame"("steamId", "playtimeForever");

-- CreateIndex
CREATE INDEX "PlaytimeSnapshot_steamId_date_idx" ON "PlaytimeSnapshot"("steamId", "date");
