-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "steamId" TEXT NOT NULL PRIMARY KEY,
    "personaName" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" DATETIME NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "privacy" TEXT NOT NULL DEFAULT 'private',
    "onboardedAt" DATETIME
);
INSERT INTO "new_User" ("avatarUrl", "countryCode", "createdAt", "firstSeenAt", "lastSyncedAt", "personaName", "steamId") SELECT "avatarUrl", "countryCode", "createdAt", "firstSeenAt", "lastSyncedAt", "personaName", "steamId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
