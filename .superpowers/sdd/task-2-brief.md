## Task 2：结构化家庭职业与收入规则（TDD）

### 文件

- 新建：`src/lib/family-career.ts`
- 新建：`src/lib/__tests__/family-career.test.ts`
- 修改：`prisma/schema.prisma`
- 新建：`prisma/migrations/<timestamp>_add_family_career/migration.sql`
- 修改：`src/lib/family.ts`
- 修改：`src/app/dashboard/types.ts`
- 修改：`src/app/api/narrative/route.ts`
- 修改：`src/app/api/narrative/retry/route.ts`

### 数据模型

在 `FamilyMember` 增加，保留 `occupation` 和 `incomeLevel` 以兼容现有叙事/存档：

```prisma
careerCategory    String?  // agriculture | manufacturing | education | healthcare | public_service | business | service | freelance
careerLevel       Int      @default(0) // 0–4
careerStatus      String   @default("employed") // employed | unemployed | retired
monthlyIncome     Int      @default(0)
careerUpdatedYear Int?
```

禁止客户端直接写这些字段。`occupation` 由 `getCareerDisplayName(category, level, era)` 生成，例如“中学教师”“资深护士”“小店主”。`incomeLevel` 通过 `getIncomeLevel(monthlyIncome, household)` 派生，限制 `0–4`。

### 核心 API

```ts
export const CAREER_CATEGORIES = [... ] as const;
export type CareerCategory = typeof CAREER_CATEGORIES[number];
export type CareerStatus = "employed" | "unemployed" | "retired";
export interface FamilyCareer { ... }
export function initializeFamilyCareer(input: { relation: string; age: number; worldYear: number; familyBackground?: number }): FamilyCareer;
export function evolveFamilyCareer(input: { career: FamilyCareer; memberAge: number; worldYear: number; seed: string }): FamilyCareer;
export function calculateHouseholdIncome(members: FamilyCareer[]): HouseholdIncome;
```

确定性随机应使用现有 hash/seed 工具，输入至少包括 `cultivatorId | memberId | worldYear`。同一存档在同一年重试不应重复晋升或改变收入。

### 规则

- 仅父亲、母亲、监护人参与家庭经济聚合；仅 `alive === true` 且 `careerStatus === "employed"` 的成员贡献收入。
- `careerLevel` 取 `0–4`：学徒/基层、熟练、骨干、管理/专家、顶层/负责人。每个职业大类拥有相应本地化文案。
- 年龄 `<18` 不参与职业结算；`60+` 逐年提升退休概率；`65+` 强制退休；失业成员按时代与职业稳定度拥有再就业概率。
- 结算顺序：先状态，再职位变化，再由“职业基础收入 × 职位系数 × 时代系数”计算 `monthlyIncome`，最后派生 `incomeLevel`。
- 出生 API 和出生重试 API 都调用 `initializeFamilyCareer`，不信任 AI 输出的收入、职位等级；AI 的 `occupation` 仅可作初始化大类选择提示，无法识别时用家境加权的确定性选择。

### 测试先行

1. 每职业大类每一职位等级产生合法展示名、正收入和 0–4 `incomeLevel`。
2. 富裕/普通/拮据家庭初始化的收入排序符合预期。
3. 同一 seed、同一年多次结算结果相同。
4. 年龄边界：未成年不就业、65 岁退休、不在世成员不贡献收入。
5. `2039 → 2040` 时代切换会调整对应职业收入，但不将收入设为负数。
6. 单亲、双亲、监护人、无在世监护人收入聚合正确。

### 验收

```bash
npx prisma migrate dev --name add_family_career
npx prisma generate
npx vitest run src/lib/__tests__/family-career.test.ts
npx tsc --noEmit
```

提交：`feat: add structured family careers`。

