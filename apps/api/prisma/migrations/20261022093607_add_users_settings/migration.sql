-- CreateTable
CREATE TABLE "username_changes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "oldUserName" TEXT NOT NULL,
    "newUserName" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "username_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId","type")
);

-- CreateTable
CREATE TABLE "user_links" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "user_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "username_changes_userId_changedAt_idx" ON "username_changes"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "username_changes_oldUserName_idx" ON "username_changes"("oldUserName");

-- CreateIndex
CREATE INDEX "user_links_userId_position_idx" ON "user_links"("userId", "position");

-- AddForeignKey
ALTER TABLE "username_changes" ADD CONSTRAINT "username_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_links" ADD CONSTRAINT "user_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
