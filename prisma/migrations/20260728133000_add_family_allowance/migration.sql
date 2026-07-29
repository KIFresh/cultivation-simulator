-- 年度家人零花钱额度：仅由服务端在跨年初始化并在行动事务中扣减。
ALTER TABLE "Cultivator" ADD COLUMN "allowanceYear" INTEGER;
ALTER TABLE "Cultivator" ADD COLUMN "allowanceRemaining" INTEGER NOT NULL DEFAULT 0;
