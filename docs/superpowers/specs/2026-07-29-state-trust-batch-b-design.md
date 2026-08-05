# 状态可信与安全：批次 B 设计

## 目标

加固三方面的服务端安全性：遗留 API 鉴权、资源并发保护、突破事务原子性。确保只有经过身份验证的用户才能操作自己的数据，资源扣减不被并发请求绕过，突破事件不会留下孤立记录。

## 范围

1. 遗留 API 鉴权加固
2. 资源并发保护（原子操作替代旧值计算）
3. 突破事务原子性

## 设计

### 1. 遗留 API 鉴权加固

**原则**：所有路由统一使用 `requireCultivator()` 鉴权，忽略请求体/查询参数中的 `userId`。响应使用 `select` 白名单，不返回密码哈希。

**受影响的路由**：

| 路由 | 改造方式 |
|------|----------|
| `POST /api/cultivator`（action=updateMemory/compressMemory） | 已通过 `requireCultivator` 获取的 `cultivator.id` 操作，移除 `rest.userId` 信任 |
| `PATCH /api/cultivator` | 接入 `requireCultivator`，从 `cultivator.id` 更新 |
| `GET /api/cultivator?userId=` | 改为从 `requireCultivator` 获取 |
| `GET /api/cultivator/techniques?userId=` | 接入 `requireCultivator` |
| `POST /api/cultivator/techniques` | 接入 `requireCultivator` |
| `POST /api/cultivator/use-item` | 接入 `requireCultivator` |

**不受影响**：已使用 `requireCultivator` 的路由（combat、action、narrative、advance-quarter、family、settings、breakthrough 等）。

### 2. 资源并发保护

**原则**：所有资源扣减使用 Prisma 原子操作（`{ increment }` / `{ decrement }`），不在应用层计算差值后赋值。

**受影响的路由**：

| 路由 | 当前写法 | 改为 |
|------|----------|------|
| `secret-realm/route.ts` | `stamina: cultivator.stamina - 10` | `stamina: { decrement: 10 }` |
| `heal/route.ts` | `health: newHealth` | `health: { increment: healAmount }` |
| `use-item/route.ts` | `stamina: Math.min(max, c.stamina + val)` | `stamina: { increment: val }` |
| `cultivator/use-item/route.ts` | `stamina: newStamina` | `stamina: { increment: delta }` |

**不受影响**：savings、arcade、shop、activity 已使用原子操作或乐观锁。

### 3. 突破事务原子性

**原则**：突破事件创建和角色更新必须在同一 `$transaction` 内，AI 叙事生成保持在事务外。

**受影响的路由**：
- `breakthrough/route.ts`：将 `gameEvent.create` 与 `cultivator.update` 合并到 `$transaction(async (tx) => {...})` 中。

## 测试

- 鉴权：每个改造后的路由验证 `requireCultivator` 拦截未认证请求，返回 401。
- 并发：验证原子操作不会因并发请求产生资源透支。
- 突破：验证事件与角色更新原子提交，失败时两者均不持久化。
- 回归：所有已有测试继续通过。

## 验收标准

1. 所有遗留路由不再直接信任请求体中的 `userId`。
2. 并发请求下资源（体力、健康）不会透支。
3. 突破失败时不留下孤立事件。
4. 所有定向测试、全量测试和 TypeScript 检查通过。