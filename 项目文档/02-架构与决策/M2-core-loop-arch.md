# M2 核心循环架构笔记（cultivate → breakthrough → encounter → narrative）

> 配套 `ARCHITECTURE.md` 的专项补充，记录 M2 对核心循环链路的核查结论与待修项。
> 状态：诊断完成（M2-ENG-001）。未改架构铁律、未改 prompt 单一事实源文件。

---

## 1. 链路事实（已确认）

| 节点 | 服务端 | 前端入口 | 结论 |
|---|---|---|---|
| 修炼 cultivate | `POST /api/action` → `generateActionNarrative` (narrative.ts) → `$transaction` | `useActions.performAction`（流式客户端消费非流式 JSON） | 服务端通；**前端反馈假接通** |
| 突破 breakthrough | `POST /api/narrative` type=BREAKTHROUGH → `performBreakthrough` + `generateBreakthroughNarrative` | `handleBreakthrough`（普通 fetch+json） | **端到端接通** |
| 遭遇 encounter | `GET/POST /api/encounter`（结构化池）、`/api/narrative` type=ENCOUNTER（AI） | **无** | **完全断开（死路）** |
| 叙事 narrative | 全部经 `src/lib/narrative.ts` 单一事实源；AI 出口 `callAI`/`callAIStream` | — | **接通（铁律 C1/C2 守）** |

---

## 2. 两条并行的遭遇子系统（需决策去留）

- **结构化遭遇** `src/app/api/encounter/route.ts` + `src/lib/encounter-data.ts`（`ENCOUNTER_POOL` 4 条，含本次修好的 `treasure_hunt`）。含完整选项结算（战斗/物品/经验）。
- **AI 遭遇** `/api/narrative` type=ENCOUNTER（`generateEncounterNarrative` + `buildEncounterPrompt`，存 `RANDOM_ENCOUNTER`）。
- **当前均无前端入口**。建议垂直切片优先接 **AI 遭遇**（已就绪、工作量小）；结构化池作为"内容丰富"备选，需额外 UI 且要消费 `LOCATIONS.*.encounterPool`。

---

## 3. 已修复（M2-ENG-001 #7）

- `src/lib/encounter-data.ts`：`ENCOUNTER_POOL` 新增 `treasure_hunt`（古修士遗冢·寻宝）。
- `src/app/api/encounter/route.ts`：`ENCOUNTER_ITEM_MAP` 增加其 3 个特殊物品映射（→ `ancient_tome`/`spirit_sword`/`spirit_robe`）。
- 决策：补奇遇（enrich 池），使 `LOCATIONS.wild.encounterPool:["ancient_cave","treasure_hunt"]` 合法。

---

## 4. 待修项（交主理人裁决）

| 项 | 类型 | 建议 |
|---|---|---|
| `useActions.performAction` 用流式客户端消费非流式 `/api/action` | 假接通（阻断"修炼可见"） | 前端改普通 fetch+json（对齐 GO_HOME / store.performAction） |
| `/api/encounter` 与 `/api/narrative` ENCOUNTER 无前端入口 | 死路 | 垂直切片 VS-1.2 接通（优先 AI 遭遇） |
| `LOCATIONS.*.encounterPool` 字段休眠（无路由读取） | 数据/逻辑不一致 | 接通结构化遭遇时消费；或暂留作候选 |
| `vite@8.1.5` 与 `vitest@4.1.10` 不兼容 → 测试无法收集 | 环境/lockfile | 钉 vite 到 ^7 后再跑 `npm test` |

---

## 5. 控制要点（程序员可执行）

- 任何"修炼/行动"前端调用统一走**普通 JSON** 消费（不要对 `/api/action` 用 SSE 客户端）。
- 新增遭遇入口时，**优先复用** `/api/narrative` type=ENCOUNTER；若要接结构化池，必须消费 `encounterPool` 并经 `getEncounterById` 校验（避免再次出现悬空 ID）。
- 所有叙事 prompt 继续只在 `narrative.ts` / `narrative-prompts.ts` 维护（铁律 C1）；新增遭遇叙事走 `buildEncounterPrompt` / `generateEncounterNarrative`。
- 修改 `ENCOUNTER_POOL` 后，确保条目含 3 选项（low/medium/high）且 weight>0（既有 `encounter-data.test.ts` 不变量）。
