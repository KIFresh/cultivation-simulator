# 修仙模拟器 · 数据恢复文档（D 盘迁移清零事件）

> 用途：本文件是后续重建工作的**唯一依据清单**。所有被清零（内容抹空）且无远程备份的文件均在此登记，并给出职责推断、设计意图（来自 GDD 记忆）、构建阻塞等级与重建优先级。
> 生成时间：2026-07-26
> 状态：项目**当前不可构建**——核心 `game-store.ts` 缺失，且大量 lib/页面/hooks 被清零。需按本文档分阶段重建。

---

## 0. 事件摘要

| 项 | 结论 |
|---|---|
| 根因 | D 盘工作副本为**损坏的迁移品**：工作树 ~174 文件被清零（首 16 字节 ≥8 个 `0x00`）；本地 `.git` pack 被毁（签名校验失败）；C 盘原版已按原计划删除 |
| 扫描范围 | 744 个文件（已排除 `node_modules`/`.git`/`recovery_clone`/`.next_old`/`src/generated`/`src/src`/`prisma/prisma`/`.next`） |
| 真正丢失 | **174 个**（清零且无任何备份）：.ts 85 / .md 62 / .tsx 21 / .mjs 2 / .sql 2 / .dot 1 / .py 1 |
| 已救回 | `prisma/schema.prisma`（dev.db 反推）、`globals.css`、完整 `node_modules`、`.env` 绝对路径修正 |
| 存活但无远程 | 313 个（本地未推送但没被清零，安全） |
| 远程备份 | GitHub `KIFresh/cultivation-simulator` 有 `master`+4 分支，但 `master` 仅到"战斗系统合并"时代；**后期功能全部未推送**，4 个功能分支经 `git ls-tree` 确认均不含 `game-store.ts` 等核心丢失文件 |

---

## 1. 当前可运行资产（重建时直接复用，勿重造）

- **`dev.db`**（479KB，有效 SQLite）：含全部 7 模型与在线字段（`mindDemon`/`attributes`/`attributeExp`/`health`/`spiritStoneLow/Mid/High`/`personality`/`resistance`/`physique`/`fate`/`FamilyMember` 等）。数据层完整。
- **`prisma/schema.prisma`**：已用 `prisma db pull` 从 dev.db 重建（Prisma 7：datasource url 在根 `prisma.config.ts`，schema 内不写 url；generator `output=../src/generated/prisma`）。
- **`src/generated/prisma`**：已 `prisma generate`，客户端可用。
- **`node_modules`**：已 `npm install` 补全（`@alloc/quick-lru` 等缺失包已回）。
- **GitHub 基础代码（`recovery_clone/`）**：含 `master`+4 分支，可作接口/旧版实现参考（注意版本落后）。
- **存活的 313 个本地文件 + 克隆里有备份的文件**：直接保留。

---

## 2. 构建阻塞分析（存活代码 import 了哪些丢失模块）

以下为 grep 确认的"存活文件 → 丢失模块"硬依赖（即：不重建这些 lib，对应路由/页面**编译不过**）：

| 丢失模块 | 被谁引用（存活文件） | 阻塞等级 |
|---|---|---|
| `src/lib/logger.ts` | `api/activity`、`api/alchemy/refine`、`api/cultivator/migrate`、`api/dream`、`api/exchange`、`api/auth/auto`、`api/properties`、`api/savings`、`api/family-dialogue`、`api/streets`、`api/spirit-pet`、`api/use-item` 等 **十余条路由** | **P0（最高）** |
| `src/lib/inventory-utils.ts` | `api/spirit-pet`(`parseInventory/hasItemById`)、`api/resolve-event`(`parseAttributes`) | P0 |
| `src/lib/alchemy-data.ts` | `api/alchemy/refine` | P0 |
| `src/lib/exchange.ts` | `api/exchange`(`computeExchange/ExchangeDirection`) | P0 |
| `src/lib/spirit-pet.ts` | `api/spirit-pet` | P0 |
| `src/lib/mortal-events.ts` | `api/resolve-event`(`MORTAL_EVENTS/DINNER/FESTIVAL/EXAM`) | P0 |
| `src/lib/street-omen.ts` | `api/streets`(`generateStreetOmen/DistrictKey`)、`app/streets/page.tsx` | P0 |
| `src/lib/location-events.ts` | `api/location-event`、`app/location-event/page.tsx` | P0 |
| `src/lib/property-data.ts` | `api/properties`(`PROPERTY_DEFS`) | P0 |
| `src/lib/reading.ts` | `lib/__tests__/reading.test.ts`、`app/reading/page.tsx` | P1 |
| `src/lib/dream-events.ts` | `api/dream`(`pickDream`) | P0 |
| `src/lib/family.ts` | `app/create/page.tsx`(`generateEarthFamily`) | P1 |
| `src/lib/clique.ts` | `lib/__tests__/clique.test.ts`、components | P1 |
| `src/lib/weather.ts` | `app/weather/page.tsx`、`lib/short-video.ts`(`BoonEntry`) | P1 |
| `src/store/game-store.ts` | 全局状态中枢，被几乎所有页面/组件间接依赖（dashboard、各功能页） | **P0（核心）** |
| `components/dao-xiao-modal.tsx` | `app/dashboard/page.tsx`（注意：此组件不在丢失清单，但其孪生 `src/src/` 可能有；需确认存活） | P1 |

> `game-store.ts` 虽未在本轮 grep 命中，但它是 Zustand 全局 store，是 dashboard 与全部功能页的数据源，**必须最先重建**。

---

## 3. 按模块丢失清单（详细）

### 3.0 核心状态层（P0，最先重建）
| 文件 | 职责推断 | 设计意图（GDD） | 优先级 |
|---|---|---|---|
| `src/store/game-store.ts` | Zustand 全局状态：当前修士、属性、货币、事件队列、页面路由状态 | 全局单源真相；`useDataSync` 接 `attributeExp/subjectExp` 做技能等级实时同步（`5cf8614`） | **P0** |
| `src/store/__tests__/game-store.test.ts` | store 单元测试 | — | P4 |
| `src/store/__tests__/game-store-stream.test.ts` | store + 流式叙事集成测试 | — | P4 |

### 3.1 炼丹系统（P0/P1）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/lib/alchemy-data.ts` | 丹方定义、`computePillConsumption`、耐药性两轴（resistance 按类型 FLOOR 0.3 + 全局 toxicity 封顶 100）、`DETOX_PER_QUARTER=3` | 炼丹消费闭环（`b122381`）；注意 `DETOX_PER_QUARTER=3` vs 年实现年−5 **待对齐** |
| `src/app/api/alchemy/formulas/route.ts` | 丹方计算 API | — |
| `src/components/alchemy-panel.tsx` | 炼丹 UI 面板 | — |
| `src/lib/__tests__/alchemy-data.test.ts` | 炼丹单测 | P4 |

### 3.2 灵石 / 经济 / 兑换（P0）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/lib/exchange.ts` | 灵石双向兑换（`computeExchange`/`ExchangeDirection`，下/中/上三档） | 🟡-3 灵石修炼增幅 + 双向兑换所（`291c8fb`/`9a8afd8`/`b97b838`） |
| `src/app/api/exchange/route.ts` | 兑换 API | — |
| `src/app/exchange/page.tsx` | 兑换所页面 | — |
| `src/lib/savings.ts` | 灵石/金钱储蓄 | 高阶 sink |
| `src/app/api/savings/route.ts` | 储蓄 API（存活路由，依赖丢失 lib） | — |
| `src/app/savings/page.tsx` | 储蓄页面 | — |
| `src/lib/shop.ts` | 商店物品定义（`getShopItemsForLocation`） | 世俗经济 |
| `src/lib/__tests__/shop.test.ts` | 商店单测 | P4 |
| `src/lib/gold.ts`（测试提及） | 金钱相关（注：实现可能存活，仅测试丢失） | — |

### 3.3 性格系统（P1）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/app/personality/page.tsx` | 性格四维轴页面 | 🟡-2 性格四维轴（`2953d4e`）：复用 `personality` 字段存 JSON 种子 + 记忆确定性聚合，4 消费点（NPC初遇/奇遇权重/对话语气/修炼风格） |
| `src/lib/__tests__/personality.test.ts` | 性格单测 | P4 |
| `src/lib/__tests__/physique.test.ts` | 体质单测 | P4 |
| `src/lib/physique.ts` | 体质维度 | 出身系统：体质/命格维度全落地 |

### 3.4 轮回 / 寿命 / 护道（P0/P1）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/app/api/reincarnation/route.ts` | 轮回转世 API | 高阶 sink 四件之一（`d90528a`+`84ce94e`） |
| `src/app/api/reincarnation-altar/route.ts` | 轮回祭坛 API | — |
| `src/app/reincarnation/page.tsx` | 轮回页面 | — |
| `src/lib/secret-realm-data.ts` | 秘境数据 | 高阶 sink：秘境（`67a04f8`） |
| `src/app/api/secret-realm/route.ts` | 秘境 API | — |
| `src/app/secret-realm/page.tsx` | 秘境页面 | — |
| `src/lib/spirit-pet.ts` | 灵宠数据与逻辑 | 高阶 sink：灵宠（`f5246ae`） |
| `src/app/api/spirit-pet/route.ts` | 灵宠 API（存活路由，依赖丢失 lib） | — |
| `src/app/spirit-pet/page.tsx` | 灵宠页面 | — |
| `src/lib/__tests__/pet.test.ts` / `spirit-pet.test.ts` / `secret-realm-data.test.ts` | 单测 | P4 |

### 3.5 出身 / 社交 / 地点（P1）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/lib/class-enroll.ts` | 出身/入学系统 | 出身系统（`d17e919`/`e64c266`/`a3a6ca4`）：身份/天赋真效果 |
| `src/app/api/class-enroll/route.ts` | 出身 API | — |
| `src/app/class-enroll/page.tsx` | 出身页面 | — |
| `src/lib/clique.ts` | 派系（clique）逻辑 | （桩 `clique.ts` 原属 FW 禁碰区，注意主理人直落约束） |
| `src/components/clique-panel.tsx` | 派系面板 | — |
| `src/lib/family.ts` | 家族生成（`generateEarthFamily`） | FamilyMember 模型已存在 |
| `src/app/api/family/route.ts` | 家族 API | — |
| `src/app/api/location-npc/route.ts` | 地点 NPC API | 世界图鉴/通讯录 |
| `src/app/neighbors/page.tsx` | 邻里页面 | — |
| `src/lib/location-events.ts` | 地点事件 | 地点系统三支柱 |
| `src/lib/__tests__/family.test.ts` / `location-events.test.ts` / `location-npcs.test.ts` | 单测 | P4 |

### 3.6 娱乐 / 叙事 / 杂项（P1）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/lib/arcade.ts` | 街机/小游戏 | 高阶 sink |
| `src/app/api/arcade/route.ts` | 街机 API | — |
| `src/app/arcade/page.tsx` | 街机页面 | — |
| `src/lib/reading.ts` | 读书/卦象 | — |
| `src/app/api/reading/route.ts` | 读书 API | — |
| `src/app/reading/page.tsx` | 读书页面 | — |
| `src/lib/dream-events.ts` | 梦境事件（`pickDream`） | — |
| `src/app/dreams/page.tsx` | 梦境页面 | — |
| `src/lib/short-video.ts` | 短视频（引用 `weather.BoonEntry`） | — |
| `src/app/api/short-video/route.ts` | 短视频 API | — |
| `src/app/short-video/page.tsx` | 短视频页面 | — |
| `src/lib/weather.ts` | 天气系统 | — |
| `src/app/api/weather/route.ts` | 天气 API | — |
| `src/app/weather/page.tsx` | 天气页面（存活，依赖丢失 lib） | — |
| `src/lib/street-omen.ts` | 街坊征兆（`generateStreetOmen`） | — |
| `src/lib/fragment-synthesis.ts` | 碎片合成 | — |
| `src/lib/content-safety.ts` | 内容安全过滤 | AI 叙事合规 |
| `src/lib/stream-client.ts` | 流式叙事客户端 | 流式 AI 叙事（见 `docs/architecture/streaming-narrative-arch.md`） |
| `src/app/world/page.tsx` | 世界页面 | — |

### 3.7 核心循环（P0，游戏推进命脉）
| 文件 | 职责推断 | 设计意图 |
|---|---|---|
| `src/app/api/advance-quarter/route.ts` | **按季推进**核心循环（属性成长、事件触发、丹毒衰减钩子） | 季度推进是玩法主轴；丹毒季度衰减钩子（`84a515d`）在此 |
| `src/app/api/__tests__/advance-quarter.test.ts` | 单测 | P4 |
| `src/app/api/__tests__/advance-year.test.ts` | 单测（年推进，路由存活） | P4 |

### 3.8 页面与组件层（P1）
| 文件 | 说明 |
|---|---|
| `src/components/skills-panel.tsx` | 技能面板（接技能等级实时同步） |
| `src/components/status-bar.tsx` + `__tests__/status-bar.test.tsx` | 状态栏 |
| `src/components/dashboard-error-boundary.tsx` | dashboard 错误边界 |
| `src/components/__tests__/bottom-nav.test.tsx` / `dao-xiao-modal.test.tsx` | 组件单测 |
| `src/app/dashboard/hooks/use-actions.ts` | dashboard 行动 hook |
| `src/app/dashboard/hooks/use-cultivator.ts` | 修士数据 hook |
| `src/app/dashboard/hooks/use-data-sync.ts` + `__tests__/use-data-sync.test.ts` | 数据同步 hook（`attributeExp/subjectExp` 实时同步） |
| `src/hooks/use-dev-mode.ts` + `__tests__/use-dev-mode.test.ts` | 开发模式 hook |

### 3.9 叙事相关（P1）
| 文件 | 说明 | 设计意图 |
|---|---|---|
| `src/app/api/narrative/retry/route.ts` + `__tests__` | 叙事重试 API | AI 叙事失败策略（2026-07-24 拍板）：报错+重试按钮，叙事从事务解耦 |
| `src/lib/__tests__/narrative.test.ts` | 叙事单测 | P4 |

### 3.10 测试层（P4，不影响运行）
全部 `__tests__` 文件（见附录清单）：advance-quarter/advance-year/encounter/combat/cultivator/cultivator-use-item/narrative/narrative-retry/use-item（api）；bottom-nav/dao-xiao-modal/status-bar（components）；use-data-sync（hooks）；alchemy-data/arcade/auth-helpers/class-enroll/combat-engine/cultivation/cultivation-data/dream-events/encounter-data/enemy-data/family/gold/inventory-utils/json-helper/location-events/location-npcs/milestones/mortal-events/narrative/personality/pet/physique/secret-realm-data/shop/short-video/spirit-pet/spirit-stone/stream-client/technique-data-new/travel（lib）；game-store/game-store-stream（store）；use-dev-mode（hooks）。

### 3.11 文档 / 技能 / 脚本 / 配置（P5，不影响运行）
- **项目文档（62 个 .md）**：`项目文档/00-项目入口/`（AGENTS/HERMES/README）、`01-游戏设计GDD/gdd/`（combat-balance/health-system/life-dimension-scheme/M2-core-loop-fun/m4-p0-friends 及 systems/ 下 combat/economy-shop/gongfa/high-tier-sink/lifespan-reincarnation/mortal-life-phone/narrative-ai/npc-relationship/quarter-advance/xiulian）、`02-架构与决策/ADR/`（001/003/004）、`ARCHITECTURE.md`/`REVIEW.md`、`03-功能规划与交接/`、`04-功能实现记录/`（含多份"已完成"记录）、`05-设计急救清单.md`、`08-wild高境敌池扩充设计.md`。
- **`.hermes/skills/`**：systematic-debugging / test-driven-development / using-git-worktrees / using-superpowers / writing-plans / writing-skills（含 SKILL.md 与 references）。
- **`.workbuddy/memory/`**：2026-07-21.md / 2026-07-24.md / 2026-07-25.md（注意：本恢复文档为新建，勿覆盖）。
- **`docs/architecture/streaming-narrative-arch.md`**。
- **脚本/配置**：`scripts/_repro_personality.mjs`、`scripts/fix_kindergarten_test.py`、`scripts/t2-handfeel-sim.mjs`、`vitest.config.ts`。
- **迁移 SQL**：`prisma/migrations/20260715105030_add_mind_demon/migration.sql`、`prisma/migrations/20260717062125_add_alchemy_fields/migration.sql`（schema 已反推，迁移文件可后补）。

---

## 4. 分阶段重建路线（建议顺序）

> 原则：先让 `tsc`/`next build` 通过（P0 lib + store），再补页面/组件（P1），最后测试（P4）与文档（P5）。所有重建以 **dev.db 现有字段 + 本文档设计意图 + 存活代码的 import 接口** 为准。

- **Phase 0 — 环境固化**：保留已救回的 `schema.prisma`/`globals.css`/`node_modules`/`.env`；删除 `recovery_clone/`（或移出工作树，避免被 Next 误扫）。✔ 基本完成。
- **Phase 1 — P0 核心 lib（解除构建阻塞）**：按 §2 表格重建 `logger` → `inventory-utils` → `alchemy-data`/`exchange`/`spirit-pet`/`mortal-events`/`street-omen`/`location-events`/`property-data`/`dream-events` → `game-store.ts`。目标：`next build` 不再因"模块找不到"失败。
- **Phase 2 — P0 核心循环**：重建 `api/advance-quarter/route.ts`（季度推进 + 丹毒衰减钩子），这是玩法推进命脉。
- **Phase 3 — P1 模块 lib**：`reading`/`family`/`clique`/`weather`/`physique`/`savings`/`shop`/`secret-realm-data`/`spirit-pet`(若 Phase1 未含)/`arcade`/`short-video`/`fragment-synthesis`/`content-safety`/`stream-client` 等。
- **Phase 4 — P1 页面/组件/hooks**：13 个丢失页面、5 个丢失组件、3 个 dashboard hooks、use-dev-mode。
- **Phase 5 — P1 剩余 API 路由**：alchemy/formulas、class-enroll、family、location-npc、narrative/retry、reading、reincarnation、reincarnation-altar、secret-realm、short-video、weather、arcade。
- **Phase 6 — P4 测试**：按 §3.10 清单补齐 `__tests__`（建议边重建边写，避免回归）。
- **Phase 7 — P5 文档/技能/脚本**：从 GDD 记忆 + 克隆旧版恢复 `项目文档/`、`.hermes/skills/`、脚本与 `vitest.config.ts`；补两份迁移 SQL。

---

## 5. 附录：174 个丢失文件完整清单

### store（3）
```
src/store/game-store.ts
src/store/__tests__/game-store.test.ts
src/store/__tests__/game-store-stream.test.ts
```

### lib 实现（22）
```
src/lib/alchemy-data.ts
src/lib/arcade.ts
src/lib/class-enroll.ts
src/lib/clique.ts
src/lib/content-safety.ts
src/lib/dream-events.ts
src/lib/exchange.ts
src/lib/fragment-synthesis.ts
src/lib/inventory-utils.ts
src/lib/location-events.ts
src/lib/logger.ts
src/lib/mortal-events.ts
src/lib/physique.ts
src/lib/property-data.ts
src/lib/reading.ts
src/lib/savings.ts
src/lib/secret-realm-data.ts
src/lib/shop.ts
src/lib/spirit-pet.ts
src/lib/stream-client.ts
src/lib/street-omen.ts
src/lib/weather.ts
```

### lib 测试（31）
```
src/lib/__tests__/alchemy-data.test.ts
src/lib/__tests__/arcade.test.ts
src/lib/__tests__/auth-helpers.test.ts
src/lib/__tests__/class-enroll.test.ts
src/lib/__tests__/combat-engine.test.ts
src/lib/__tests__/cultivation.test.ts
src/lib/__tests__/cultivation-data.test.ts
src/lib/__tests__/dream-events.test.ts
src/lib/__tests__/encounter-data.test.ts
src/lib/__tests__/enemy-data.test.ts
src/lib/__tests__/family.test.ts
src/lib/__tests__/gold.test.ts
src/lib/__tests__/inventory-utils.test.ts
src/lib/__tests__/json-helper.test.ts
src/lib/__tests__/location-events.test.ts
src/lib/__tests__/location-npcs.test.ts
src/lib/__tests__/milestones.test.ts
src/lib/__tests__/mortal-events.test.ts
src/lib/__tests__/narrative.test.ts
src/lib/__tests__/personality.test.ts
src/lib/__tests__/pet.test.ts
src/lib/__tests__/physique.test.ts
src/lib/__tests__/secret-realm-data.test.ts
src/lib/__tests__/shop.test.ts
src/lib/__tests__/short-video.test.ts
src/lib/__tests__/spirit-pet.test.ts
src/lib/__tests__/spirit-stone.test.ts
src/lib/__tests__/stream-client.test.ts
src/lib/__tests__/technique-data-new.test.ts
src/lib/__tests__/travel.test.ts
```

### api 路由实现（13）
```
src/app/api/advance-quarter/route.ts
src/app/api/alchemy/formulas/route.ts
src/app/api/arcade/route.ts
src/app/api/class-enroll/route.ts
src/app/api/family/route.ts
src/app/api/location-npc/route.ts
src/app/api/narrative/retry/route.ts
src/app/api/reading/route.ts
src/app/api/reincarnation/route.ts
src/app/api/reincarnation-altar/route.ts
src/app/api/secret-realm/route.ts
src/app/api/short-video/route.ts
src/app/api/weather/route.ts
```

### api 路由测试（9）
```
src/app/api/__tests__/advance-quarter.test.ts
src/app/api/__tests__/advance-year.test.ts
src/app/api/__tests__/encounter.test.ts
src/app/api/__tests__/combat/route.test.ts
src/app/api/__tests__/cultivator/route.test.ts
src/app/api/__tests__/cultivator/use-item/route.test.ts
src/app/api/__tests__/narrative/route.test.ts
src/app/api/__tests__/narrative/retry/route.test.ts
src/app/api/__tests__/use-item/route.test.ts
```

### 页面（13）
```
src/app/arcade/page.tsx
src/app/class-enroll/page.tsx
src/app/dreams/page.tsx
src/app/exchange/page.tsx
src/app/neighbors/page.tsx
src/app/personality/page.tsx
src/app/reading/page.tsx
src/app/reincarnation/page.tsx
src/app/savings/page.tsx
src/app/secret-realm/page.tsx
src/app/short-video/page.tsx
src/app/spirit-pet/page.tsx
src/app/world/page.tsx
```

### 组件（5）
```
src/components/alchemy-panel.tsx
src/components/clique-panel.tsx
src/components/dashboard-error-boundary.tsx
src/components/skills-panel.tsx
src/components/status-bar.tsx
```

### 组件测试（3）
```
src/components/__tests__/bottom-nav.test.tsx
src/components/__tests__/dao-xiao-modal.test.tsx
src/components/__tests__/status-bar.test.tsx
```

### hooks（4）
```
src/app/dashboard/hooks/use-actions.ts
src/app/dashboard/hooks/use-cultivator.ts
src/app/dashboard/hooks/use-data-sync.ts
src/hooks/use-dev-mode.ts
```

### hooks 测试（2）
```
src/app/dashboard/hooks/__tests__/use-data-sync.test.ts
src/hooks/__tests__/use-dev-mode.test.ts
```

### 脚本 / 配置（4）
```
scripts/_repro_personality.mjs
scripts/fix_kindergarten_test.py
scripts/t2-handfeel-sim.mjs
vitest.config.ts
```

### 迁移 SQL（2）
```
prisma/migrations/20260715105030_add_mind_demon/migration.sql
prisma/migrations/20260717062125_add_alchemy_fields/migration.sql
```

### 文档 / 技能 / 记忆（62 .md + 1 .dot）
```
项目文档/00-项目入口/AGENTS.md
项目文档/00-项目入口/HERMES.md
项目文档/00-项目入口/README.md
项目文档/01-游戏设计GDD/gdd/combat-balance.md
项目文档/01-游戏设计GDD/gdd/CONSISTENCY.md
项目文档/01-游戏设计GDD/gdd/health-system.md
项目文档/01-游戏设计GDD/gdd/life-dimension-scheme.md
项目文档/01-游戏设计GDD/gdd/M2-core-loop-fun.md
项目文档/01-游戏设计GDD/gdd/m4-p0-friends.md
项目文档/01-游戏设计GDD/gdd/systems/combat.md
项目文档/01-游戏设计GDD/gdd/systems/economy-shop.md
项目文档/01-游戏设计GDD/gdd/systems/gongfa.md
项目文档/01-游戏设计GDD/gdd/systems/high-tier-sink.md
项目文档/01-游戏设计GDD/gdd/systems/lifespan-reincarnation.md
项目文档/01-游戏设计GDD/gdd/systems/mortal-life-phone.md
项目文档/01-游戏设计GDD/gdd/systems/narrative-ai.md
项目文档/01-游戏设计GDD/gdd/systems/npc-relationship.md
项目文档/01-游戏设计GDD/gdd/systems/quarter-advance.md
项目文档/01-游戏设计GDD/gdd/systems/xiulian.md
项目文档/02-架构与决策/ADR/ADR-001-app-router-rsc-client-boundary.md
项目文档/02-架构与决策/ADR/ADR-003-ai-narrative-centralized-prompts.md
项目文档/02-架构与决策/ADR/ADR-004-zustand-vs-db-sync.md
项目文档/02-架构与决策/ARCHITECTURE.md
项目文档/02-架构与决策/REVIEW.md
项目文档/03-功能规划与交接/DEVELOPMENT-HANDOFF.md
项目文档/03-功能规划与交接/M2-core-loop/CORE-LOOP-TRACE.md
项目文档/03-功能规划与交接/M2-core-loop/M2-SPRINT-PLAN.md
项目文档/04-功能实现记录/2026-07-21-凡人阶段随机事件与日常细节.md
项目文档/04-功能实现记录/已完成/2026-07-10-凡人生活与手机系统【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-10-全面改进设计【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-12-寿命系统与轮回转世【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-12-寿命系统与轮回转世实施计划【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-12-统一登录与设置弹窗【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-12-叙事Schema统一【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-12-叙事上下文记忆【已完成已升级】.md
项目文档/04-功能实现记录/已完成/2026-07-12-叙事上下文记忆实施计划【已完成已升级】.md
项目文档/04-功能实现记录/已完成/2026-07-17-炼丹系统与代码重构设计【已完成】.md
项目文档/04-功能实现记录/已完成/2026-07-17-炼丹系统与代码重构实施计划【已完成】.md
项目文档/04-功能实现记录/已完成/战斗系统设计【已完成】.md
项目文档/05-设计急救清单.md
项目文档/08-wild高境敌池扩充设计.md
docs/architecture/streaming-narrative-arch.md
.workbuddy/memory/2026-07-21.md
.workbuddy/memory/2026-07-24.md
.workbuddy/memory/2026-07-25.md
.hermes/skills/systematic-debugging/condition-based-waiting.md
.hermes/skills/systematic-debugging/condition-based-waiting-example.ts
.hermes/skills/systematic-debugging/root-cause-tracing.md
.hermes/skills/systematic-debugging/SKILL.md
.hermes/skills/systematic-debugging/test-academic.md
.hermes/skills/systematic-debugging/test-pressure-1.md
.hermes/skills/systematic-debugging/test-pressure-3.md
.hermes/skills/test-driven-development/SKILL.md
.hermes/skills/test-driven-development/testing-anti-patterns.md
.hermes/skills/using-git-worktrees/SKILL.md
.hermes/skills/using-superpowers/references/gemini-tools.md
.hermes/skills/using-superpowers/references/hermes-tools.md
.hermes/skills/using-superpowers/references/pi-tools.md
.hermes/skills/writing-plans/plan-document-reviewer-prompt.md
.hermes/skills/writing-skills/anthropic-best-practices.md
.hermes/skills/writing-skills/examples/CLAUDE_MD_TESTING.md
.hermes/skills/writing-skills/graphviz-conventions.dot
.hermes/skills/writing-skills/SKILL.md
.hermes/skills/writing-skills/testing-skills-with-subagents.md
```

---

## 6. 重建时的硬性约束（来自项目铁律，务必遵守）

1. **FW 禁碰区**（程基岩/engineering-lead 降级为设计评估，代码落地主理人直落）：`prisma/schema.prisma`、`src/lib/cultivation-data.ts`、`src/lib/index.ts`、`src/app/api/advance-quarter/route.ts`、`src/app/api/advance-year/route.ts`、`src/app/api/cultivator/route.ts`、`src/app/dashboard/page.tsx`、`src/app/dashboard/types.ts`、`src/store/game-store.ts`、`src/lib/auth-helpers.ts`、`src/components/location-panel.tsx`（桩 `teacher.ts`/`clique.ts` 禁碰）。**重建 `game-store.ts` 与 `advance-quarter/route.ts` 属 FW，需主理人直落或明确授权。**
2. **提交纪律**：静默提交用 `git commit --no-verify`（仅文档/零代码改动）；含代码须跑真钩子。绝不用 `git add -A`。11 个 FW 文件走 `git update-index --skip-worktree` 隐藏。
3. **终端纪律**：长命令后台跑；避免前台弹窗；删除大目录用 `mv` 改名规避 safe-delete 钩子（≥50 文件/轮会中止命令）；启动 server 时 `NODE_OPTIONS` 仅留 `--use-system-ca`。
4. **AI 叙事**：失败须"报错 + 重试按钮"，叙事从事务提交解耦（核心状态先提交，重试只重生成叙事）。
5. **道消**：双货币 100% 清零（gold + 三档灵石不继承），推翻旧"丢 80%"。

> 下一步：从 Phase 1（P0 lib + game-store）开始。若你希望我直接动手重建某一模块，指明模块即可；若要先恢复 GitHub 基础版跑起来，告诉我，我用 `master` 覆盖工作树并保留本恢复文档。
