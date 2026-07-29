# Task 1: 新增 mergeInventoryItems 纯函数

## 状态：代码已完成，测试和提交需手动执行

## 修改文件

### 1. `src/lib/inventory-utils.ts`
- 在 `consumeInventoryItem` 之后追加了 `mergeInventoryItems` 函数（第 95-109 行）
- 导出函数签名：`mergeInventoryItems(inventory: InventoryItem[], itemIds: string[]): InventoryItem[]`
- 纯函数实现：浅拷贝原数组，遍历 itemIds 累加 quantity 或新增条目，不修改原数组

### 2. `src/lib/__tests__/inventory-utils.test.ts`
- 在文件末尾追加了 `mergeInventoryItems` 的 6 个测试用例（第 105-144 行）
- 测试覆盖：空背包添加物品、已有 stack 累加数量、重复掉落 ID 累加多次、不修改原输入数组、保留 equipped 状态、空数组返回副本

## 遇到的问题

当前子代理环境没有 shell 执行能力，无法运行以下命令：
- `npx vitest run src/lib/__tests__/inventory-utils.test.ts -t "mergeInventoryItems"`（测试）
- `npx vitest run`（全量测试）
- `npx tsc --noEmit`（TypeScript 检查）
- `git add / git commit`（提交）

## 需手动执行的步骤

```powershell
# 1. 运行测试确认失败（预期：mergeInventoryItems 未定义错误）
npx vitest run src/lib/__tests__/inventory-utils.test.ts -t "mergeInventoryItems"

# 2. 实现完成后运行测试确认通过（预期：6 passed）
npx vitest run src/lib/__tests__/inventory-utils.test.ts -t "mergeInventoryItems"

# 3. 全量测试
npx vitest run

# 4. TypeScript 检查
npx tsc --noEmit

# 5. 提交
git add src/lib/inventory-utils.ts src/lib/__tests__/inventory-utils.test.ts
git commit -m "feat: add mergeInventoryItems pure function"
```

## 代码变更摘要

### 实现代码（`src/lib/inventory-utils.ts`）
```typescript
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

### 测试代码（`src/lib/__tests__/inventory-utils.test.ts`）
- 6 个测试用例，覆盖所有预期行为
- 使用 `import { mergeInventoryItems } from "@/lib/inventory-utils"`（路径别名）