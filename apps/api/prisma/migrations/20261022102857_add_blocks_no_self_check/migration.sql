-- Блокировка самого себя запрещена (вручную: Prisma не умеет CHECK)
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_no_self_block" CHECK ("blockerId" <> "blockedId");
