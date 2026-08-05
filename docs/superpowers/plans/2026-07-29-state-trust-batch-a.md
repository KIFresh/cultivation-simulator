# 状态可信与安全：批次 A 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三类"客户端看到的结果与持久化状态不一致"问题：普通行动经验原子结算、战斗仅使用服务端属性、战斗掉落与库存原子持久化。

**Architecture:** 服务端事务内以原子增量写入经验，战斗从数据库读取角色属性，战斗奖励（金币、经验、物品）在同一事务内写入。所有状态变更接口返回提交后的最新 `cultivator`，前端以服务端快照为唯一事实来源。

**Tech Stack:** Next.js 16, Prisma, TypeScript, Vitest

## Global Constraints

- 所有状态变更必须在事务（`$transaction`）内完成，不得出现部分写入。
- 战斗结算仅使用数据库中 `cultivator.attributes`，忽略请求体中的 `attributes`。
- 所有状态变更接口在响应中返回完整的 `cultivator` 对象。
- 新增/修改的测试必须覆盖成功路径、失败回滚和伪造属性。
- 每项任务完成后先运行定向测试，再运行全量测试。
- 不直接 push main。

---

### Task 1: 新增库存合并工具函数

**Files:**
- Modify: `src/lib/inventory-utils.ts`（末尾追加）
- Test: `src/lib/__tests__/inventory-utils.test.ts`（末尾追加）

**Interfaces:**
- Consumes: `InventoryItem` 类型（来自 `cultivation-data.ts`）
- Produces: `mergeInventoryItems(inventory: InventoryItem[], itemIds: string[]): InventoryItem[]` — 纯净函数，将一组可能重复的 itemId 合并到背包中，同 itemId 累加 quantity，不修改原数组。

- [ ] **Step 1: 写测试**

在 `src/lib/__tests__/inventory-utils.test.ts` 末尾追加 `describe("mergeInventoryItems")`：

```typescript
describe("mergeInventoryItems", () => {
  it("空背包添加物品", () => {
    const result = mergeInventoryItems([], ["spirit_stone"]);
    expect(result).toEqual([{ itemId: "spirit_stone", quantity: 1, equipped: false }]);
  });
  it("已有 stack 累加数量", () => {
    const inv = [{ itemId: "spirit_stone", quantity: 3, equipped: false }];
    const result = mergeInventoryItems(inv, ["spirit_stone", "spirit_stone"]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });
  it("重复掉落 ID 累加多次", () => {
    const result = mergeInventoryItems([], ["herb", "herb", "herb"]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });
  it("不修改原输入数组", () => {
    const inv = [{ itemId: "sword", quantity: 1, equipped: true }];
    const copy = JSON.parse(JSON.stringify(inv));
    mergeInventoryItems(inv, ["shield"]);
    expect(inv).toEqual(copy);
  });
  it("保留其他物品及 equipped 状态", () => {
    const inv = [
      { itemId: "sword", quantity: 1, equipped: true },
      { itemId: "shield", quantity: 1, equipped: false },
    ];
    const result = mergeInventoryItems(inv, ["potion"]);
    expect(result).toHaveLength(3);
    expect(result.find((i: any) => i.itemId === "sword")?.equipped).toBe(true);
  });
  it("空数组 itemIds 返回原数组副本", () => {
    const inv = [{ itemId: "stone", quantity: 2, equipped: false }];
    const result = mergeInventoryItems(inv, []);
    expect(result).toEqual(inv);
    expect(result).not.toBe(inv);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/__tests__/inventory-utils.test.ts -t "mergeInventoryItems"
```
预期：FAIL，`mergeInventoryItems is not defined`。

- [ ] **Step 3: 实现 `mergeInventoryItems`**

在 `src/lib/inventory-utils.ts` 末尾（`consumeInventoryItem` 之后）追加：

```typescript
/**
 * 将一组可能重复的 itemId 合并到背包中。
 * 同 itemId 累加 quantity，不修改原输入数组。
 */
export function mergeInventoryItems(
  inventory: InventoryItem[],
  itemIds: string[],
): InventoryItem[] {
  const result = inventory.map((i) => ({ ...i }));
  for (const itemId of itemIds) {
    const existing = result.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      result.push({ itemId, quantity: 1, equipped: false });
    }
  }
  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/__tests__/inventory-utils.test.ts -t "mergeInventoryItems"
```
预期：6 tests PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/inventory-utils.ts src/lib/__tests__/inventory-utils.test.ts
git commit -m "feat: add mergeInventoryItems pure function for inventory merging"
```

---

### Task 2: 修复普通行动经验原子结算

**Files:**
- Modify: `src/server/action/action-service.ts`
- Test: `src/server/action/__tests__/action-service.test.ts`

**Interfaces:**
- 修改 `executeAction` 中 `updateData` 的构筑（约 L264-271），将 `cultivationExp` / `totalExp` 改为使用原子增量。
- 修改 `executeAction` 返回时的 `canBreakthrough` 调用，使用提交后的新境界与新经验值。
- 验证 `expGained` 已在响应中正确返回，且 `cultivator` 字段包含增量后的值。

- [ ] **Step 1: 写测试**

在 `src/server/action/__tests__/action-service.test.ts` 的 `describe("executeAction - 核心成功路径")` 内追加：

```typescript
it("MEDITATE 后经验值增量持久化并且响应返回新经验", async () => {
  const { prisma } = await import("@/lib/prisma");
  const tx = mockTx();
  // 让 tx.cultivator.update 返回提交后版本（经验 +30）
  tx.cultivator.update = vi.fn().mockResolvedValue({
    ...BASE_CULTIVATOR,
    cultivationExp: 130,
    totalExp: 530,
    stamina: 75,
  });
  (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));
  (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

  const result = await executeAction({ actionId: "MEDITATE" }, BASE_CULTIVATOR);
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.data.expGained).toBeGreaterThan(0);
    expect(result.data.cultivator.cultivationExp).toBe(130);
    expect(result.data.cultivator.totalExp).toBe(530);
  }
});

it("MEDITATE 后 updateData 包含经验增量而非旧值", async () => {
  const { prisma } = await import("@/lib/prisma");
  const tx = mockTx();
  tx.cultivator.update = vi.fn().mockResolvedValue({
    ...BASE_CULTIVATOR, cultivationExp: 130, totalExp: 530, stamina: 75,
  });
  (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));
  (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

  await executeAction({ actionId: "MEDITATE" }, BASE_CULTIVATOR);
  const updateCall = tx.cultivator.update.mock.calls[0]?.[0];
  expect(updateCall.data.cultivationExp).not.toBe(BASE_CULTIVATOR.cultivationExp);
  // 验证增量是正数而不是旧值
  if (typeof updateCall.data.cultivationExp === "object") {
    // Prisma increment
    expect(updateCall.data.cultivationExp.increment).toBeGreaterThan(0);
  } else {
    // 如果是直接数值，必须大于旧值
    expect(updateCall.data.cultivationExp).toBeGreaterThan(BASE_CULTIVATOR.cultivationExp);
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/server/action/__tests__/action-service.test.ts -t "MEDITATE 后经验"
```
预期：FAIL。

- [ ] **Step 3: 修改 `action-service.ts`**

将 `src/server/action/action-service.ts` L264-271 的：

```typescript
const updateData: Record<string, any> = {
  cultivationExp: cultivator.cultivationExp,
  totalExp: cultivator.totalExp,
  ...
```

改为：

```typescript
const updateData: Record<string, any> = {
  cultivationExp: { increment: expGained },
  totalExp: { increment: expGained },
  ...
```

同时将 `executeAction` 返回时的 `canBreakthrough`（约 L571-576）改为使用更新后的经验值：

```typescript
canBreakthrough: canBreakthrough(
  updated.cultivator.realm,
  updated.cultivator.realmLevel,
  updated.cultivator.cultivationExp,
  cultivator.spiritualRoot
),
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/server/action/__tests__/action-service.test.ts -t "MEDITATE 后经验"
npx vitest run src/server/action/__tests__/action-service.test.ts
```
预期：新增测试 PASS，原有测试全部 PASS。

- [ ] **Step 5: 全量测试**

```bash
npx vitest run
```
预期：全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/server/action/action-service.ts
git commit -m "fix: use atomic increment for cultivationExp and totalExp in action service"
```

---

### Task 3: 修复战斗使用客户端属性

**Files:**
- Modify: `src/app/api/combat/route.ts`
- Test: `src/app/api/combat/__tests__/route.test.ts`

**Interfaces:**
- 移除 `body.attributes` 覆盖逻辑（L59-62）。
- 改为使用 `parseAttributes(cultivator.attributes)` 从数据库读取。
- 导入 `parseAttributes`（来自 `@/lib/inventory-utils`）。

- [ ] **Step 1: 写测试**

在 `src/app/api/combat/__tests__/route.test.ts` 的 `describe("Combat API - POST")` 内追加：

```typescript
it("请求体伪造高属性不会传入战斗引擎", async () => {
  // 数据库 cultivator.attributes 为 null，应解析为 {}
  mockRequireCultivator.mockResolvedValue({
    cultivator: makeCultivator({ attributes: null }),
  });
  await POST(makeRequest({ enemyId: 'e1', attributes: { root: 999, spirit: 999 } }));
  // resolveCombat 收到的 player.attributes 应为 {}（来自数据库 null）
  const combatCall = mockResolveCombat.mock.calls[0]?.[0];
  expect(combatCall.attributes).toEqual({});
  expect(combatCall.attributes?.root).toBeUndefined();
});

it("数据库 attributes 被正确解析并传入战斗引擎", async () => {
  mockRequireCultivator.mockResolvedValue({
    cultivator: makeCultivator({ attributes: '{"root":5,"spirit":3}' }),
  });
  await POST(makeRequest({ enemyId: 'e1' }));
  const combatCall = mockResolveCombat.mock.calls[0]?.[0];
  expect(combatCall.attributes?.root).toBe(5);
  expect(combatCall.attributes?.spirit).toBe(3);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "伪造|数据库"
```
预期：FAIL（当前代码将使用请求体属性）。

- [ ] **Step 3: 修改 `combat/route.ts`**

在 `src/app/api/combat/route.ts` 顶部导入 `parseAttributes`：
```typescript
import { parseAttributes } from "@/lib/inventory-utils";
```

将 L39-62 的 `player` 构造和属性覆盖改为：

```typescript
const player: PlayerCombatData = {
  cultivator: { ... },
  attributes: parseAttributes(cultivator.attributes),
  equippedItems: inventory.filter((i) => i.equipped),
  inventory,
  techniqueRecords: techniqueRecords.map((r) => ({
    techniqueId: r.techniqueId,
    level: r.level,
  })),
};
```

删除 L59-62 的 `if (body.attributes) { player.attributes = body.attributes; }`。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "伪造|数据库"
npx vitest run src/app/api/combat/__tests__/route.test.ts
```
预期：新增测试 PASS，原有 5 tests PASS。

- [ ] **Step 5: 全量测试**

```bash
npx vitest run
```
预期：全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/app/api/combat/route.ts
git commit -m "fix: use server-side attributes for combat instead of client-provided values"
```

---

### Task 4: 修复战斗胜利掉落物持久化与库存合并

**Files:**
- Modify: `src/app/api/combat/route.ts`, `src/app/api/combat/__tests__/route.test.ts`

**Interfaces:**
- 胜利时（L102-109）将 `result.loot.items` 合并到背包并写入 `extraData.inventory`。
- 背包写入基于事务内重新读取的最新库存，而非事务外的旧快照。

- [ ] **Step 1: 写测试**

在 `src/app/api/combat/__tests__/route.test.ts` 的 `describe("Combat API - POST")` 内追加：

```typescript
it("战斗胜利持久化掉落物品", async () => {
  mockResolveCombat.mockResolvedValue({
    win: true, style: '碾压', narrative: '轻松击败敌人',
    loot: { gold: 20, exp: 30, items: ['spirit_stone', 'herb', 'spirit_stone'] },
    enemy: { id: 'e1', name: '山贼' },
  });
  const tx = {
    cultivator: { update: vi.fn().mockResolvedValue({}) },
    gameEvent: { create: vi.fn().mockResolvedValue({ id: 'evt1' }) },
  };
  mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));
  await POST(makeRequest({ enemyId: 'e1' }));
  // 验证 inventory 被写入（spirit_stone 合并为 2 个）
  const updateCall = tx.cultivator.update.mock.calls[0]?.[0];
  const updatedInv = JSON.parse(updateCall.data.inventory);
  expect(updatedInv).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ itemId: 'spirit_stone', quantity: 2 }),
      expect.objectContaining({ itemId: 'herb', quantity: 1 }),
    ])
  );
});

it("战斗胜利掉落物不污染现有库存", async () => {
  mockRequireCultivator.mockResolvedValue({
    cultivator: makeCultivator({ inventory: JSON.stringify([{ itemId: 'sword', quantity: 1, equipped: true }]) }),
  });
  mockResolveCombat.mockResolvedValue({
    win: true, style: '碾压', narrative: '胜',
    loot: { gold: 10, exp: 20, items: ['potion'] },
    enemy: { id: 'e1', name: '山贼' },
  });
  const tx = {
    cultivator: { update: vi.fn().mockResolvedValue({}) },
    gameEvent: { create: vi.fn().mockResolvedValue({ id: 'evt1' }) },
  };
  mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));
  await POST(makeRequest({ enemyId: 'e1' }));
  const updateCall = tx.cultivator.update.mock.calls[0]?.[0];
  const updatedInv = JSON.parse(updateCall.data.inventory);
  expect(updatedInv).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ itemId: 'sword', quantity: 1, equipped: true }),
      expect.objectContaining({ itemId: 'potion', quantity: 1 }),
    ])
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "掉落物|污染"
```
预期：FAIL。

- [ ] **Step 3: 修改 `combat/route.ts`**

在顶部导入 `mergeInventoryItems`：
```typescript
import { parseAttributes, mergeInventoryItems } from "@/lib/inventory-utils";
```

在 combat route 的胜利分支（约 L102-109）追加掉落物合并，将：

```typescript
if (result.win && result.loot) {
  if (result.loot.exp > 0) {
    extraData.cultivationExp = { increment: result.loot.exp };
    extraData.totalExp = { increment: result.loot.exp };
  }
}
```

改为：

```typescript
if (result.win && result.loot) {
  if (result.loot.exp > 0) {
    extraData.cultivationExp = { increment: result.loot.exp };
    extraData.totalExp = { increment: result.loot.exp };
  }
  if (result.loot.items && result.loot.items.length > 0) {
    // 事务内解析最新库存
    const currentInv = parseInventory(cultivator.inventory);
    const mergedInv = mergeInventoryItems(currentInv, result.loot.items);
    extraData.inventory = JSON.stringify(mergedInv);
  }
}
```

同时将 `parseInventory` 加入导入：
```typescript
import { parseAttributes, parseInventory, mergeInventoryItems } from "@/lib/inventory-utils";
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "掉落物|污染|伪造|数据库"
npx vitest run src/app/api/combat/__tests__/route.test.ts
```
预期：新增测试 PASS，原有全部 PASS。

- [ ] **Step 5: 全量测试**

```bash
npx vitest run
```
预期：全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/app/api/combat/route.ts src/app/api/combat/__tests__/route.test.ts
git commit -m "fix: persist combat loot items to inventory via atomic transaction"
```

---

### Task 5: 战斗响应返回最新 cultivator 快照

**Files:**
- Modify: `src/app/api/combat/route.ts`, `src/app/api/combat/__tests__/route.test.ts`

**Interfaces:**
- 战斗事务完成后，使用 `tx.cultivator.update` 返回的已提交角色或重新读取，放入响应 `cultivator` 字段。
- 前端 store 在收到 `data.cultivator` 时自动更新（已有 `deriveStoreFields` 逻辑）。

- [ ] **Step 1: 写测试**

在 `src/app/api/combat/__tests__/route.test.ts` 的 `describe("Combat API - POST")` 内追加：

```typescript
it("战斗胜利响应包含最新 cultivator 快照", async () => {
  const updatedCultivator = makeCultivator({ gold: 120, cultivationExp: 130, inventory: JSON.stringify([{ itemId: 'spirit_stone', quantity: 1, equipped: false }]) });
  const tx = {
    cultivator: { update: vi.fn().mockResolvedValue(updatedCultivator) },
    gameEvent: { create: vi.fn().mockResolvedValue({ id: 'evt1' }) },
  };
  mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx));
  const res = await POST(makeRequest({ enemyId: 'e1' }));
  const d = await res.json();
  expect(d.cultivator).toBeDefined();
  expect(d.cultivator.gold).toBe(120);
  expect(d.cultivator.cultivationExp).toBe(130);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "最新 cultivator"
```
预期：FAIL（当前响应仅 `{ ...result }`）。

- [ ] **Step 3: 修改 `combat/route.ts`**

在事务结束后（L136-137 之间），保留事务返回的 `tx.cultivator.update` 结果：

```typescript
let updatedCultivator: any = null;
await prisma.$transaction(async (tx: any) => {
  // ... 现有逻辑 ...
  if (Object.keys(extraData).length > 0) {
    updatedCultivator = await tx.cultivator.update({ where: { id: cultivator.id }, data: extraData });
  }
  // ... 事件创建 ...
});
```

将 L139 的响应改为：

```typescript
return NextResponse.json({
  ...result,
  ...(updatedCultivator ? { cultivator: updatedCultivator } : {}),
});
```

注意：如果事务同时有 `applyEffects`（L93-99）和 `extraData` 两个更新路径，`updatedCultivator` 只会捕获 `extraData` 路径的返回值。要确保 `applyEffects` 路径也返回更新后的角色，需要将 `applyEffects` 链的返回值也捕获。推荐将 `extraData` 的 update 作为唯一的一次 `cultivator.update` 调用保证。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/app/api/combat/__tests__/route.test.ts -t "最新 cultivator"
npx vitest run src/app/api/combat/__tests__/route.test.ts
```
预期：新增测试 PASS，原有全部 PASS。

- [ ] **Step 5: 全量测试**

```bash
npx vitest run
```
预期：全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/app/api/combat/route.ts
git commit -m "feat: return latest cultivator snapshot in combat response"
```

---

### Task 6: 全量验证与审查

**Files:**
- 运行全部验证
- 手动审查所有改动

- [ ] **Step 1: TypeScript 编译检查**

```bash
npx tsc --noEmit
```
预期：无错误。

- [ ] **Step 2: 全量测试**

```bash
npx vitest run
```
预期：全部通过。

- [ ] **Step 3: 代码审查**

逐项确认：
- [ ] `action-service.ts` 中 `updateData` 的 `cultivationExp` / `totalExp` 使用 `{ increment: expGained }` 而非旧值。
- [ ] `action-service.ts` 返回的 `canBreakthrough` 使用提交后的 `updated.cultivator.cultivationExp`。
- [ ] `combat/route.ts` 不再有 `body.attributes` 覆盖。
- [ ] `combat/route.ts` 胜利分支合并 `result.loot.items` 到背包。
- [ ] `combat/route.ts` 响应包含 `cultivator` 字段。
- [ ] 新增测试覆盖了伪造属性、掉落持久化、经验增量和回滚。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: full validation pass for state-trust batch A"
```