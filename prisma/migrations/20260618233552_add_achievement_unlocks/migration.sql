-- CreateTable
CREATE TABLE "AchievementUnlock" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL,

    PRIMARY KEY ("steamId", "appId", "apiName")
);

-- CreateIndex
CREATE INDEX "AchievementUnlock_steamId_unlockedAt_idx" ON "AchievementUnlock"("steamId", "unlockedAt");
