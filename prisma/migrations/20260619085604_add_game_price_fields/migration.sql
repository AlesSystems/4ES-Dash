-- AlterTable
ALTER TABLE "Game" ADD COLUMN "priceCurrency" TEXT;
ALTER TABLE "Game" ADD COLUMN "priceFinalCents" INTEGER;
ALTER TABLE "Game" ADD COLUMN "priceIsFree" BOOLEAN;
ALTER TABLE "Game" ADD COLUMN "priceRefreshedAt" DATETIME;
