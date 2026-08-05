# Task 1: 鉴权加固 — cultivator/route.ts

## 修改文件
- `src/app/api/cultivator/route.ts`
- `src/app/api/cultivator/__tests__/route.test.ts`

## 改造点

1. **updateMemory 分支**（当前 L26-41）：移除 `rest.userId` 信任，改为使用 `requireCultivator` 返回的 `cultivator.id`。
2. **compressMemory 分支**（当前 L44-81）：同上。
3. **PATCH**（当前 L201-224）：接入 `requireCultivator`。
4. **GET**（当前 L237-248）：接入 `requireCultivator`。

**注意**：创建角色路径（POST 无 action 或 action=create）保持原样，不修改。

## 测试代码

在 `src/app/api/cultivator/__tests__/route.test.ts` 的 `describe("Cultivator API - POST 创建修炼者")` 末尾追加：

```typescript
it("updateMemory 无认证返回 401", async () => {
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

## 实现指南

### updateMemory 分支
在 `action === "updateMemory"` 分支内，顶部插入：
```typescript
const auth = await requireCultivator(request);
if ("error" in auth) return auth.error;
const cultivator = auth.cultivator;
```
然后用 `cultivator.id` 替代 `rest.userId` 操作数据库。

### compressMemory 分支
同上，在 `action === "compressMemory"` 分支内插入 `requireCultivator`，用 `cultivator.id` 替代 `rest.userId`。

**注意**：这两个分支在 `try {` 块内，但 `requireCultivator` 返回 401 时不需要抛异常。

### PATCH
改为：
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

### GET
改为：
```typescript
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
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

## 验证命令

```bash
# Step 1: 先写测试
# Step 2: 确认测试失败
npx vitest run src/app/api/cultivator/__tests__/route.test.ts -t "无认证"

# Step 3: 修改代码
# Step 4: 确认测试通过
npx vitest run src/app/api/cultivator/__tests__/route.test.ts -t "无认证"
npx vitest run src/app/api/cultivator/__tests__/route.test.ts

# Step 5: 全量测试
npx vitest run
npx tsc --noEmit

# Step 6: 提交
git add src/app/api/cultivator/route.ts
git commit -m "fix: add requireCultivator to cultivator route (updateMemory, compressMemory, PATCH, GET)"
```

## 报告要求

完成后写入 `.superpowers/sdd/task-b1-report.md`，包含测试结果、遇到的问题和提交 hash。