## Task 4：修复道心明镜压缩与叙事实时数据同步（TDD）

### 文件

- 修改：`src/app/api/cultivator/route.ts`
- 修改：`src/components/memory-panel.tsx`
- 修改：`src/components/__tests__/memory-panel.test.tsx`
- 修改：`src/store/game-store.ts`
- 修改：`src/app/dashboard/hooks/use-dashboard-actions.ts`
- 修改：`src/app/dashboard/hooks/use-dashboard-state.ts`
- 修改：`src/app/dashboard/hooks/__tests__/use-data-sync.test.ts`
- 新建或修改：`src/app/api/cultivator/__tests__/route.test.ts`

### 记忆压缩规则

1. 解析 `storyEntries` 时容错：无效 JSON 视为 `[]`，不得返回 500。
2. 拆分为 `importantEntries` 与 `ordinaryEntries`。
3. `ordinaryEntries.length === 0` 时，返回 `{ success: true, entries: importantEntries, compressed: false, message: "没有可压缩的普通记忆" }`，前端展示 info/success 提示而非“压缩失败”。
4. 有普通记忆时，调用 `compressStorySummary`，创建单条 `StoryEntry`：`title: "记忆凝练"`、`important: false`；保留所有重要条目。
5. 用更新后的完整 entries 写回数据库并返回 `entries` 与 `storySummary`；前端调用 `onEntriesChange(data.entries)`，同步摘要状态并刷新 Cultivator。
6. 压缩按钮在无普通记忆时显示“无可压缩记忆”或 disabled，并提供原因 tooltip，避免无反馈点击。

### 叙事实时同步规则

1. 所有结算 API 统一在响应中返回持久化后的 `cultivator`；只返回经 `applyEffects`/路由规则写入后的数据。
2. `applyNarrativeResult` 与 dashboard 的 `applyNarrativeResponse` 只用返回的 `cultivator` 更新 store；禁止从 AI 文本解析金币、属性、经验或功法数值。
3. `deriveStoreFields` 持续从最新的 `attributeExp`、`subjectExp`、`inventory` 推导技能等级、背包、金币和行动力。
4. dashboard state 订阅 store 的 `cultivator`，以 store 为准覆盖局部 `cultivator`，使仪表盘无需刷新也更新。
5. 技能组件须由 store 的 `cultivator` 派生；功法列表在 `techniqueEvents` 或最新 Cultivator 返回后重新读取。

### 测试先行

1. 全部普通：压缩为一条“记忆凝练”。
2. 重要 + 普通：保留重要，普通合一。
3. 全部重要：成功响应、条目不变、说明“没有可压缩的普通记忆”。
4. 非法 `storyEntries`：不崩溃且返回可用结果。
5. 带 `attrExp` effect 的叙事响应更新 store 后，`deriveSkillLevels` 立即出现正确等级。
6. 带 `gold`、`stamina`、`inventory` 的结算返回后，仪表盘 store 值与服务端返回相同。

### 验收

```bash
npx vitest run src/components/__tests__/memory-panel.test.tsx src/app/api/cultivator/__tests__/route.test.ts src/app/dashboard/hooks/__tests__/use-data-sync.test.ts src/store/__tests__/game-store.test.ts
npx tsc --noEmit
```

提交：`fix: sync compressed memories and narrative state`。

