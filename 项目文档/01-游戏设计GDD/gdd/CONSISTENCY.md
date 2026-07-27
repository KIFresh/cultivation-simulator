# 跨 GDD 一致性检查 + 设计理论评审

> 维护者：设计主策 + 技术主程
> 更新频率：每次代码合并后检查；GDD 文档重建后全量核验
> 当前基线：代码库 → GDD 文档（从代码反推重建 v1.0）

---

## 一、MDA 框架评审

| 维度 | GDD 主张 | 代码现状 | 一致？ |
|------|---------|---------|--------|
| **Mechanics（机制）** | 六属性、境界、灵根、功法、战斗、炼丹、奇遇、心魔、寿命、经济、NPC、凡人生活、叙事 AI 共 13 个系统 | 全部代码实现（`src/lib/*` + `src/app/api/*` + `src/store/*`） | ✅ |
| **Dynamics（动态）** | 每日权衡、滚雪球成长、心魔张力、寿命倒逼、轮回放大 | 行动点限制(`actionPointCost`)、突破 buff、心魔阈值、寿命预警、轮回天赋 | ✅ |
| **Aesthetics（美学）** | Discovery/Story, Challenge/Progression, Sensation/Comfort, Expression/Freedom | AI 叙事为唯一表现媒介，SSE 流式 + 心境标签 + emoji 轻量 UI | ✅ |

---

## 二、游戏设计支柱一致性

| 支柱 | GDD 主张 | 代码验证 | 状态 |
|------|---------|---------|------|
| P1 AI 叙事即玩法 | 叙事不是包装而是核心循环 | `narrative.ts` 11 种叙事类型独立生成，`game-store.ts` 将叙事作为每次行动的输出 | ✅ |
| P2 长线成长×轮回重玩 | 六属性→灵根→境界→战力→功法→轮回 | `cultivation-data.ts` 完整境界链 + `轮回逻辑` + `前世记忆`天赋 | ✅ |
| P3 现代都市修仙 | 手机、上学、家庭、商店与修炼共存 | `mortal-life-phone.md` + 凡人生活 + 家庭系统 + 商店 | ✅ |

---

## 三、文档 ↔ 代码对应的已知偏差

### 🟡 等级说明
- **🔴 错误**：文档与代码矛盾，生产环境有直接影响的 bug
- **🟡 偏差**：文档描述与代码实现不完全一致但无生产影响
- **🟢 缺失**：代码已实现但文档未记录

### 当前偏差清单

| # | 等级 | 主题 | 文档描述 | 代码实际 | 文件:行号 |
|---|------|------|---------|---------|----------|
| C-01 | 🔴 | goldChange 字段缺失 | 叙事类型应有统一效果接口 | `narrative.ts` 中 `NarrativeBase` 无 `goldChange`，但 `narrative-types.ts` 的 `NarrativeBase` 有 | `narrative-types.ts:58` vs `narrative.ts:432-439` |
| C-02 | 🔴 | narrative/route.ts 效果缺失 | AI 叙事应产生金币等效果 | 路由中所有 case 均未读取/处理 `goldChange` | `narrative/route.ts:73-390` |
| C-03 | 🟡 | NPC_DIALOGUE 未接入路由 | 系统 GDD 列出了 NPC 对话类型 | 无路由入口，`narrative/route.ts` default 返回"未知叙事类型" | `narrative/route.ts:391-396` |
| C-04 | 🟡 | FAMILY_DEATH/QUARTER_ADVANCE 未实现 | NarrativeType 包含这些类型 | 无对应生成函数和路由 case | `narrative-types.ts` 类型定义 |
| C-05 | 🟡 | 类型定义重复 | 类型应在唯一位置定义 | `narrative-types.ts` 和 `narrative.ts:417-499` 各自定义全套相同类型 | `narrative.ts:417-499` |
| C-06 | 🟡 | Reward 类型不一致 | NPCDialogueNarrative.reward | `narrative-types.ts` 的 reward 字段与 `narrative.ts` 定义的类型结构不同 | `narrative-types.ts:78` vs `narrative.ts:458` |
| C-07 | 🟡 | 家庭对话使用静态 cap | GDD 经济系统应动态 cap | `family-dialogue/route.ts` 使用默认 `clampGoldDelta` 而非 `clampGoldDeltaForRealm` | `family-dialogue/route.ts:98` |
| C-08 | 🟡 | NarrativeDisplay 效果字段缺失 | 前端应展示所有效果 | `dashboard/types.ts` 的 `NarrativeDisplay` 缺少 goldChange 等字段 | `dashboard/types.ts:48-53` |
| C-09 | 🟡 | streamNarrativeResult 参数过窄 | SSE 流式应带效果数据 | 参数类型只有 `narrative: { narrative?: string }` 无效果字段 | `narrative-stream.ts:12-17` |
| C-10 | 🟢 | 亲密度靠近极值无衰减 | — | `family-dialogue/route.ts` 无极值衰减 | `family-dialogue/route.ts:86` |
| C-11 | 🟢 | GOLD_MAX 过小 | — | 1,000,000 对高阶玩家过小 | `gold.ts:9` |
| C-12 | 🟢 | 仪表板重复 NarrativeDisplay | — | `dashboard/types.ts` 和 `dashboard/page.tsx` 各自定义 | `dashboard/page.tsx:35` |
| C-13 | 🟢 | COMBAT 返回纯字符串 | 叙事应为结构化 JSON | `generateCombatNarrative` 返回 `Promise<string>` | `narrative.ts:1032` |
| C-14 | 🟢 | narrative-effects.ts 新增 | 文档 Phase 1 新增模块 | 已创建统一效果契约 | `narrative-effects.ts` |

---

## 四、已修复的偏差（历史记录）

| # | 主题 | 修复日期 | 说明 |
|---|------|---------|------|
| — | 首次重建 | 当前 | 15 个 NUL 损坏 GDD 文档已从代码反推重建 |

---

## 五、设计理论评审（Self-Determination Theory / Flow / Bartle）

### 5.1 自我决定论（SDT）

| 需求 | 满足方式 | 代码锚点 |
|------|---------|---------|
| **自主性** | 自由选择行动（修炼/探索/社交/休息/研读/学校） | `ACTIONS` 行动表 |
| **胜任感** | 境界突破、战力跃迁、炼丹成功 | `BREAKTHROUGH` 成功 + buff |
| **归属感** | 家庭对话、NPC 互动 | `FAMILY_DIALOGUE` 叙事类型 + `intimacy` 系统 |

### 5.2 心流理论（Flow）

| 条件 | 实现方式 |
|------|---------|
| 清晰目标 | 下一境界/下一功法/下一丹药 |
| 即时反馈 | SSE 流式叙事 + 金币/亲密度变化即时展示 |
| 难度适配 | 行动点有限制+境界门槛+动态 cap，玩家自选挑战 |
| 深度专注 | AI 叙事沉浸式文本，一次一个行动 |

### 5.3 Bartle 玩家类型

| 类型 | 满足方式 |
|------|---------|
| **成就者** | 境界突破、战力排行、炼丹全配方 |
| **探索者** | 奇遇探索、地点事件、NPC 对话 |
| **社交者** | 家庭对话、亲密度系统 |
| **杀手** | 战斗系统、PK（未来规划） |

---

## 六、文档-代码锚点映射表

| GDD 文档 | 主要代码文件 | 重建状态 |
|----------|-------------|---------|
| `systems/xiulian.md` | `src/lib/cultivation-data.ts` | 🔴 已损坏，尚未重建 |
| `systems/gongfa.md` | `src/lib/technique-data.ts` | 🔴 已损坏，尚未重建 |
| `systems/combat.md` | `src/lib/combat-engine.ts` | 🔴 已损坏，尚未重建 |
| `systems/liandan.md` | `src/lib/alchemy-data.ts` | ✅ 完好 |
| `systems/narrative-ai.md` | `src/lib/narrative.ts`, `narrative-types.ts`, `narrative-effects.ts` | ✅ 已重建 |
| `systems/lifespan-reincarnation.md` | `src/lib/cultivation-data.ts` | 🔴 已损坏，尚未重建 |
| `systems/economy-shop.md` | `src/lib/gold.ts`, `property-data.ts`, `shop/route.ts` | ✅ 已重建 |
| `systems/npc-relationship.md` | `src/lib/family.ts` | 🔴 已损坏，尚未重建 |
| `systems/mortal-life-phone.md` | `src/lib/cultivation-data.ts` | 🔴 已损坏，尚未重建 |
| `systems/quarter-advance.md` | `src/app/api/advance-year/route.ts` | 🔴 已损坏，尚未重建 |
| `INDEX.md` | — | ✅ 完好 |
| `CONSISTENCY.md` | — | ✅ 本文件已重建 |
| `M2-core-loop-fun.md` | — | 🔴 已损坏，尚未重建 |
| `combat-balance.md` | — | 🔴 已损坏，尚未重建 |
| `health-system.md` | — | 🔴 已损坏，尚未重建 |
| `life-dimension-scheme.md` | — | 🔴 已损坏，尚未重建 |
| `m4-p0-friends.md` | — | 🔴 已损坏，尚未重建 |
| `05-设计急救清单.md` | — | ✅ 已重建 |

---

## 七、裁决待决项（需主理人确认）

| # | 主题 | 分歧 | 建议 |
|---|------|------|------|
| D-01 | `goldChange` 字段归属 | `narrative-types.ts` 有 vs `narrative.ts` 无 | 统一到 `narrative-types.ts` 单一来源，删除 `narrative.ts` 中的重复定义 |
| D-02 | 效果契约方案 | 嵌入 `NarrativeBase.effect?: NarrativeEffect` vs 独立 `effects: NarrativeEffect[]` | 采用 `effects: NarrativeEffect[]` 数组方案（支持多效果叠加），Phase 2 迁移 |
| D-03 | GOLD_MAX 提升 | 当前 1,000,000 vs 建议 10,000,000 | 等待主理人确认后修改 `gold.ts:9` |
| D-04 | 体力预扣策略 | 当前在 AI 调用前扣除 vs 建议 AI 成功后扣除 | 等待主理人确认后修改 `family-dialogue/route.ts:58-60` |
