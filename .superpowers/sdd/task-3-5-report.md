# Task 3-5 Report: 战斗三项修复

## 修复内容

### 修复 3：战斗仅使用服务端属性
- 移除了 `body.attributes` 覆盖逻辑（原 L59-62）
- 改为 `parseAttributes(cultivator.attributes)` 从数据库读取属性
- 导入了 `parseAttributes` 从 `@/lib/inventory-utils`

### 修复 4：战斗胜利掉落物持久化
- 胜利时使用 `mergeInventoryItems` 合并 `result.loot.items` 到背包
- 导入了 `parseInventory, mergeInventoryItems` 从 `@/lib/inventory-utils`
- 在事务的 `extraData.inventory` 写入合并后的背包 JSON

### 修复 5：战斗响应返回最新 cultivator 快照
- 添加 `let updatedCultivator: any = null` 声明
- 捕获 `tx.cultivator.update` 返回值
- 响应中添加 `cultivator: updatedCultivator`（条件性）

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/app/api/combat/route.ts` | 导入新增 + 3项修复实现 |
| `src/app/api/combat/__tests__/route.test.ts` | 新增5个测试用例 |

## 测试结果

> ⚠️ 由于子代理环境无 shell 执行权限，测试由父代理执行。

预期结果：
- 5个新增测试（伪造属性、数据库属性、掉落物持久化、不污染库存、返回 cultivator 快照）全部 PASS
- 全部10个测试 PASS

## 提交信息

```bash
git add src/app/api/combat/route.ts src/app/api/combat/__tests__/route.test.ts
git commit -m "fix: combat uses server attributes, persists loot, returns cultivator snapshot"
```

## 遇到的问题

1. 子代理环境无 shell 执行权限，无法直接运行 `npx vitest` 和 `git commit`，需要父代理执行
2. 两个 `extraData` 路径（经验/背包 + 扣物）通过同一个 `tx.cultivator.update` 处理，`updatedCultivator` 只捕获最后一次更新，但 `applyEffects` 路径（gold/mindDemon）通过独立的效果契约处理，不影响 cultivator 快照的完整性