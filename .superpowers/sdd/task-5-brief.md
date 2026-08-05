## Task 5：新增物品页与技能页、导航入口（TDD）

### 文件

- 修改：`src/components/top-nav.tsx`
- 新建：`src/app/items/page.tsx`
- 新建：`src/app/skills/page.tsx`
- 修改或复用：`src/components/technique-panel.tsx`
- 修改或复用：`src/components/skills-panel.tsx`
- 新建：`src/components/__tests__/top-nav.test.tsx`
- 新建：`src/app/items/__tests__/page.test.tsx`
- 新建：`src/app/skills/__tests__/page.test.tsx`

### 物品页设计

- 顶部说明“背包物品”，不重复展示金币/灵石财务卡片。
- 分类为“可使用”“装备中”“材料/其他”；从服务端验证后的 `inventory` 读取。
- 物品详情显示名称、数量、描述、效果、是否可用；使用按钮调用现有 `POST /api/cultivator/use-item`，完成后以返回的 `cultivator` 更新 store。
- 空状态明确引导“尚无随身物品”。
- `/assets` 保持金币、储蓄、灵石等财务信息，不移动或删除。

### 技能页设计

- 页头两个标签：`功法`、`技艺`。
- 功法：复用现有功法数据、装备/熟练度接口与所有权校验；无功法时展示空状态。
- 技艺：复用 `deriveSkillLevels(attributeExp, subjectExp)`；展示等级、经验、到下一级进度。
- 禁止从 `localStorage.userId` 直接读取其他用户资源；新增/复用页面读取必须以受会话保护的接口与 store 为主。接入前先修复功法 API 的 `requireCultivator` 所有权校验。

### 导航

- 在 `NAV_TABS` 中新增 `{ label: "物品", href: "/items" }` 与 `{ label: "技能", href: "/skills" }`。
- 维持移动端横向滚动和 current route active 样式；导航过长时不挤压品牌区。

### 测试先行

1. TopNav 包含新入口，正确路径得到 active 样式。
2. `/items` 空背包、单件物品、使用成功/失败。
3. `/skills` 在功法/技艺标签切换；无数据、已有经验、装备状态。
4. 功法请求缺少会话、尝试访问他人 ID 均失败。

### 验收

```bash
npx vitest run src/components/__tests__/top-nav.test.tsx src/app/items/__tests__/page.test.tsx src/app/skills/__tests__/page.test.tsx src/components/__tests__/technique-panel.test.tsx
npx tsc --noEmit
```

提交：`feat: add items and skills pages`。

