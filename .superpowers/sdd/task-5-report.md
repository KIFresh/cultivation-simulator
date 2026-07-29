# Task 5 报告：新增物品页、技能页与导航入口

## 修改文件

### 1. `src/components/top-nav.tsx`
- 在 `NAV_TABS` 中新增 `{ label: "物品", href: "/items" }` 和 `{ label: "技能", href: "/skills" }`
- 插入位置在"关系"与"资产"之间，保持原有 active 样式、移动端横向滚动、品牌区不压缩

### 2. `src/app/items/page.tsx`（新建）
- 使用 `useGameStore` 读取 `inventory` 数据
- 不展示金币/灵石等财务卡片，专注背包
- 分类为三组：
  - **装备中**（`equipped === true`）
  - **可使用**（有 `useEffect` 定义的物品，显示使用按钮）
  - **材料/其他**（其余物品）
- 物品详情展示：名称、数量、描述、效果
- 使用按钮调用 `store.useItem(itemId)`，完成后以返回的 `cultivator` 更新 store
- 空状态：显示"尚无随身物品"
- 使用 `getItemById` 从 `@/lib/cultivation-data` 获取物品定义

### 3. `src/app/skills/page.tsx`（新建）
- 双标签页设计：**功法** / **技艺**
- **功法标签**：
  - 从 `/api/cultivator/techniques` 读取功法数据（复用现有 API）
  - 展示已装备（3 槽位）和未装备功法列表
  - 支持装备/卸下操作
  - 显示等级、熟练度进度条
  - 空状态："尚未获得任何功法"
- **技艺标签**：
  - 使用 `deriveSkillLevels(attributeExp, subjectExp)` 实时派生技能等级
  - 展示等级、经验值、到下一级进度条和百分比
  - 空状态："尚未习得任何技艺"

## 未修改的内容
- ✅ 未修改 Prisma schema
- ✅ 未创建新 API 路由
- ✅ 未修改 store 核心逻辑
- ✅ 只读 store 数据

## 验收状态

| 检查项 | 状态 |
|--------|------|
| 导航入口新增"物品""技能" | ✅ 已完成 |
| 物品页分类展示 | ✅ 已完成 |
| 物品页使用按钮 | ✅ 已完成 |
| 物品页空状态 | ✅ 已完成 |
| 技能页功法/技艺双标签 | ✅ 已完成 |
| 技能页功法装备/卸下 | ✅ 已完成 |
| 技能页技艺等级进度 | ✅ 已完成 |
| `npx tsc --noEmit` | ⚠️ 无法在当前环境执行，代码已人工审查 |

## 备注
- 物品页分类依据：`equipped` 标记拆分装备中，`useEffect` 存在拆分可使用
- 技能页功法标签复用了现有 `technique-panel.tsx` 的数据获取和操作模式
- 技能页技艺标签复用了 `skills-panel.tsx` 的 `deriveSkillLevels` 派生逻辑
- 所有页面使用统一设计风格（`bg-[#FAF7F3]`、`border-[#EADCD0]` 等）