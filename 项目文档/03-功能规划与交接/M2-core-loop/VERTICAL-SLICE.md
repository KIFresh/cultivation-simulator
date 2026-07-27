# M2 垂直切片技术定义（让核心循环"可玩且可判好玩"）

> 目标：用**最小技术切片**把 `修炼 → 突破 → 遭遇 → 叙事` 串成玩家可操作、可见反馈、可判断是否好玩的闭环。
> 原则：只接通现有能力、只补最少数据/入口；**不新增功能域**。供主理人汇编冲刺计划。
> 关联文档：`production/M2-core-loop/CORE-LOOP-TRACE.md`（链路结论）、`docs/architecture/M2-core-loop-arch.md`。

---

## Epic M2-VS-1：核心循环打通（端到端可见、可玩）

### Story VS-1.1 — 修炼反馈修复（假接通 → 真接通）【P0】

- **现状（断点）**：`useActions.performAction` 用 `fetchStreamNarrative` 调非流式的 `/api/action`，结果被丢弃，UI 不刷新修炼值/金币/canBreakthrough/叙事（TRACE §1 节点 A / BUG-NEW-1）。
- **方案 A（推荐·最小）**：前端 `useActions.performAction` 改为普通 `fetch("/api/action",{POST})` + `res.json()`，对齐 `dashboard/page.tsx:501`（GO_HOME）与 `game-store.performAction`；拿到 `{narrative, cultivator, expGained, canBreakthrough, goldChanged}` 后调 `handleActionSuccess` 覆盖镜像。删除对 `fetchStreamNarrative` 的调用。
- **方案 B（备选·更大）**：让 `/api/action` 真正 SSE（接通 P1-5 的 `generateActionNarrativeStream`）。
- **验收**：点任意修炼/探索动作后——叙事文本出现；`cultivationExp`/`gold`/`canBreakthrough` 在 UI 更新；store 镜像与实际无漂移；无乐观扣体力残留错位。
- **测试证据**：`src/app/api/__tests__/action.test.ts`（既有，覆盖路由）；新增/补充 `use-actions` 消费 JSON 的前端单测。
- **涉及文件**：`src/app/dashboard/hooks/use-actions.ts`（仅 performAction 内部 fetch 方式）。

### Story VS-1.2 — 遭遇接入前端（死路 → 接通）【P0】

- **现状（断点）**：`/api/encounter` 与 `/api/narrative` type=ENCOUNTER 均无前端触发入口（TRACE §1 节点 C）。
- **推荐方案：接 AI 遭遇 `/api/narrative` type=ENCOUNTER**（已就绪：`generateEncounterNarrative` + `buildEncounterPrompt` + 选择结算经验）。
  - 入口：在 dashboard 增加"外出历练 / 奇遇"按钮（例如仅在 `location==="wild"` 或动作面板常驻），点击触发 `fetch("/api/narrative",{type:"ENCOUNTER"})`。
  - 展示：把返回的 `narrative.choices`（3 项）渲染为选项；选择后 `fetch("/api/narrative",{type:"ENCOUNTER", choiceIndex})` 结算 `expBonus`，叙事入 history。
- **备选方案：接结构化 `/api/encounter`**（复用已修的 `treasure_hunt` 等池）：
  - `GET /api/encounter?source=manual` 触发 → `serializeEncounter` 展示 3 选项 → `POST /api/encounter` 结算（含战斗/物品）。需额外 UI 适配，且要消费 `LOCATIONS.*.encounterPool`（目前休眠）。
  - 优点：能用上本次修好的 `treasure_hunt` 结构化池；缺点：工作量更大。
- **数据条目**：**无需新增**——`ENCOUNTER_POOL` 已含 4 条（含 #7 修好的 `treasure_hunt`）；AI 遭遇由 prompt 生成。
- **验收**：玩家在入口触发奇遇 → 看到 3 选项 → 选择后获得经验/物品 → 叙事进入 history；同一天不超过 3 次（既有上限逻辑）。
- **测试证据**：`src/app/api/__tests__/encounter.test.ts`、`src/app/api/narrative/__tests__/route.test.ts`（既有）；补充前端"触发→选择"流程测试。

### Story VS-1.3 — 突破可见性与分享卡【P1】

- **现状**：突破已接通（TRACE §1 节点 B）。`breakthrough-card.tsx` 组件已存在（筑基/结丹/元婴，3 套素材）。
- **方案**：突破成功后用 `BreakthroughCard` 弹分享卡（数据来自 `cultivator` + `breakthroughCount`）；非三素材境界降级为纯文字提示。
- **验收**：突破成功弹出分享卡（有素材境界）/ 文字提示（无素材境界）。
- **涉及文件**：`src/app/dashboard/page.tsx`（突破成功分支）+ `breakthrough-card.tsx`（既有）。

### Story VS-1.4 — 闭环串联与"可判好玩"指标【P1】

- **串联**：修炼（VS-1.1）→ `canBreakthrough` 变 true → 突破（VS-1.3）→ 野外/历练触发遭遇（VS-1.2）→ 叙事贯穿全程。
- **指标/埋点**：单局可达成"修炼 N 次 → 突破 ≥1 次 → 遭遇 ≥1 次"；统计 `canBreakthrough` 触发率、遭遇触发率（常量 `ENCOUNTER_TRIGGER_RATE=0.3` 可调）。
- **数据条目**：**无需新增**；如需平衡，仅调 `cultivation-data.ts` 内 exp 曲线 / 突破阈值（属调参，非新功能）。

---

## 最小可玩路径（玩家视角）

1. 建号 → 修炼（MEDITATE/EXPLORE…）→ **看到叙事 + 修炼值增长**（VS-1.1 修复后）✅
2. 修炼值够 → 突破按钮出现 → 点突破 → **看到突破叙事 + 分享卡**（节点 B 已通 + VS-1.3）✅
3. 去野外 → 点"奇遇" → **3 选项 → 选择得经验/物品**（VS-1.2 接通后）✅
4. 全程叙事由 `narrative.ts` 单一事实源生成（铁律已守）✅

---

## 明确不做（M2 scope 外，仅观察）

- admin 后门文档、goldChange 无 clamp、SESSION/限流、use-item P0 漏洞。
- narrative.ts 与 narrative-prompts.ts 重复 builder 合并（P0-1）；npc-chat 内联 prompt（P1-1）；ACTION 流式死代码接通（P1-5）。
- 多世界观(疯狂世界)玩法接入、房产/声望深化、炼丹/战斗新内容——属后续 Epic。
- 钉 vite 版本（环境修复，建议主理人单独裁决）。

---

## 切片依赖与优先级

- **P0（必须，否则循环不可玩）**：VS-1.1（修炼可见）、VS-1.2（遭遇入口）。
- **P1（完善可玩性/可判好玩）**：VS-1.3（分享卡）、VS-1.4（指标）。
- 依赖：VS-1.2 不依赖 VS-1.1；但两者都应在同一冲刺完成以验证"闭环"。
- 预估：VS-1.1 / VS-1.2 各为小-中工作量（前端为主，后端能力已就绪）；VS-1.3 小；VS-1.4 小（埋点/调参）。
