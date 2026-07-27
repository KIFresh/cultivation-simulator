# 修仙模拟器 · 游戏设计文档（GDD）总索引

> 单一事实源（Single Source of Truth）GDD · M1 地基第一刀
> 文档版本：v0.1（Alpha 收敛版）· 维护者：设计主策（文策渊）
> 配套代码基线：`src/lib/*`（Next.js 16 App Router + TypeScript + Prisma/libsql + Zustand + React 19）

---

## 一、一句话定位

> **一个由 AI 驱动叙事的「现代都市 × 修仙」文字养成游戏：玩家从 0 岁凡人起步，在真实生活与灵气复苏之间抉择，历经六属性、灵根、功法、战斗、炼丹与轮回，最终叩问飞升。**

文字为唯一表现媒介，AI 为唯一叙事引擎；所有玩法数值均由前端纯函数引擎（`src/lib`）计算，数据库（Prisma/SQLite）仅作持久化。

---

## 二、三根设计支柱（Design Pillars）

| # | 支柱 | 一句话主张 | 不做什么（防支柱漂移） |
|---|------|-----------|------------------------|
| P1 | **AI 叙事即玩法** | 每一次选择都触发连贯、有记忆、风格统一的文字叙事，叙事不是包装而是核心循环。 | 不做固定脚本分支树；不出现"选择 A→固定段落 B"的硬编码叙事。 |
| P2 | **长线成长 × 轮回重玩** | 六属性 → 灵根 → 境界 → 战力 → 功法 → 轮回，构成可重玩的百年级成长弧。 | 不做一次性通关；不设计"满级即完结"的死局（道消/轮回是常态而非失败）。 |
| P3 | **现代都市修仙的轻松融合** | 地球世界观下，手机、上学、家庭、商店与修炼无缝共存，低门槛、强日常感。 | 不做硬核宗门门派斗争为唯一主线；不把现实系统做成与修仙无关的纯模拟。 |

---

## 三、MDA 框架摘要

### Mechanics（机制层 — 代码已实现的核心系统）
- **六属性经验系统**：`root`(根骨)/`spirit`(灵性)/`insight`(悟性)/`luck`(气运)/`charm`(魅力)/`mind`(心性)，经验→等级（`expToNextLevel = base × level²`）。
- **境界 & 经验**：`REALM_ORDER`（凡人→渡劫期 10 阶）；炼气期 13 小层，其余多为 3 层；突破阈值 `getRequiredExp` + `breakthroughBuff` 减免。
- **行动点 & 行动**：`ACTIONS` 行动表（修炼/探索/社交/休息/研读/学校），按 `actionPointCost` 消耗、`ACTION_ATTR_MAP` 加权分配属性经验。
- **灵根**：五行(金木水火土)×品级(上/中/下品) + 杂灵根，经 `SPIRITUAL_ROOTS` Proxy 动态解析，`speedBonus`（×0.2～×2+）影响修炼速度。
- **功法**：5 品级(凡黄玄地天)、3 装备槽、`calculateTechniqueBonuses` 聚合 4 类效果(cultivationSpeed/breakthroughRate/combat/daily)、`addProficiency` 多级跳、`calcTechniqueProficiency` 熟练度增量。
- **战斗引擎**：`calculateCombatPower = base × realmMult(1.5^idx) × techniqueBonus × equipmentBonus`；`resolveBattle` 战力比判定；Loot Explosion 掉落；4 档战败惩罚 + 道消。
- **炼丹**：静态常量 `ALCHEMY_FORMULAS`(5 配方)/`FURNACES`(4 丹炉)，品质乘区 0.5/1.0/1.5/2.0，丹毒累积 `getToxicityGain`。
- **奇遇**：`ENCOUNTER_POOL`(3 个)，30% 触发、每日上限 3，低/中/高三选项，高风险概率 = `40% + 灵根 + 境界`（封顶 85%）。
- **心魔**：阈值 50，`checkMindDemon` 按 `mindDemon/2%` 概率触发，`MIND_DEMON_EFFECTS` 增减表。
- **寿命 & 轮回**：`calculateMaxAge = BASE_LIFESPAN + root×2 + mind×1 + bonusAge`；大限预警 → 道消 → 轮回转世（重置 + 「前世记忆」天赋 +10%/世）。
- **经济 & 商店**：`gold` + `PROPERTY_DEFS`(公寓/住宅/别墅/汽车) + `FURNITURE_ITEMS` + 各地点 `shopItems`。
- **NPC & 家庭**：`FamilyMember`（生成/亲密 decay）、位置感知 NPC、`NpcChatInfo` 对话。
- **手机 & 凡人生活**：0–16 岁凡人生活、升学(幼儿园→大学)、六项属性、`schoolRank`(普通/重点/名校)。
- **叙事 AI**：多供应方（Anthropic/OpenAI/Ollama，优先级 1→2→3 重试），`UnifiedNarrative` 类型体系，`storyEntries` 记忆积累。

### Dynamics（动态层 — 玩家实际体验到的行为）
- **每日权衡**：行动点有限，玩家在"修炼冲境界 / 探索刷材料 / 社交养关系 / 休息回体力"间博弈。
- **滚雪球成长**：属性↑ → 境界↑ → 战力↑ → 可挑战更强敌人 → 掉更好材料 → 炼丹/装备↑ → 再上一层。
- **心魔张力**：连续战斗胜利(+5/胜)与突破失败(+15)持续累积心魔，逼迫玩家用闭关(-5)/愈灵符(-20)/突破成功(-30)对冲。
- **寿命倒逼**：大限预警把"何时突破"变成紧迫决策，而非无限囤经验。
- **轮回放大**：每世「前世记忆」+10% 修炼速度，重玩动机内建于系统。

### Aesthetics（美学层 — 期望唤起的情感）
- **Discovery / Story（叙事沉浸）**：AI 叙事带来"我的故事独一无二"的惊奇感。
- **Challenge / Progression（成长满足）**：境界突破、战力跃迁、轮回加速的爽点。
- **Sensation / Comfort（舒适养成）**：现代都市日常（上学、家庭、手机）的轻松陪伴感。
- **Expression / Freedom（自由探索）**：行动选择、奇遇选项、多世界观带来的自主感。

---

## 四、范围分层（Scope Tiers）

### 🟢 核心（MVP — 当前 Alpha 必须可玩）
创建角色 → 凡人成长(0–16) → 修仙觉醒(16) → 行动修炼 → 突破境界 → AI 叙事 → 记忆积累(`storyEntries`) → 道消/轮回。
覆盖系统：修炼体系、功法、战斗、叙事 AI、寿命与轮回、经济与商店、NPC 与关系、手机/凡人生活、炼丹（基础配方）。

### 🟡 延伸（目标版本 — Alpha→Beta 增强）
- 炼丹全流程 + 丹毒平衡 + 丹炉品质曲线精调。
- 奇遇系统（3 个→扩展池）、心魔深度事件、功法熟练度随机事件。
- 家庭/位置 NPC 深度对话与关系网络。
- 手机 APP 生态（消息/地图/购物/任务/社交）完整化。
- 坊市（修仙者交易市场）经济闭环。

### 🔵 远期（愿景版本 — 不阻塞当前）
- 多世界观并存（地球 / 疯狂世界「畸变修行」）。
- 宗门/社交系统、跨世叙事、UGC 功法/丹方。
- 诡异侵蚀机制、理智 vs 力量走钢丝。
- 移动端原生体验与离线 AI 推理。

---

## 五、视觉锚点（Visual Anchors）

| 维度 | 锚点 |
|------|------|
| 媒介 | **纯文字 + 轻量图标 emoji**，无美术资产依赖；叙事为主表现层。 |
| 美术基调 | 现代都市修仙 = **赛博水墨 / 灵气青 × 玄黑 × 描金**。 |
| 主色板 | 灵气青 `#3FB8AF` · 玄墨黑 `#1A1A1A` · 描金 `#D4AF37` · 警示红 `#C0392B`(心魔/道消)。 |
| HUD 组件 | 状态条(status-bar) · 行动面板(action-panel) · 叙事显示(narrative-display) · 背包(inventory-panel) · 位置面板(location-panel) · 炼丹面板(alchemy-panel) · 记忆面板/道心明镜(memory-panel) · 功法面板(technique-panel) · 道消弹窗(dao-xiao-modal)。 |
| 技术形态 | Next.js 16 App Router + React 19 + Zustand；移动端优先、响应式。 |
| 反馈语言 | 中文、仙侠文风（现代都市修仙），禁止在叙事中暴露 meta 数字（见叙事 AI GDD 六③）。 |

---

## 六、文档地图（Document Map）

### 总览与评审
| 文档 | 内容 |
|------|------|
| `design/gdd/INDEX.md`（本文件） | 定位、支柱、MDA、范围分层、视觉锚点、文档地图。 |
| `design/gdd/CONSISTENCY.md` | 跨 GDD 一致性检查 + 设计理论评审（MDA / 自我决定论 / 心流 / Bartle）+ 文档↔代码对应与冲突。 |

### 系统 GDD（八节结构：①概述 ②设计目标 ③核心机制 ④数值/平衡 ⑤玩家流程 ⑥界面与反馈 ⑦依赖关系 ⑧风险与开放问题）
| 路径 | 系统 | 核心代码锚点 |
|------|------|--------------|
| `design/gdd/systems/xiulian.md` | 修炼体系 | `cultivation-data.ts`(REALM_ORDER/REALMS/BASE_LIFESPAN/SPIRITUAL_ROOTS/ACTION_ATTR_MAP) |
| `design/gdd/systems/gongfa.md` | 功法系统 | `technique-data.ts`(TECHNIQUES/calculateTechniqueBonuses/addProficiency) |
| `design/gdd/systems/combat.md` | 战斗系统 | `combat-engine.ts`/`enemy-data.ts`/`fragment-synthesis.ts` |
| `design/gdd/systems/liandan.md` | 炼丹系统 | `alchemy-data.ts` |
| `design/gdd/systems/narrative-ai.md` | 叙事 AI | `narrative.ts`(含已合并提示词)/`narrative-types.ts`/`narrative-effects.ts`(效果契约,Phase 1 新增) |
| `design/gdd/systems/lifespan-reincarnation.md` | 寿命与轮回 | `cultivation-data.ts`(calculateMaxAge) + 轮回逻辑 |
| `design/gdd/systems/economy-shop.md` | 经济与商店 | `gold.ts`(钳制逻辑)/`property-data.ts` + 各地点 `shopItems` |
| `design/gdd/systems/npc-relationship.md` | NPC 与关系 | `family.ts` + `store/game-store.ts`(NpcChatInfo/FamilyMember) |
| `design/gdd/systems/mortal-life-phone.md` | 手机与凡人生活 | `cultivation-data.ts`(ACTIONS/LOCATIONS/calculateSchoolRank) + 手机 APP |
| `design/gdd/systems/quarter-advance.md` | 季度推进 | `advance-year/route.ts`(→`advance-quarter`)/`store.advanceYear`/`cultivation-data`/`family.ts`/`mortal-events.ts`/`narrative.ts` |

---

## 附：文档恢复状态

> 2026-07-25 批量修复：15 个 GDD 文档遭遇 NUL 字节损坏（全零填充），已从代码反推重建以下文档：

| 文档 | 状态 | 依据代码 |
|------|------|---------|
| `systems/narrative-ai.md` | ✅ 已重建 | `src/lib/narrative.ts`, `narrative-types.ts`, `narrative-effects.ts`, `narrative-stream.ts`, `sse-client.ts` |
| `systems/economy-shop.md` | ✅ 已重建 | `src/lib/gold.ts`, `property-data.ts`, `src/app/api/shop/route.ts` |
| `CONSISTENCY.md` | ✅ 已重建 | 全量代码审计 |
| `05-设计急救清单.md` | ✅ 已重建 | 全量代码审计 + CONSISTENCY.md 偏差清单 |
| 其余 11 个系统文档 | 🔴 尚未重建 | 等待后续迭代从代码反推 |

---

## 七、阅读约定
- 所有数值以 `src/lib` 当前实现为准；文档与代码冲突时，**代码为权威源**，冲突点统一收录于 `CONSISTENCY.md` 待主理人裁决。
- 属性键名统一使用代码键：`root`/`spirit`/`insight`/`luck`/`charm`/`mind`（旧文档的 `rootBone`/`spirituality`/`comprehension`/`fortune` 已废弃）。
- 八节 GDD 中"④数值/平衡"的单位与公式须可被代码复算；"⑧风险"须给出至少 3 类边缘情况或待决项。
