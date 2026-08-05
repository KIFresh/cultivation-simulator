## Task 6：仪表盘灵根显示自然化（TDD）

### 文件

- 修改：灵根展示 helper 所在文件（先以 `rg "getRootInfo|中品|_" src/lib src/app/dashboard` 定位）
- 修改：`src/app/dashboard/page.tsx`
- 修改/新增：对应 `src/lib/__tests__/cultivation-data.test.ts` 或展示组件测试

### 实现

1. 保持存档/内部 ID，例如 `木_中品` 与 `chaos`，不做数据迁移。
2. 增加 `formatSpiritualRootLabel(root)`，将五行根骨显示为 `木灵根 · 中品`；天灵根、异灵根、杂灵根使用自然中文名称，绝不显示 `chaos`。
3. 仪表盘只调用 formatter，不直接打印 `getRootInfo(...).name` 的原始值。

### 测试

1. `木_中品 → 木灵根 · 中品`。
2. 杂灵根/`chaos` 不出现英文 `chaos`。
3. 天灵根、无效值仍有安全中文 fallback。

### 验收

```bash
npx vitest run src/lib/__tests__/cultivation-data.test.ts
npx tsc --noEmit
```

提交：`fix: format spiritual root labels naturally`。

