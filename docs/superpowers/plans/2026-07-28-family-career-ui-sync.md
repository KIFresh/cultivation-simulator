# 家庭职业时代、物品技能入口与叙事同步实施计划

> 状态：设计已确认，等待选择执行方式。
>
> 已确认约束：现代都市从 `2025` 起步；每次跨年结算职业；职业采用「职业大类 + 0–4 职位等级」；物品页独立于资产页；技能页采用「功法 / 技艺」双标签；记忆压缩保留重要条目并合并普通条目；不直接向 `main` 推送，使用功能分支和 PR。

## 目标与边界

### 目标

1. 为修炼者加入 `worldYear`，由世界年份推导时代阶段；每次跨年推进一年。
2. 为 `FamilyMember` 建立可演进的结构化职业状态：职业大类、职位等级、在职状态、月收入、最近结算年份。
3. 跨年以确定性服务端规则结算父母/监护人的晋升、转岗、失业、退休和收入；家庭零花钱与年度额度统一使用同一收入聚合规则。
4. 增加 `/items`（背包、装备、使用）及 `/skills`（功法 / 技艺）导航和页面，保留 `/assets` 财务页。
5. 仪表盘灵根信息统一显示为「木灵根 · 中品」。
6. 修复道心明镜压缩：保留重要条目、合并普通条目，正确回写前端状态，并给无可压缩内容明确反馈。
7. 所有叙事结算只接受服务端校验后的 `effects`；结算响应携带最新 Cultivator，store 和仪表盘、技艺经验、功法熟练度立刻更新。

### 非目标

- 不允许 AI 自行决定职业等级、收入、金币、经验或属性数值。
- 第一版不加入玩家手动编辑父母职位/收入；职业数据只由出生初始化和跨年服务端结算写入。
- 不将“资产”页与“物品”页合并。
- 不做 AI 自动重试或重写叙事以纠正选中 NPC。

## 实施前准备

1. 创建分支：`git switch -c feat/family-career-ui-sync`。
2. 先记录现有工作区未提交改动：`git status --short`；不得 reset、checkout 覆盖或混入无关格式化。
3. 阅读 Next.js 当前项目版本文档：`node_modules/next/dist/docs/` 内 route handlers、动态路由、类型检查相关说明。
4. 先运行基线：`npx prisma generate && npx tsc --noEmit && npx vitest run`。若基线有失败，先记录并隔离，不把无关失败算入本功能。

## 模块边界

| 模块 | 新增/修改文件 | 职责 |
| --- | --- | --- |
| 世界时代 | `src/lib/world-era.ts` | 由 `worldYear` 推导年代、职业收入修正与时代文案。纯函数、可测试。 |
| 家庭职业 | `src/lib/family-career.ts` | 职业大类、职位阶梯、收入表、初始化、跨年职业结算和家庭收入聚合。纯函数、可测试。 |
| 存档模型 | `prisma/schema.prisma`、新迁移 | 保存世界年份和家庭成员结构化职业状态。 |
| 跨年流程 | `src/app/api/advance-quarter/route.ts` | 同一推进流程中结算 `worldYear`、家庭职业、收入与年度额度。 |
| 经济 | `src/lib/family-allowance.ts`、`src/lib/savings.ts`、`src/lib/action-gifts.ts` | 改用统一的家庭收入聚合结果，保留当前额度/亲密度规则。 |
| 道心明镜 | `src/app/api/cultivator/route.ts`、`src/components/memory-panel.tsx` | 压缩普通记忆、保留重要记忆、将完整结果回写。 |
| 叙事同步 | `src/store/game-store.ts`、`src/app/dashboard/hooks/use-dashboard-actions.ts`、相关 API routes | 所有服务端结算后同步最新 Cultivator 与派生字段。 |
| 页面入口 | `src/components/top-nav.tsx`、`src/app/items/page.tsx`、`src/app/skills/page.tsx` | 新导航页及信息架构。 |
| 灵根展示 | 仪表盘与灵根格式化 helper、对应测试 | 界面自然化分隔，不修改内部 ID。 |

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

## Task 3：将职业结算接入跨年与统一家庭经济（TDD）

### 文件

- 修改：`src/app/api/advance-quarter/route.ts`
- 修改：`src/lib/family-allowance.ts`
- 修改：`src/lib/savings.ts`
- 修改：`src/lib/action-gifts.ts`
- 修改：`src/server/action/action-service.ts`
- 修改：`src/app/api/__tests__/advance-quarter.test.ts`
- 修改：`src/lib/__tests__/family-allowance.test.ts`
- 修改：`src/lib/__tests__/savings.test.ts`
- 修改：`src/lib/__tests__/action-gifts.test.ts`

### 实现

1. 在 `yearWrapped` 分支中计算 `nextWorldYear = cultivator.worldYear + 1`；普通季度不变。
2. 同一跨年事务/乐观锁内读取在世家庭成员、调用 `evolveFamilyCareer`、逐个更新职业字段，再以 `calculateHouseholdIncome` 得到统一家庭收入。
3. 用统一 `HouseholdIncome.incomeLevel` 替换当前各处“首个家人”“最高收入”等不一致的取数策略：
   - `calculateAnnualFamilyAllowance`
   - `calcPocketMoney`
   - `evaluateActionGift`
4. 保持已有年度额度余额语义：跨年重新初始化，行动服务在同一数据更新中扣减。
5. 返回体增加 `worldYear`、`era` 和简洁 `familyCareerChanges`，用于叙事与前端展示；不得泄露未筛选的内部种子。
6. 将职业变化作为系统事实交给叙事 prompt；叙事只能描述返回的变化，不能虚构升职、失业或收入金额。

### 测试先行

1. 第四季度到第一季度：年龄和 `worldYear` 都加一；普通季度 `worldYear` 不变。
2. 并发跨年仅执行一次职业结算。
3. 跨年后年度额度、学龄零花钱、索要上限引用同一收入档位。
4. 退休/失业家庭的额度下降但不为负；重新就业后恢复。
5. 旧存档 `worldYear` 或职业字段为 `null` 时安全补默认并完成跨年。

### 验收

```bash
npx vitest run src/app/api/__tests__/advance-quarter.test.ts src/lib/__tests__/family-allowance.test.ts src/lib/__tests__/savings.test.ts src/lib/__tests__/action-gifts.test.ts
npx tsc --noEmit
```

提交：`feat: evolve family careers each year`。

## Task 4：修复道心明镜压缩与叙事实时数据同步（TDD）

### 文件

- 修改：`src/app/api/cultivator/route.ts`
- 修改：`src/components/memory-panel.tsx`
- 修改：`src/components/__tests__/memory-panel.test.tsx`
- 修改：`src/store/game-store.ts`
- 修改：`src/app/dashboard/hooks/use-dashboard-actions.ts`
- 修改：`src/app/dashboard/hooks/use-dashboard-state.ts`
- 修改：`src/app/dashboard/hooks/__tests__/use-data-sync.test.ts`
- 新建或修改：`src/app/api/cultivator/__tests__/route.test.ts`

### 记忆压缩规则

1. 解析 `storyEntries` 时容错：无效 JSON 视为 `[]`，不得返回 500。
2. 拆分为 `importantEntries` 与 `ordinaryEntries`。
3. `ordinaryEntries.length === 0` 时，返回 `{ success: true, entries: importantEntries, compressed: false, message: "没有可压缩的普通记忆" }`，前端展示 info/success 提示而非“压缩失败”。
4. 有普通记忆时，调用 `compressStorySummary`，创建单条 `StoryEntry`：`title: "记忆凝练"`、`important: false`；保留所有重要条目。
5. 用更新后的完整 entries 写回数据库并返回 `entries` 与 `storySummary`；前端调用 `onEntriesChange(data.entries)`，同步摘要状态并刷新 Cultivator。
6. 压缩按钮在无普通记忆时显示“无可压缩记忆”或 disabled，并提供原因 tooltip，避免无反馈点击。

### 叙事实时同步规则

1. 所有结算 API 统一在响应中返回持久化后的 `cultivator`；只返回经 `applyEffects`/路由规则写入后的数据。
2. `applyNarrativeResult` 与 dashboard 的 `applyNarrativeResponse` 只用返回的 `cultivator` 更新 store；禁止从 AI 文本解析金币、属性、经验或功法数值。
3. `deriveStoreFields` 持续从最新的 `attributeExp`、`subjectExp`、`inventory` 推导技能等级、背包、金币和行动力。
4. dashboard state 订阅 store 的 `cultivator`，以 store 为准覆盖局部 `cultivator`，使仪表盘无需刷新也更新。
5. 技能组件须由 store 的 `cultivator` 派生；功法列表在 `techniqueEvents` 或最新 Cultivator 返回后重新读取。

### 测试先行

1. 全部普通：压缩为一条“记忆凝练”。
2. 重要 + 普通：保留重要，普通合一。
3. 全部重要：成功响应、条目不变、说明“没有可压缩的普通记忆”。
4. 非法 `storyEntries`：不崩溃且返回可用结果。
5. 带 `attrExp` effect 的叙事响应更新 store 后，`deriveSkillLevels` 立即出现正确等级。
6. 带 `gold`、`stamina`、`inventory` 的结算返回后，仪表盘 store 值与服务端返回相同。

### 验收

```bash
npx vitest run src/components/__tests__/memory-panel.test.tsx src/app/api/cultivator/__tests__/route.test.ts src/app/dashboard/hooks/__tests__/use-data-sync.test.ts src/store/__tests__/game-store.test.ts
npx tsc --noEmit
```

提交：`fix: sync compressed memories and narrative state`。

## Task 5：新增物品页与技能页、导航入口（TDD）

### 文件

- 修改：`src/components/top-nav.tsx`
- 新建：`src/app/items/page.tsx`
- 新建：`src/app/skills/page.tsx`
- 修改或复用：`src/components/technique-panel.tsx`
- 修改或复用：`src/components/skills-panel.tsx`
- 新建：`src/components/__tests__/top-nav.test.tsx`
- 新建：`src/app/items/__tests__/page.test.tsx`
- 新建：`src/app/skills/__tests__/page.test.tsx`

### 物品页设计

- 顶部说明“背包物品”，不重复展示金币/灵石财务卡片。
- 分类为“可使用”“装备中”“材料/其他”；从服务端验证后的 `inventory` 读取。
- 物品详情显示名称、数量、描述、效果、是否可用；使用按钮调用现有 `POST /api/cultivator/use-item`，完成后以返回的 `cultivator` 更新 store。
- 空状态明确引导“尚无随身物品”。
- `/assets` 保持金币、储蓄、灵石等财务信息，不移动或删除。

### 技能页设计

- 页头两个标签：`功法`、`技艺`。
- 功法：复用现有功法数据、装备/熟练度接口与所有权校验；无功法时展示空状态。
- 技艺：复用 `deriveSkillLevels(attributeExp, subjectExp)`；展示等级、经验、到下一级进度。
- 禁止从 `localStorage.userId` 直接读取其他用户资源；新增/复用页面读取必须以受会话保护的接口与 store 为主。接入前先修复功法 API 的 `requireCultivator` 所有权校验。

### 导航

- 在 `NAV_TABS` 中新增 `{ label: "物品", href: "/items" }` 与 `{ label: "技能", href: "/skills" }`。
- 维持移动端横向滚动和 current route active 样式；导航过长时不挤压品牌区。

### 测试先行

1. TopNav 包含新入口，正确路径得到 active 样式。
2. `/items` 空背包、单件物品、使用成功/失败。
3. `/skills` 在功法/技艺标签切换；无数据、已有经验、装备状态。
4. 功法请求缺少会话、尝试访问他人 ID 均失败。

### 验收

```bash
npx vitest run src/components/__tests__/top-nav.test.tsx src/app/items/__tests__/page.test.tsx src/app/skills/__tests__/page.test.tsx src/components/__tests__/technique-panel.test.tsx
npx tsc --noEmit
```

提交：`feat: add items and skills pages`。

## Task 6：仪表盘灵根显示自然化（TDD）

### 文件

- 修改：灵根展示 helper 所在文件（先以 `rg "getRootInfo|中品|_" src/lib src/app/dashboard` 定位）
- 修改：`src/app/dashboard/page.tsx`
- 修改/新增：对应 `src/lib/__tests__/cultivation-data.test.ts` 或展示组件测试

### 实现

1. 保持存档/内部 ID，例如 `木_中品` 与 `chaos`，不做数据迁移。
2. 增加 `formatSpiritualRootLabel(root)`，将五行根骨显示为 `木灵根 · 中品`；天灵根、异灵根、杂灵根使用自然中文名称，绝不显示 `chaos`。
3. 仪表盘只调用 formatter，不直接打印 `getRootInfo(...).name` 的原始值。

### 测试

1. `木_中品 → 木灵根 · 中品`。
2. 杂灵根/`chaos` 不出现英文 `chaos`。
3. 天灵根、无效值仍有安全中文 fallback。

### 验收

```bash
npx vitest run src/lib/__tests__/cultivation-data.test.ts
npx tsc --noEmit
```

提交：`fix: format spiritual root labels naturally`。

## Task 7：全量验证、代码审查与 PR

1. 应用迁移并生成 client：

```bash
npx prisma migrate deploy
npx prisma generate
```

2. 执行完整验证：

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

3. 启动本地服务：

```bash
npm run dev
```

人工验收：

- 创建/加载 2025 角色；推进到跨年后确认 `worldYear` 增长、父母职业字段和收入变化合理。
- 验证父母退休、单亲、家庭收入变化与年度额度/索要金额保持一致。
- 道心明镜在“只有重要记忆”“重要 + 普通记忆”“无记忆”三种场景都有明确、正确结果。
- 产生带金币、属性经验、功法/技艺经验的结算后，不刷新页面即确认仪表盘和技能页数值更新。
- 浏览 `/items`、`/skills`，手机宽度确认导航可滚动、入口可点击。
- 验证灵根显示为“木灵根 · 中品”，不出现 `木_中品` 或 `chaos`。

4. 运行 `review`，针对数据迁移、跨年并发、鉴权和 effects 同步修复问题。
5. 对 auth、客户端输入、家庭数据写入调用 `security_review`。
6. 更新相关设计文档，记录新字段、职业职业表、年代规则及 API 响应。
7. 只提交当前功能变更；推送功能分支、创建 PR；不得直接 push 到 `main`。

## 覆盖性自检

| 已确认需求 | 覆盖任务 |
| --- | --- |
| 现代都市 2025 + 世界年份与时代 | Task 1、Task 3 |
| 职业大类 + 0–4 职位等级 + 收入与家境关联 | Task 2 |
| 每年职业结算 | Task 3 |
| 家庭经济统一 | Task 3 |
| 物品页、技能页双标签、资产页保留 | Task 5 |
| 木_中品 自然分隔显示 | Task 6 |
| 道心明镜压缩失效 | Task 4 |
| 叙事引发的仪表盘与技能实时更新 | Task 4 |
| 测试、审查、分支 PR | Task 7 |
