# 系统 GDD · 叙事 AI 引擎（Narrative AI System）

> 范围：AI 叙事生成、类型体系、多供应方架构、记忆系统、SSE 流式、效果契约
> 代码锚点：`src/lib/narrative.ts`（核心生成）+ `src/lib/narrative-types.ts`（类型系统）+ `src/lib/narrative-effects.ts`（效果契约）+ `src/app/api/narrative/route.ts`（路由）+ `src/lib/narrative-stream.ts`（SSE）

---

## ① 概述

叙事 AI 是「修仙模拟器」的**核心玩法引擎**——所有玩家交互的结果最终通过 AI 生成的文字叙事呈现。系统采用**多供应方自动降级架构**，支持 Anthropic/OpenAI/Ollama 三家供应方，以 JSON 格式输出结构化叙事，经类型校验、效果钳制、记忆累积后返回前端。

叙事不仅仅是"剧情包装"，而是核心循环的产出物：玩家选择行动 → AI 生成叙事 + 游戏效果 → 效果落库 → 记忆累积 → 影响后续叙事上下文。

### 架构总览

```
玩家操作 → API 路由
  │
  ├─ 认证（requireCultivator / x-user-id）
  ├─ 校验（年龄、体力、家庭成员等）
  ├─ 构建上下文（stateFromCultivator）
  │
  ├─ AI 叙事生成（callAI → extractJson）
  │   ├─ Anthropic（首选）
  │   ├─ OpenAI（备选）
  │   └─ Ollama（本地备选）
  │
  ├─ 效果提取（extractEffects → validateEffects → clampEffect）
  ├─ 记忆管理（createEntry → saveEntries → compressStorySummary）
  ├─ 持久化（prisma.$transaction）
  └─ 输出（SSE 流式 / JSON）
```

---

## ② 设计目标

1. **AI 叙事即玩法**：每一次选择都触发连贯、有记忆、风格统一的文字叙事，叙事不是包装而是核心循环。
2. **结构化输出**：AI 返回结构化 JSON（类型、标题、正文、心境、效果），非自由文本，确保前端可解析。
3. **供应方无关**：多供应方按优先级自动降级，不依赖单一 AI 供应商。
4. **类型化效果系统**：叙事效果（金币、亲密度、体力等）通过统一效果契约（`NarrativeEffect`）声明和落库，消除手工程序。
5. **记忆累积**：重要叙事条目自动保存为 `storyEntries`，超限时 AI 压缩摘要，保持上下文的连贯性。
6. **实时流式**：SSE 流式逐字推送叙事文本，降低首字等待延迟。

---

## ③ 核心机制

### 3.1 叙事类型体系（`NarrativeType`）

| 类型 | 标识 | AI 参数（maxTokens / temperature） | 特有字段 | 路由入口 |
|------|------|-------------------------------------|---------|---------|
| 日常修炼 | `DAILY_CULTIVATION` | 400 / 0.8 | 无 | `POST /api/narrative` |
| 突破渡劫 | `BREAKTHROUGH` | 600 / 0.9 | realm 变化 | `POST /api/narrative` |
| 奇遇探索 | `ENCOUNTER` | 500 / 0.9 | choices[3] | `POST /api/narrative` |
| NPC 对话 | `NPC_DIALOGUE` | 300 / 0.85 | npcMood, reward | `POST /api/narrative`（未接入路由） |
| 行动 | `ACTION` | 300/ 0.85 | 无 | （未接入路由） |
| 年志推进 | `YEAR_ADVANCE` | 400 / 0.8 | 无 | `POST /api/advance-year` |
| 季度推进 | `QUARTER_ADVANCE` | 300 / 0.8 | 无 | （未接入路由） |
| 家庭对话 | `FAMILY_DIALOGUE` | 200 / 0.85 | intimacyDelta, npcMood | `POST /api/family-dialogue` |
| 家人离世 | `FAMILY_DEATH` | 200 / 0.8 | 无 | （未接入路由） |
| 出生 | `BIRTH` | 500 / 0.85 | family[], suggestedName | `POST /api/narrative` |
| 战斗 | `COMBAT` | 400 / 0.9 | 纯文本 | `POST /api/combat` |

### 3.2 类型体系（`src/lib/narrative-types.ts`）

```typescript
// NarrativeBase — 所有叙事的共享基础字段
export interface NarrativeBase {
  type: NarrativeType;
  title: string;
  narrative: string;
  mood: MoodType;      // "燃" | "静" | "险" | "悟" | "奇"
  hint?: string;
  summary: string;
  effect?: NarrativeEffect;  // 统一效果契约（可选）
}

// 五种心境标签
export type MoodType = "燃" | "静" | "险" | "悟" | "奇";

// 联合类型
export type UnifiedNarrative =
  | RegularNarrative
  | EncounterNarrative
  | NPCDialogueNarrative
  | FamilyDialogueNarrative;
```

### 3.3 统一效果契约（`src/lib/narrative-effects.ts`，新增于 Phase 1）

所有叙事效果统一为 `NarrativeEffect` 联合体：

| 效果种类 | `kind` | 字段 | 说明 |
|---------|--------|------|------|
| 金币 | `gold` | `delta: number` | 正=增加，负=减少 |
| 体力 | `stamina` | `delta: number` | 变动量 |
| 亲密度 | `intimacy` | `targetRelation, delta` | 目标关系+变动量 |
| 气血 | `health` | `delta: number` | 健康变动 |
| 心魔 | `mindDemon` | `delta: number` | 心魔值变动 |
| 属性经验 | `attrExp` | `values: Record<string, number>` | 如 `{root: 15}` |
| 记忆条目 | `storyEntry` | `title, narrative, summary?, important?` | 新增记忆 |
| 家庭替换 | `familyReplace` | `members[]` | 出生/轮回替换 |
| 改名 | `rename` | `name: string` | 重新命名 |
| 心境 | `mood` | `mood: string` | 前端展示用 |
| NPC 相遇 | `npcMeet` | `npcId: string` | NPC 记录 |

**处理流水线**：`extractEffects(raw)` → `validateEffects(effects)` → `clampEffectsArray(effects, config)` → `applyEffects(effects, tx, ctx)`

### 3.4 AI 供应方架构（`callAI` 函数）

```
callAI(messages, params, retries = 0)
  │
  ├─ 1. 获取供应方配置（getRuntimeAIConfig → 数据库 appSetting）
  │     供应方 1: Anthropic (claude-sonnet-4-20250514)
  │     供应方 2: OpenAI    (gpt-4o)
  │     供应方 3: Ollama    (qwen2.5:7b) [本地回退]
  │
  ├─ 2. 发送请求（含超时 60s）
  │
  ├─ 3. 成功 → 返回文本
  │
  └─ 4. 失败 → 降级到下一供应方（retries > 0 时重试当前供应方）
```

- `MAX_RETRIES = 2`：最多重试 2 次
- 供应方切换通过 `switchProvider(error, currentProviderId, providers)` 实现
- 运行时可通过 `POST /api/admin/ai-config` 动态修改供应方配置
- 预热机制：`GET /api/warmup` 建立供应方连接缓存

### 3.5 提示词构建

每个叙事类型有独立的提示词 Prompt，构建于 `generate*` 函数内。提示词包含：

```
[角色设定] → [游戏状态上下文] → [叙事要求（字数/风格/格式）] → [JSON 格式模板]
```

- `stateFromCultivator(cultivator)`：从 Prisma 记录构建只读状态快照（年龄、金币、体力、境界、位置、灵根、属性、功法、背包等）
- `buildSummaryFromEntries(entries)`：从 storyEntries 构建简要记忆摘要
- 提示词要求 AI 返回 JSON 而非 Markdown，格式模板显式指定字段和示例
- **一致性校验**：`validateBirthConsistency` 校验出生叙事正文、建议姓名、家庭成员三方一致

### 3.6 JSON 提取（`extractJson<T>`）

三层智能解析策略：
1. 直接 `JSON.parse` 尝试
2. Markdown 代码块（\`\`\`json ... \`\`\`）提取
3. 括号计数法（`{ }` 平衡）暴力提取

`normalizeNarrativeKeys` 兼容多种 AI 输出变体（`narrative`/`narr`/`content`/`text` → 统一为 `narrative`）。

### 3.7 记忆系统

- `StoryEntry` 结构：`{ id, title, summary, timestamp, important? }`
- `createEntry(title, summary, truncate, aiSummary)`：创建记忆条目，`truncate` 自动截断超长文本
- `saveEntries(cultivatorId, entries, tx)`：持久化到 `cultivator.storyEntries`（JSON 字段）
- `compressStorySummary(existing, newEntry)`：超过 50 条或 1000 字时调用 AI 压缩——保留 ⭐ 重要事件，合并普通事件为段述
- ⭐ 标记条件：`important: true` 或标题包含特定关键词
- `buildSummaryFromEntries(entries)`：为 AI Prompt 构建简洁的记忆上下文

### 3.8 SSE 流式架构

| 组件 | 路径 | 职责 |
|------|------|------|
| `streamNarrativeResult` | `src/lib/narrative-stream.ts` | 服务端流式叙事输出 |
| `createSSEResponse` | `src/lib/stream-helper.ts` | AsyncGenerator → SSE Response |
| `consumeNarrativeStream` | `src/lib/sse-client.ts` | 前端消费 SSE 流 |

**事件流**：
```
committed → { gameEventId, cultivator }   // 事件已落库
chunk    → { text: "..." }                 // 逐字/逐句文本（18ms 间隔）
done     → { done: true, result }          // 完整结果
error    → { gameEventId, message }        // 异常（支持重试）
```

### 3.9 效果钳制（安全层）

所有 AI 返回的效果在落库前经过 `clampEffect` 钳制：

| 效果 | 钳制规则 | 防御目标 |
|------|---------|---------|
| 金币 | `clampGoldDelta(delta, currentGold, maxGain)` | AI 输出异常大额金币 |
| 亲密度 | `max(-cap, min(cap, delta))`, cap=8 | AI 输出突变数值 |
| 体力 | `max(-cap, min(cap, delta))` + [0, maxStamina] | 体力越界 |
| 气血/心魔 | `max(-100, min(100, delta))` | 极端值防范 |

---

## ④ 数值/平衡

| 供应方 | 模型 | 优先级 | 角色 | 适用场景 |
|--------|------|-------|------|---------|
| Anthropic | claude-sonnet-4-20250514 | 1 | 首选，高质量修仙叙事 | 所有叙事 |
| OpenAI | gpt-4o | 2 | 备选，Anthropic 不可用时 | 所有叙事 |
| Ollama | qwen2.5:7b | 3 | 本地回退 | 离线/开发环境 |

**各叙事类型 AI 调用参数**：

| 叙事类型 | maxTokens | temperature | 期望产出字数 | 特有参数 |
|---------|-----------|-------------|------------|---------|
| 出生 | 600 | 0.85 | 200–350 | NARRATIVE_PARAMS.BIRTH |
| 日常修炼 | 400 | 0.8 | 150–250 | NARRATIVE_PARAMS.DAILY |
| 突破 | 600 | 0.9 | 200–500 | NARRATIVE_PARAMS.BREAKTHROUGH |
| 奇遇 | 500 | 0.9 | 200–300 | NARRATIVE_PARAMS.ENCOUNTER |
| 家庭对话 | 250 | 0.85 | 50–120 | NARRATIVE_PARAMS.FAMILY |
| 战斗 | 500 | 0.9 | 150–300 | combat-narrative |

**记忆系统阈值**：

| 参数 | 值 | 说明 |
|------|-----|------|
| storyEntries 上限 | 50 条 | 超过触发压缩 |
| 压缩字数阈值 | 1000 字 | +新条目总字超过即压缩 |
| ⭐ 标记衰减 | 压缩时仅保留重要事件 | 普通条目合并为段述 |

---

## ⑤ 玩家流程

```
1. 玩家点击"修炼" / "探索" / "家庭对话" 等
2. 前端 POST → API 路由
3. 路由校验（体力/年龄/冷却等）
4. AI 生成叙事（含效果声明）
5. extractJson + validateEffects + clampEffect
6. 创建 GameEvent 记录
7. saveEntries 更新记忆
8. 效果落库（applyEffects）
9. SSE 流式返回或 JSON 响应
10. 前端显示叙事 + 效果反馈
```

---

## ⑥ 界面与反馈

### 前端叙事状态（`game-store.ts`）

| 状态 | 类型 | 说明 |
|------|------|------|
| `narrative` | `NarrativeDisplay \| null` | 当前展示的叙事 |
| `streamingText` | `string \| null` | SSE 流式累积文本 |
| `narrativeError` | `NarrativeErrorPayload \| null` | 错误信息 |
| `narrativeRetrying` | `boolean` | 是否正在重试 |

### NarrativeDisplay 结构（`dashboard/types.ts`）

```typescript
export interface NarrativeDisplay {
  id?: string;
  type?: string;
  title?: string;
  narrative?: string;
  mood?: string;
  hint?: string;
  summary?: string;
  choices?: { text: string; hint?: string }[];
  chosenOption?: number;
  reward?: string | null;
  gameEventId?: string;
  characterName?: string;
  suggestedName?: string;
  // family-dialogue 特定
  intimacyDelta?: number;
  npcMood?: string;
  actionHint?: string;
}
```

### 效果可视化

效果（金币变动、亲密度变化、体力消耗等）通过 `narrative.effect` 传播到前端。建议前端效果展示方式：
- 💰 +50 金币（绿色浮动文字）
- ❤️ 母亲亲密度 +3
- ⚡ 体力 -10

---

## ⑦ 依赖关系

| 依赖 | 方向 | 说明 |
|------|------|------|
| `src/lib/auth-helpers.ts` | ← 认证 | `requireCultivator` 鉴权 |
| `src/lib/prisma.ts` | ← 数据库 | Prisma ORM 持久化 |
| `src/lib/gold.ts` | ← 金币钳制 | `clampGoldDelta` 防御 |
| `src/lib/stream-helper.ts` | ← SSE 流式 | `createSSEResponse` 包装 |
| `src/store/game-store.ts` | → 前端状态 | Zustand 消费叙事结果 |
| `src/app/dashboard/types.ts` | → 前端类型 | `NarrativeDisplay` 接口 |
| AI 供应方 SDK | ← 外部 | Anthropic/OpenAI/Ollama |

---

## ⑧ 风险与开放问题

### 已知风险

1. **🟡 Prompt Injection**：用户输入（`playerMessage`, `taskDescription`）直接拼入 AI 提示词，可能被用于操纵 AI 输出。缓解：输出层 `extractJson` + `clampEffect` 双层校验，但输入层无净化。
2. **🟡 AI 输出不稳定**：不同供应方/模型的 JSON 格式输出存在偏差，`extractJson` 的三层解析不能覆盖所有边缘情况。缓解：已实现 `normalizeNarrativeKeys` + fallback 机制。
3. **🟢 费用不可控**：每次叙事调用 AI API，高频操作可能导致费用激增。缓解：本地 Ollama 作为回退，未实现用量配额。
4. **🔴 类型重复**：`narrative-types.ts` 和 `narrative.ts` 中各自定义了相同的类型体系，存在不同步风险（已知：`goldChange` 字段在 `narrative.ts` 的 `NarrativeBase` 中缺失）。**当前优先级 P0**，需通过 Phase 2 迁移统一。
5. **🟡 体力预扣无回滚**：`family-dialogue/route.ts` 在 AI 调用前扣除体力，AI 失败后体力无法恢复。缓解：需改为 AI 成功后再扣体力。

### 开放问题

1. **效果展示一致性**：前端应如何统一展示 `NarrativeEffect` 中的各效果种类？需要设计效果动画/提示组件。
2. **供应方量化切换**：目前按固定优先级切换，未来是否应改为按成功率/延迟动态切换？
3. **叙事长度自适应**：当前各类型 maxTokens 固定，是否应根据玩家当前上下文长度动态调整？
4. **记忆回顾功能**：玩家能否主动查看/回顾历史叙事记录？目前仅支持 `storyEntries` 压缩管理。
5. **多语言支持**：中文提示词和中文正则校验（如姓名）限制了国际化扩展。
