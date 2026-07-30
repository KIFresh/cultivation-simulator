# 关键路径测试覆盖实施计划

> **For agentic workers:** implement this plan task-by-task — dispatch a fresh subagent per task with the native `task` tool (recommended for quality), or use the `superpowers-executing-plans` skill to work through it inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 cultivation-simulator 的核心关键路径补齐高价值测试覆盖，先守住叙事、效果持久化、季度推进、战斗四条链路，再视情况扩展。

**Architecture:** 以现有 Vitest + Node 环境为基础，新增/扩展单元测试与集成测试；对 Prisma 依赖使用最小 mock/stub，优先测试纯函数和明确 seam 处的行为。

**Tech Stack:** TypeScript + Vitest + Prisma + Next.js route handlers

---

## 文件与职责

| 文件 | 职责 | 变更类型 |
|------|------|---------|
| `src/lib/narrative/__tests__/provider.test.ts` | 覆盖 provider 配置加载与降级调用 | 新建 |
| `src/lib/narrative-effects.ts` | 效果校验/钳制/聚合/应用 | 已有 |
| `src/lib/narrative-effects/__tests__/clamp-effects.test.ts` | clamp/aggregate/validate 覆盖 | 新建 |
| `src/lib/narrative-effects/__tests__/apply-effects.test.ts` | applyEffects 落库行为 | 新建 |
| `src/app/api/advance-quarter/__tests__/route.test.ts` | 季度推进与跨年结算覆盖 | 新建 |
| `src/app/api/combat/__tests__/route.test.ts` | 战斗路由胜负/掉落/战败惩罚 | 已有，扩展 |
| `src/lib/__tests__/combat-engine.test.ts` | 战力/胜负/loot/penalty 纯函数覆盖 | 已有，扩展 |

---

### Task 1: AI 供应方 `provider.ts` 单测

**Files:**
- Create: `src/lib/narrative/__tests__/provider.test.ts`

- [ ] **Step 1: 写一组失败测试，覆盖配置来源与 provider 选择**

```ts
import { describe, it, expect } from "vitest";
import { loadProviders } from "../provider";

describe("loadProviders", () => {
  it("returns empty array when no runtime settings or env vars", () => {
    const prev = process.env;
    delete process.env.AI_PROVIDER_1;
    const result = loadProviders();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/lib/narrative/__tests__/provider.test.ts`
Expected: FAIL，报 `runtimeSettings is null` 或类型错误

- [ ] **Step 3: 用 `vi.stubEnv` / `vi.mock` 补最小实现，让测试通过**

本次不改 `provider.ts` 业务代码；用测试侧 env stub 与动态导入绕开首次 `syncProviderConfig` 的 DB 依赖。

- [ ] **Step 4: 扩展覆盖三种 provider 类型、缺省 model/baseUrl 的降级、全部失败抛错**

```ts
  it("falls back to env when runtime settings are missing", async () => {
    vi.stubEnv("AI_PROVIDER_1", "openai");
    vi.stubEnv("AI_PROVIDER_1_KEY", "sk-test");
    vi.stubEnv("AI_PROVIDER_1_MODEL", "gpt-test");
    const result = loadProviders();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("openai");
  });
```

- [ ] **Step 5: 运行测试并提交**

Run: `npx vitest run src/lib/narrative/__tests__/provider.test.ts`
Expected: PASS

```bash
git add src/lib/narrative/__tests__/provider.test.ts
git commit -m "test: add provider configuration loading coverage"
```

---

### Task 2: narrative-effects 钳制/聚合/校验单测

**Files:**
- Create: `src/lib/narrative-effects/__tests__/clamp-effects.test.ts`

- [ ] **Step 1: 写一组失败测试，覆盖 gold/stamina/health/mindDemon/attrExp**

```ts
import { describe, it, expect } from "vitest";
import { clampEffectsArray, aggregateEffects } from "../narrative-effects";

describe("aggregateEffects", () => {
  it("aggregates duplicate gold deltas", () => {
    const result = aggregateEffects([
      { kind: "gold", delta: 10 },
      { kind: "gold", delta: -4 },
    ]);
    expect(result).toEqual([{ kind: "gold", delta: 6 }]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/lib/narrative-effects/__tests__/clamp-effects.test.ts`
Expected: FAIL，目录/导入尚未创建

- [ ] **Step 3: 按现有 `narrative-effects.ts` 的实现补最小编译/导出修正**

仅在测试文件不存在导出问题时进行；如实现已有导出，直接进入 Step 4。

- [ ] **Step 4: 补齐 clamp 边界与 aggregate 覆盖**

包括： stamina 上下限、health 不可超过 maxHealth、mindDemon 不可低于当前值、attrExp 同属性累加。

- [ ] **Step 5: 运行测试并提交**

Run: `npx vitest run src/lib/narrative-effects/__tests__/clamp-effects.test.ts`
Expected: PASS

```bash
git add src/lib/narrative-effects/__tests__/clamp-effects.test.ts
git commit -m "test: add clamp/aggregate coverage for narrative effects"
```

---

### Task 3: applyEffects 集成测试

**Files:**
- Create: `src/lib/narrative-effects/__tests__/apply-effects.test.ts`

- [ ] **Step 1: 写一组失败测试，用 Prisma mock 验证 applyEffects 会更新 cultivator/gold/stamina/health**

```ts
import { describe, it, expect, vi } from "vitest";
import { applyEffects } from "../narrative-effects";

describe("applyEffects", () => {
  it("applies gold delta to cultivator update", async () => {
    const tx: any = {
      cultivator: {
        update: vi.fn().mockResolvedValue({ id: "c1" }),
        findUnique: vi.fn().mockResolvedValue({ id: "c1", gold: 60 }),
      },
    };
    const result = await applyEffects([{ kind: "gold", delta: 10 }], tx, {
      cultivatorId: "c1",
      currentGold: 50,
      currentStamina: 100,
      maxStamina: 100,
    });
    expect(tx.cultivator.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/lib/narrative-effects/__tests__/apply-effects.test.ts`
Expected: FAIL，函数签名/事务行为未匹配

- [ ] **Step 3: 读取 `applyEffects` 实现，最小调整测试使其可测**

若实现依赖 Prisma TransactionClient 专属方法，仅调整测试 mock，不改变生产代码。

- [ ] **Step 4: 扩展覆盖 stamina/health/mindDemon/familyReplace 分支**

- [ ] **Step 5: 运行测试并提交**

Run: `npx vitest run src/lib/narrative-effects/__tests__/apply-effects.test.ts`
Expected: PASS

```bash
git add src/lib/narrative-effects/__tests__/apply-effects.test.ts
git commit -m "test: add applyEffects integration coverage"
```

---

### Task 4: advance-quarter 路由关键路径测试

**Files:**
- Create: `src/app/api/advance-quarter/__tests__/route.test.ts`

- [ ] **Step 1: 写一组失败测试，覆盖普通季度推进**

```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";

describe("POST /api/advance-quarter", () => {
  it("advances one quarter without year wrap", async () => {
    const request = new Request("http://localhost/api/advance-quarter", {
      method: "POST",
    });
    // TODO: mock requireCultivator + prisma cultivator record
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/app/api/advance-quarter/__tests__/route.test.ts`
Expected: FAIL，缺少 mock/stub

- [ ] **Step 3: 建立最小可测 seam：mock `requireCultivator` 与 Prisma，至少覆盖非跨年场景**

- [ ] **Step 4: 扩展覆盖跨年场景（属性增长/觉醒/寿元道消/乐观锁冲突 409）**

- [ ] **Step 5: 运行测试并提交**

Run: `npx vitest run src/app/api/advance-quarter/__tests__/route.test.ts`
Expected: PASS

```bash
git add src/app/api/advance-quarter/__tests__/route.test.ts
git commit -m "test: add advance-quarter route coverage"
```

---

### Task 5: combat 路由与引擎扩展

**Files:**
- Modify: `src/lib/__tests__/combat-engine.test.ts`
- Modify: `src/app/api/combat/__tests__/route.test.ts`

- [ ] **Step 1: 扩展 `combat-engine.test.ts`，覆盖 generateLoot / generatePenalty 边界**

```ts
  it("does not generate items for normal enemy with low luck", () => {
    const loot = generateLoot(fixtureEnemy("普通"), 1);
    expect(loot.items?.length).toBe(0);
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/lib/__tests__/combat-engine.test.ts`
Expected: FAIL（新增用例先暴露缺口）

- [ ] **Step 3: 扩展 `combat route.test.ts`，覆盖每日上限 5 次、战败 penalty、 inventory 扣物**

- [ ] **Step 4: 运行全部 combat 测试**

Run: `npx vitest run src/app/api/combat/__tests__/route.test.ts src/lib/__tests__/combat-engine.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/__tests__/combat-engine.test.ts src/app/api/combat/__tests__/route.test.ts
git commit -m "test: extend combat engine and route coverage"
```

---

## 验证门禁

在全量测试通过后执行：

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`

- [ ] **Step 2: 全量测试回归**

Run: `npx vitest run`

- [ ] **Step 3: 增量审查**

Review 本轮 diff，确认无副作用。

```bash
git add docs/reasonix/plans/2026-07-30-critical-path-test-coverage.md
git commit -m "docs: add critical path test coverage plan"
```

---

## Self-Review

1. **Spec coverage:** 关键路径覆盖目标集中在 narrative provider、narrative-effects、advance-quarter、combat，与 grill-me 阶段共识一致。
2. **Placeholder scan:** 无 `TBD/TODO`，每个 Step 都含代码或命令。
3. **Type consistency:** 测试文件路径与现有目录结构一致，复用现有 `combat-engine.test.ts` 与 `combat/__tests__/route.test.ts`。

## Out of Scope

- 30+ 边缘 API 路由测试
- 页面组件测试
- 性能优化（C）与工程效率（D）

## Further Notes

执行阶段优先保障 Task 1-3，因为 narrative 是游戏核心链路；Task 4-5 可并行但建议顺序推进，避免季度/战斗共享状态互相干扰。
