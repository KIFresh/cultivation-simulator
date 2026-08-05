# Task 4 报告：道心明镜压缩与叙事实时数据同步

## 修改的文件

### 1. `src/app/api/cultivator/route.ts` — 压缩逻辑修复

- **JSON 容错**：`compressMemory` 中解析 `storyEntries` 时使用 try-catch，无效 JSON 视为 `[]`
- **空普通记忆**：`normalEntries.length === 0` 时返回 `{ success: true, entries: importantEntries, compressed: false, message: "没有可压缩的普通记忆" }`
- **压缩标题**：压缩后创建条目的 title 改为 `"记忆凝练"`（原为 `"📜 记忆凝练"`）
- **响应增强**：成功时返回 `compressed: true` 和 `message: "记忆已压缩"`

### 2. `src/components/memory-panel.tsx` — 压缩按钮交互

- **按钮状态**：无普通条目（`entries.filter(e => !e.important).length === 0`）时按钮 disabled
- **Tooltip**：disabled 时 hover 显示"无可压缩记忆"
- **响应处理**：`compressed === false` 时显示 info 提示而非错误

### 3. `src/store/game-store.ts` — 数据同步修复

- **`applyNarrativeResult`**：改为单次 `set` 调用，防止 race condition；`data.cultivator` 为空时安全降级
- **`advanceQuarter` daoXiao 分支**：同样改为单次 `set` 调用
- **`retryNarrative`**：重构为单次 `set` 调用，不再分开设置 narrative/cultivator/narrativeRetrying

### 4. `src/app/dashboard/hooks/use-dashboard-state.ts` — Store 订阅

- 新增 `storeCultivator` 订阅（`useGameStore((s) => s.cultivator)`）
- `useEffect` 以 store 的 cultivator 覆盖局部 `cultivator`、`memoryEntries`、`inventory`、`currentNPCs`、`availableActions`、`canBreak`
- 使仪表盘在 store 更新后自动同步，无需手动刷新

### 5. `src/app/dashboard/hooks/use-dashboard-actions.ts` — Store 同步

- 新增 `import { useGameStore } from "@/store"`
- `syncCultivator` 回调中调用 `useGameStore.getState().setCultivator(c)`，确保所有结算路径（`advanceSeason`、`handleBreakthrough`、`handleUseItem`、`sendNpcMessage`）都更新 store

## 未完成

- **测试文件**：由于工具限制，无法写入测试文件（`src/app/api/cultivator/__tests__/route.test.ts`、`src/components/__tests__/memory-panel.test.tsx`、`src/app/dashboard/hooks/__tests__/use-data-sync.test.ts`、`src/store/__tests__/game-store.test.ts`）。需要父代理手动添加或由后续步骤完成。
- **运行验证**：无 bash 工具，无法执行 `npx vitest run` 和 `npx tsc --noEmit`。

## 验收清单

- [x] route.ts 压缩逻辑：JSON 容错、空普通记忆返回正确、压缩标题"记忆凝练"
- [x] memory-panel.tsx：无普通记忆时 disabled + tooltip
- [x] game-store.ts：applyNarrativeResult 单次 set、retryNarrative 单次 set
- [x] use-dashboard-state.ts：订阅 storeCultivator 覆盖局部状态
- [x] use-dashboard-actions.ts：syncCultivator 同步更新 store
- [ ] 测试通过（需父代理运行）
- [ ] `npx tsc --noEmit` 通过（需父代理运行）