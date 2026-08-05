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


## 补充：Task 2 审查必修项

在本任务一并完成下列阻塞项，避免职业系统成为半成品：

1. `src/lib/auth-helpers.ts` 的 `CultivatorWithUser` 必须包含 `worldYear`，使出生 API 的服务端世界年份读取可通过类型检查。
2. `src/app/api/family/route.ts` 的全量保存不得删除/重建导致已持久化职业字段丢失；客户端不得提交或覆盖结构化职业与收入字段。用稳定 ID 保留既有成员的服务端职业数据；新增成员由服务端以可信默认背景初始化职业。补充 API 回归测试。
3. 出生与出生重试的家境输入不能直接信任客户端任意数字。采用现有身份/出身的服务端白名单映射（或持久化值）；明确记录哪个字段是可信来源。若目前数据模型尚没有持久化出身，至少只允许从有限的 identity ID 映射推导等级并拒绝任意 birthTier 数字。
4. 对旧存档 `careerCategory` 为空或非法的成员，在 Task 3 跨年结算前使用确定性初始化归一化后再演进。
5. 在 Prisma schema 变更后由控制器运行 `npx prisma generate`，不提交 generated 目录（该项目从 `src/generated/prisma` 生成且 .gitignore 忽略产物）。
