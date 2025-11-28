-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "adminTag" TEXT NOT NULL DEFAULT 'NONE',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastComplaintCode" TEXT,
    "lastComplaintUpdatedAt" DATETIME
);
INSERT INTO "new_User" ("id", "isActive", "isSystem", "lastComplaintCode", "lastComplaintUpdatedAt", "passwordHash", "role", "twoFactorEnabled", "twoFactorSecret", "username") SELECT "id", "isActive", "isSystem", "lastComplaintCode", "lastComplaintUpdatedAt", "passwordHash", "role", "twoFactorEnabled", "twoFactorSecret", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
