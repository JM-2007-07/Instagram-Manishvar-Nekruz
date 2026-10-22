-- CreateEnum
CREATE TYPE "SearchHistoryType" AS ENUM ('QUERY', 'USER', 'HASHTAG', 'LOCATION');

-- CreateTable
CREATE TABLE "search_history_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "SearchHistoryType" NOT NULL,
    "query" TEXT,
    "targetUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_history_entries_userId_type_createdAt_idx" ON "search_history_entries"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "search_history_entries_userId_type_query_key" ON "search_history_entries"("userId", "type", "query");

-- CreateIndex
CREATE UNIQUE INDEX "search_history_entries_userId_type_targetUserId_key" ON "search_history_entries"("userId", "type", "targetUserId");

-- AddForeignKey
ALTER TABLE "search_history_entries" ADD CONSTRAINT "search_history_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history_entries" ADD CONSTRAINT "search_history_entries_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
