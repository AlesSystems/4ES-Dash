-- CreateTable
CREATE TABLE "ManualGameData" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "pricePaidCents" INTEGER,
    "currency" TEXT,
    "acquiredAt" DATETIME,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("steamId", "appId")
);

-- CreateTable
CREATE TABLE "IdleDismissal" (
    "steamId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "dismissedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("steamId", "appId", "fromDate", "toDate")
);

-- CreateIndex
CREATE INDEX "IdleDismissal_steamId_appId_idx" ON "IdleDismissal"("steamId", "appId");
