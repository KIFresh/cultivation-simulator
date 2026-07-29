# Task 2 报告：结构化家庭职业与收入规则

## 已完成

- 新增 `src/lib/family-career.ts`：职业大类、0–4 职级、在职/失业/退休状态、确定性收入计算、职业演进、展示名和家庭收入聚合。
- 职业收入由“职业基础收入 × 职级系数 × 时代/职业系数”派生；`occupation` 与 `incomeLevel` 均由服务端规则派生。
- 未成年人初始化为失业，65 岁及以上退休；家庭收入仅统计在世且在职的父亲、母亲和监护人。
- 新增 `FamilyMember` 结构化职业字段和 SQLite 迁移，保留旧 `occupation` / `incomeLevel`。
- 初始本地家庭、出生 API、出生重试 API 都调用 `initializeFamilyCareer`，不写入 AI 提供的职级或收入；AI 的 `occupation` 只被作为职业大类提示。
- 出生重试路径不再吞没家庭成员写入失败，避免返回伪成功。
- 新增 `src/lib/__tests__/family-career.test.ts`，覆盖 brief 指定的职业类别/职级、家境排序、确定性、年龄边界、时代切换和家庭聚合。

## 验证状态

未能运行下列命令：当前执行环境未提供 shell/命令执行工具，因此无法获得 Vitest、Prisma CLI 或 TypeScript 编译器的实际输出。

```bash
npx prisma migrate dev --name add_family_career
npx prisma generate
npx vitest run src/lib/__tests__/family-career.test.ts
npx tsc --noEmit
```

也尝试语言服务诊断，但环境缺少 `typescript-language-server`。

## 顾虑与后续动作

1. **必须在可执行环境运行 `npx prisma generate`**：当前 `src/generated/prisma` 是 schema 改动前生成的，若未生成，出生 API 对新增字段的 Prisma 写入会被旧 Client 拒绝。该生成步骤会更改 brief 未列出的生成目录，因此本任务未在此工作区执行，以遵守“不得修改分配路径外文件”。
2. **必须运行/应用迁移**：已有本地 `dev.db` 需要通过 Prisma 命令应用新迁移后才能写入新增列。
3. `/api/family` 的旧 POST 覆盖保存路径不在 Task 2 分配文件中，目前不写职业字段；若该 API 仍用于保存家庭，它可能把职业数据重置为数据库默认值。应在后续任务中禁用该入口或在服务端同样调用 `initializeFamilyCareer`。
4. 年度职业结算（调用 `evolveFamilyCareer`）属于后续 Task 3；本 Task 只提供纯函数与出生初始化。
