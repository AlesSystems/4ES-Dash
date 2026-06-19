-- CreateTable
CREATE TABLE "LibraryValueAggregate" (
    "steamId" TEXT NOT NULL PRIMARY KEY,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "pricedCount" INTEGER NOT NULL,
    "freeCount" INTEGER NOT NULL,
    "missingCount" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
