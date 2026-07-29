## Task 1：建立世界年份与时代纯函数（TDD）

### 文件

- 新建：`src/lib/world-era.ts`
- 新建：`src/lib/__tests__/world-era.test.ts`
- 修改：`prisma/schema.prisma`
- 新建：`prisma/migrations/<timestamp>_add_world_year/migration.sql`
- 修改：`src/app/dashboard/types.ts`

### 数据模型

在 `Cultivator` 增加：

```prisma
worldYear Int @default(2025)
```

使用固定、可测试的函数推导时代，不把 `era` 冗余持久化：

```ts
export type WorldEraKey = "contemporary" | "digital" | "automation";

export interface WorldEra {
  key: WorldEraKey;
  label: string;
  startYear: number;
  incomeMultiplier: number;
  careerWeights: Partial<Record<CareerCategory, number>>;
}

export function getWorldEra(worldYear: number): WorldEra;
export function normalizeWorldYear(value: unknown): number;
```

第一版规则：`2025–2039` 为“现代都市”、`2040–2054` 为“数字转型”、`2055+` 为“智能协同”。超前时代的效果仅影响收入权重与职业稳定度，不能制造玩家不可理解的科幻职业。

### 测试先行

在 `world-era.test.ts` 添加：

1. `2025`、`2039`、`2040`、`2055` 的阶段边界。
2. `null`、负数、非整数回落到 `2025`。
3. 每个阶段收入系数为正数且职业权重只引用允许职业大类。

### 实现与验收

1. 实现纯函数，再添加 Prisma 字段与迁移。
2. 所有创建角色路径显式写入 `worldYear: 2025`，确保旧代码与迁移默认值一致。
3. 扩展 `CultivatorData` 以包含 `worldYear`。
4. 运行：

```bash
npx prisma migrate dev --name add_world_year
npx prisma generate
npx vitest run src/lib/__tests__/world-era.test.ts
npx tsc --noEmit
```

5. 提交：`feat: add world year and era rules`。

