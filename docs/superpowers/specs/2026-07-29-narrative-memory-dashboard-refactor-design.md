# 叙事记忆清理 + 仪表盘优化 — 设计文档

## 概述

解决仪表盘稳定性问题（双重 API 调用、竞态循环、重复计算）和叙事记忆遗留字段清理，分 3 批交付。本文件覆盖 Batch 1。

## Batch 1 范围

### 1. 消除双重 API 调用

**问题**：`useDashboardActions` 的 `advanceSeason` 独立调用 `/api/advance-quarter`，同时 `useGameStore` 的 `advanceQuarter` 也调用同一接口。`performAction` 同理。

**方案**：统一使用 `useGameStore` 的 `performAction`/`advanceQuarter`，移除 `useDashboardActions` 中重复的 `fetch` 调用。`useDashboardActions` 只保留回调处理（响应解析 → 更新本地 state）。

**改动文件**：
- `src/app/dashboard/hooks/use-dashboard-actions.ts` — 移除重复 fetch，改为调用 store 方法
- `src/app/dashboard/hooks/use-dashboard-state.ts` — 调整事件处理函数

### 2. 修复竞态循环

**问题**：`loadCultivator` 的 `useCallback` 依赖 `narrative`，导致 `narrative` 变化 → `loadCultivator` 重建 → `useEffect` 重新执行 → 再次 `setNarrative` 的循环。

**方案**：移除 `narrative` 依赖，改用 `useRef` 追踪上次 narrative 变更时间戳。

**改动文件**：
- `src/app/dashboard/hooks/use-dashboard-state.ts` — 修复依赖

### 3. 提取共享计算 + React.memo

**问题**：NPC 合并逻辑在 `page.tsx`（行 108-123）和 `NarrativePanel`（行 138-148）各算一次；子组件无 `React.memo` 包装。

**方案**：
- 将 NPC 合并逻辑提取为 `src/lib/npc-utils.ts` 中的共享函数
- 对 `NarrativePanel`、`AttributeGrid`、`StatusGauge`、`InventoryPanel` 加 `React.memo`
- 对 `NarrativePanel` 中内联函数和 `filter` 加 `useMemo`/`useCallback`

**改动文件**：
- `src/lib/npc-utils.ts` — 新建，提取 `mergeNpcs` 函数
- `src/app/dashboard/page.tsx` — 使用共享函数
- `src/app/dashboard/_components/narrative-panel.tsx` — memo + useMemo
- `src/app/dashboard/_components/attribute-grid.tsx` — memo
- `src/app/dashboard/_components/status-gauge.tsx` — memo
- `src/app/dashboard/_components/inventory-panel.tsx` — memo

### 4. 清理 storySummary 遗留字段

**问题**：`Cultivator` 表的 `storySummary` 和 `storySummaryUpdatedAt` 已不再使用（改用 `storyEntries`），但仍存在于 schema、类型和 `NarrativeStateSnapshot` 中。

**方案**：
- Prisma schema：移除 `storySummary` 和 `storySummaryUpdatedAt`
- 生成迁移
- 代码中所有引用改为 `storyEntries`
- `NarrativeStateSnapshot` 中移除 `storySummary`

**改动文件**：
- `prisma/schema.prisma` — 移除字段
- `prisma/migrations/` — 新增迁移
- `src/lib/narrative-context.ts` — 移除 `storySummary` 引用
- 搜索所有引用 `storySummary` 的代码并替换

## 不包含在 Batch 1 的内容

- 派生数据改 `useMemo`（Batch 2）
- 结构化记忆注入（Batch 2）
- 道心明镜 UI 增强（Batch 3）