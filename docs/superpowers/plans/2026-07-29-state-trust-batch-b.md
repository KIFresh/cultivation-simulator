# 状态可信与安全：批次 B 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加固遗留 API 鉴权、资源并发保护和突破事务原子性。

**Architecture:** 所有路由统一使用 `requireCultivator()` 鉴权；资源扣减改为 Prisma 原子操作；突破事件创建与角色更新合入同一 `$transaction`。

**Tech Stack:** Next.js 16, Prisma, TypeScript, Vitest

**Branch:** `fix/state-trust-batch-a` (BASE: `e9123ad`)

## Global Constraints

- 所有状态变更必须在事务内完成，不得出现部分写入。
- 所有路由统一使用 `requireCultivator()`，忽略请求体中的 `userId`。
- 资源扣减使用 Prisma 原子操作（`{ increment }` / `{ decrement }`），不在应用层计算差值。
- 突破事件创建与角色更新合入同一 `$transaction(async (tx) => {...})`，AI 叙事生成保持在事务外。
- 新增/修改的测试必须覆盖成功路径、失败回滚和未认证访问。
- 每项任务完成后先运行定向测试，再运行全量测试。
- 不直接 push main。

---

### Task 1: 鉴权加固 — cultivator/route.ts

**Files:**
- Modify: `src/app/api/cultivator/route.ts`
- Test: `src/app/api/cultivator/__tests__/route.test.ts`

**改造点：**
- `updateMemory`（L26-41）：移除 `rest.userId` 信任，改为使用 `requireCultivator` 返回的 `cultivator.id` 查找。
- `compressMemory`（L44-81）：同上。
- POST 创建路径（L84-171）：已有 `requireCultivator` 逻辑的路径不受影响。创建角色（新用户/已有用户）路径保持原样不动。
- PATCH（L201-224）：接入 `requireCultivator`，用 `cultivator.id` 更新。
- GET（L237-248）：接入 `requireCultivator`，用 `cultivator.id` 查询。

**注意**：`updateMemory` 和 `compressMemory` 均通过 `action` 字段区分，与创建角色共享同一个 POST handler。需要为这两个 action 分支添加 `requireCultivator` 调用。

- [ ] **Step 1: 追加测试**

在 `src/app/api/cultivator/__tests__/route.test.ts` 的 `describe("Cultivator API - POST 创建修炼者")` 末尾追加：

```typescript
it("updateMemory 无认证返回 401", async () => {
  // 不 mock requireCultivator，让它返回 401
  const res = await POST(makeRequest({ action: 'updateMemory', userId: 'u1', storyEntries: [{ text: 'test' }] }));
  expect(res.status).toBe(401);
});

it("compressMemory 无认证返回 401", async () => {
  const res = await POST(makeRequest({ action: 'compressMemory', userId: 'u1' }));
  expect(res.status).toBe(401);
});
```

在 `describe("Cultivator API - PATCH")` 末尾追加：

```typescript
it("PATCH 无认证返回 401", async () => {
  const req = { json: async () => ({ userId: 'u1', location: 'home' }) } as NextRequest;
  const res = await PATCH(req);
  expect(res.status).toBe(401);
});
```

在 `describe("Cultivator API - GET 查询修炼者")` 末尾追加：

```typescript
it("GET 无认证返回 401", async () => {
  const req = { url: 'http://localhost/api/cultivator?userId=u1', nextUrl: { searchParams: new URL('http://localhost/api/cultivator?userId=u1').searchParams } } as NextRequest;
  const res = await GET(req);
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/app/api/cultivator/__tests__/route.test.ts -t "无认证"
```
预期：FAIL（当前这些路径未鉴权，返回 200 或 400）。

- [ ] **Step 3: 修改 `cultivator/route.ts`**

在 `updateMemory` 分支（L26）前插入 `requireCultivator`：
```typescript
if (action === "updateMemory") {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;
  if (!rest.storyEntries) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }
  const updated = await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: {
      storyEntries: JSON.stringify(rest.storyEntries),
      storyEntriesUpdatedAt: new Date(),
    },
  });
  return NextResponse.json({
    success: true,
    entries: JSON.parse(updated.storyEntries || '[]'),
  });
}
```

在 `compressMemory` 分支（L44）前插入 `requireCultivator`：
```typescript
if (action === "compressMemory") {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;
  // ... 现有逻辑，但使用 cultivator.id 而非 rest.userId
```

将 PATCH handler 改为：
```typescript
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const body = await request.json();
    const { location, stamina, gold } = body;
    // ... 使用 cultivator.id 更新
    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: { ... },
    });
    return NextResponse.json({ cultivator: updated });
  } catch (error) {
    console.error("更新修炼者失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
```

将 GET handler 改为：
```typescript
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    // 直接返回已有 cultivator（已在 requireCultivator 中查询）
    const user = await prisma.user.findUnique({
      where: { id: cultivator.userId },
      include: { cultivator: true },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("获取修炼者失败:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/app/api/cultivator/__tests__/route.test.ts -t "无认证"
npx vitest run src/app/api/cultivator/__tests__/route.test.ts
```
预期：新增测试 PASS，全部通过。

- [ ] **Step 5: 全量测试**

```bash
npx vitest run
npx tsc --noEmit
```
预期：全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/app/api/cultivator/route.ts
git commit -m "fix: add requireCultivator to cultivator route (updateMemory, compressMemory, PATCH, GET)"
```

---

### Task 2: 鉴权加固 — techniques/route.ts 和 use-item/route.ts

**Files:**
- Modify: `src/app/api/cultivator/techniques/route.ts`, `src/app/api/cultivator/use-item/route.ts`
- Test: 各自测试文件

**改造点：**
- `techniques/route.ts`：GET 和 POST 接入 `requireCultivator`。
- `use-item/route.ts`：POST 接入 `requireCultivator`。

- [ ] **Step 1: 写测试**

在 `src/app/api/cultivator/techniques/__tests__/route.test.ts`（如不存在则在 `src/app/api/cultivator/__tests__/techniques.test.ts`）追加：

```typescript
it("GET 无认证返回 401", async () => {
  const req = { url: 'http://localhost/api/cultivator/techniques?userId=u1', nextUrl: { searchParams: new URL('http://localhost/api/cultivator/techniques?userId=u1').searchParams } } as NextRequest;
  const res = await GET(req);
  expect(res.status).toBe(401);
});

it("POST 无认证返回 401", async () => {
  const res = await POST(makeRequest({ action: 'equip', userId: 'u1', techniqueId: 't1' }));
  expect(res.status).toBe(401);
});
```

在 `src/app/api/cultivator/use-item/__tests__/route.test.ts` 追加：

```typescript
it("POST 无认证返回 401", async () => {
  const res = await POST(makeRequest({ userId: 'u1', itemId: 'herb' }));
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 修改 `techniques/route.ts` 和 `use-item/route.ts`**

两个路由均改为：
```typescript
const auth = await requireCultivator(request);
if ("error" in auth) return auth.error;
const cultivator = auth.cultivator;
```
然后用 `cultivator.id` 或 `cultivator.userId` 替代从请求体取 `userId`。

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 全量测试 + 提交**

```bash
git add src/app/api/cultivator/techniques/route.ts src/app/api/cultivator/use-item/route.ts
git commit -m "fix: add requireCultivator to techniques and use-item routes"
```

---

### Task 3: 资源并发保护 — secret-realm、heal 原子操作

**Files:**
- Modify: `src/app/api/secret-realm/route.ts`, `src/app/api/heal/route.ts`
- Test: 各自测试文件

**改造点：**
- `secret-realm/route.ts:132`：`stamina: cultivator.stamina - 10` → `stamina: { decrement: 10 }`
- `secret-realm/route.ts:152`：同上
- `heal/route.ts:41`：`health: newHealth` → `health: { increment: healAmount }`
- `heal/route.ts:38`：`stamina: newStamina` → `stamina: { decrement: REST_STAMINA_COST }`

- [ ] **Step 1: 改代码**

```typescript
// secret-realm/route.ts:132
data: {
  stamina: { decrement: 10 },
  gold: goldChange ? { increment: goldChange } : undefined,
  // ...
},

// secret-realm/route.ts:152
data: { stamina: { decrement: 10 } },

// heal/route.ts:38-41
const healthBefore = cultivator.health ?? 100;
const healAmount = Math.min(MAX_HEALTH - healthBefore, REST_HEAL_AMOUNT);
const updated = await prisma.cultivator.update({
  where: { id: cultivator.id },
  data: {
    health: { increment: healAmount },
    stamina: { decrement: REST_STAMINA_COST },
  },
});
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run src/app/api/__tests__/health.test.ts
```
预期：通过。

- [ ] **Step 3: 全量测试 + 提交**

```bash
git add src/app/api/secret-realm/route.ts src/app/api/heal/route.ts
git commit -m "fix: use atomic operations for stamina/health in secret-realm and heal"
```

---

### Task 4: 资源并发保护 — use-item 和 cultivator/use-item 原子操作

**Files:**
- Modify: `src/app/api/use-item/route.ts`, `src/app/api/cultivator/use-item/route.ts`
- Test: 各自测试文件

**改造点：**
- `use-item/route.ts:44`：`stamina: Math.min(maxSt, (c.stamina || 0) + effect.value)` → `stamina: { increment: effect.value }`，上限在事务后 clamp。
- `cultivator/use-item/route.ts:49-52`：`stamina: newStamina` → `stamina: { increment: effect.value * quantity }`

- [ ] **Step 1: 改代码**

```typescript
// use-item/route.ts
updateData.stamina = { increment: effect.value };
// 上限 clamp 在事务后通过 Math.min(maxSt, updated.stamina) 处理

// cultivator/use-item/route.ts:49-52
updateData.stamina = { increment: effect.value * quantity };
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run src/app/api/use-item/__tests__/route.test.ts
npx vitest run src/app/api/cultivator/use-item/__tests__/route.test.ts
```

- [ ] **Step 3: 全量测试 + 提交**

```bash
git add src/app/api/use-item/route.ts src/app/api/cultivator/use-item/route.ts
git commit -m "fix: use atomic operations for stamina in use-item routes"
```

---

### Task 5: 突破事务原子性

**Files:**
- Modify: `src/app/api/breakthrough/route.ts`
- Test: `src/app/api/breakthrough/__tests__/route.test.ts`

**改造点：**
- 将 L84-96 的 `gameEvent.create` 和 `cultivator.update` 合并到 `$transaction(async (tx) => {...})` 中。
- AI 叙事生成（`generateNarrative`）保持在事务外。

- [ ] **Step 1: 写测试**

在 `src/app/api/breakthrough/__tests__/route.test.ts` 追加：

```typescript
it("突破失败时事件和角色更新均不持久化", async () => {
  // mock 事务 reject
  mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));
  const res = await POST(makeRequest({ ... }));
  expect(res.status).toBe(500);
  expect(mockPrisma.gameEvent.create).not.toHaveBeenCalled();
  expect(mockPrisma.cultivator.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试确认失败**

- [ ] **Step 3: 修改 `breakthrough/route.ts`**

```typescript
// 将
const breakthroughEvent = await prisma.gameEvent.create({ ... });
const [updatedCultivator] = await prisma.$transaction([
  prisma.cultivator.update({ where: { id: cultivator.id }, data: updateData }),
]);
// 改为
const [updatedCultivator, breakthroughEvent] = await prisma.$transaction(async (tx) => {
  const event = await tx.gameEvent.create({ ... });
  const updated = await tx.cultivator.update({ where: { id: cultivator.id }, data: updateData });
  return [updated, event];
});
```

- [ ] **Step 4: 运行测试确认通过**

- [ ] **Step 5: 全量测试 + 提交**

```bash
git add src/app/api/breakthrough/route.ts
git commit -m "fix: merge breakthrough event and cultivator update into single transaction"
```

---

### Task 6: 全量验证与审查

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
- [ ] `cultivator/route.ts` 的 updateMemory/compressMemory 使用 `requireCultivator`。
- [ ] `cultivator/route.ts` 的 PATCH/GET 使用 `requireCultivator`。
- [ ] `techniques/route.ts` 和 `use-item/route.ts` 使用 `requireCultivator`。
- [ ] `secret-realm/route.ts` 和 `heal/route.ts` 使用原子操作。
- [ ] `use-item/route.ts` 和 `cultivator/use-item/route.ts` 使用原子操作。
- [ ] `breakthrough/route.ts` 的事件和角色更新在同一事务中。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: full validation pass for state-trust batch B"
```