-- 结构化家庭职业：保留 occupation/incomeLevel 以兼容既有叙事和存档。
ALTER TABLE "FamilyMember" ADD COLUMN "careerCategory" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN "careerLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FamilyMember" ADD COLUMN "careerStatus" TEXT NOT NULL DEFAULT 'employed';
ALTER TABLE "FamilyMember" ADD COLUMN "monthlyIncome" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FamilyMember" ADD COLUMN "careerUpdatedYear" INTEGER;
