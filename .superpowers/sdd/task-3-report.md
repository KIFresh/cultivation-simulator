# Task 3 实施报告

## 已实现

- `advance-quarter` 在季度 `4 → 1` 时将 `worldYear` 加一；普通季度保持原年份。响应增加 `worldYear`、`era`，以及仅供展示的 `familyCareerChanges`。
- 跨年读取在世家庭成员；空值/非法 `careerCategory`（及非法状态）按现有职业提示和稳定 `cultivatorId|memberId|year` 种子确定性归一化，之后调用 `evolveFamilyCareer`。
- 修炼者乐观锁更新及家庭职业字段更新放在同一 Prisma 事务：若未抢到 `quarter + age` 条件，不写入任何职业更新并返回 `409 SEASON_CONFLICT`。
- `calculateHouseholdIncome` 的统一 `HouseholdIncome.incomeLevel` 已驱动跨年年度额度、学龄零花钱与行动索要上限；保留旧函数调用的兼容回退。
- `CultivatorWithUser` 已增加 `worldYear: number`。
- `familyCareerChanges` 仅返回关系、名字、前后状态/级别和展示职业，不返回种子或收入金额。

## 测试改动

- `src/app/api/__tests__/advance-quarter.test.ts`
  - 跨年增加年龄和世界年份。
  - 普通季度不改变世界年份。
  - 旧职业字段为空时归一化、持久化，并返回不含种子的展示变化。
- `src/lib/__tests__/family-allowance.test.ts`：年度额度使用统一家庭收入档位。
- `src/lib/__tests__/savings.test.ts`：学龄零花钱使用统一家庭收入档位，父母排列不影响结果。
- `src/lib/__tests__/action-gifts.test.ts`：索要上限使用统一家庭收入档位。

## 验证状态

本子代理环境没有可执行 shell；尝试委派只读测试时其工具集也不含 shell。因此**未实际运行** Vitest 或 TypeScript，主代理需运行：

```bash
npx vitest run src/app/api/__tests__/advance-quarter.test.ts src/lib/__tests__/family-allowance.test.ts src/lib/__tests__/savings.test.ts src/lib/__tests__/action-gifts.test.ts
npx tsc --noEmit
```

TypeScript LSP 亦不可用（环境未安装 `typescript-language-server`）。

## 未完成/已知限制

- Task 2 必修项要求的家庭全量保存按稳定 ID 更新、保留职业，以及出生/重试从可信身份映射推导 `birthTier`，涉及 `src/app/api/family/route.ts`、出生与重试路由；这些不在本任务分配的可修改路径中，故本实现没有改动。现有全量保存依然会删除后重建成员，虽不会接受客户端职业/收入字段，但会丢失既有服务端职业数据，必须由拥有这些路径的任务完成整改。
- “职业变化作为系统事实提供给叙事 prompt、禁止叙事虚构职业/收入”需改叙事路由/提示词，不在本任务分配路径内，尚未接入。
