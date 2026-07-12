# AI 叙事上下文记忆 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 叙事引擎增加剧情上下文记忆，让 AI 在生成新叙事时引用之前发生的事件，提升故事连续性。

**Architecture:** 在 Cultivator 模型新增 `storySummary` 字段存储滚动概要；每次叙事后用纯代码追加摘要行；概要超过 1000 字时触发 AI 压缩到 500 字以内；下次叙事时将概要注入 prompt。

**Tech Stack:** Next.js 16 App Router, Prisma 7/SQLite, TypeScript

**设计文档:** `docs/superpowers/specs/2026-07-12-narrative-context-memory-design.md`

## 全局约束

- 追加和阈值检查是纯代码，零 AI 开销
- AI 压缩失败不阻断游戏流程
- 新字段为 null，完全兼容已有 cultivator
- 不引入新的 npm 依赖
- 不改动现有函数签名以外的调用方

---

### 任务 1: Prisma 模型变更 — Cultivator 加 storySummary 字段

**文件:**
- 修改: `prisma/schema.prisma:22-43`

**接口:**
- 消费: 无
- 产生: `Cultivator.storySummary` (String?, nullable) + `Cultivator.storySummaryUpdatedAt` (DateTime?, nullable)

- [ ] **Step 1: 在 Cultivator 模型末尾添加两个字段**

在 `prisma/schema.prisma` 的 `Cultivator` 模型中，在 `events` 之前添加：

```prisma
model Cultivator {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  name              String
  spiritualRoot     String   @default("杂灵根")
  realm             String   @default("凡人")
  realmLevel        Int      @default(0)
  cultivationExp    Int      @default(0)
  totalExp          Int      @default(0)
  stamina           Int      @default(20)
  breakthroughCount Int      @default(0)
  title             String?
  worldId           String?
  age               Int      @default(1)
  location          String?
  npcRelations      String?
  inventory         String?
  gold              Int      @default(50)
  createdAt         DateTime @default(now())
  storySummary          String?   // 剧情概要，追加+压缩维护，null=未初始化
  storySummaryUpdatedAt DateTime? // 最后更新（追加或压缩）时间
  events            GameEvent[]
}
```

- [ ] **Step 2: 生成 Prisma 客户端**

```bash
npx prisma generate
```
Expected: Prisma 客户端重新生成，无错误

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: Cultivator 增加 storySummary + storySummaryUpdatedAt 字段"
```

---

### 任务 2: 在 `narrative.ts` 中新增工具函数

**文件:**
- 修改: `src/lib/narrative.ts`

**接口:**
- 消费: `callAI`（已有）
- 产生: `appendToSummary(event)`, `shouldCompress(summary)`, `compressStorySummary(summary, cultivatorName)`

- [ ] **Step 1: 添加 `appendToSummary`（纯代码）**

在 `callAI` 函数之后、`NarrativeResult` 接口之前添加：

```typescript
/**
 * 将一条事件追加到剧情概要中。
 * 追加格式：【标题】叙事前60字…
 * 纯字符串操作，无 AI 调用。
 */
function appendToSummary(currentSummary: string | null, event: { title: string; narrative: string }): string {
  const summaryLine = `【${event.title}】${event.narrative.slice(0, 60)}…`;
  if (!currentSummary) return summaryLine;
  return currentSummary + '\n' + summaryLine;
}

/**
 * 判断剧情概要是否超过压缩阈值（1000 中文字符）。
 * 纯字符串长度判断，无 AI 调用。
 */
function shouldCompress(summary: string): boolean {
  const text = summary.replace(/\n/g, '');
  return text.length > 1000;
}
```

- [ ] **Step 2: 添加 `compressStorySummary`（AI 压缩）**

在函数末尾（`generateBirthNarrative` 之后）添加：

```typescript
/**
 * 调用 AI 将剧情概要压缩到 500 字以内。
 * 压缩失败返回原概要，不阻断流程。
 */
export async function compressStorySummary(summary: string, cultivatorName: string): Promise<string> {
  const prompt = `你是一个修仙小说的编辑。将以下剧情概要压缩到500字以内，保留关键事件和因果关系，保持时间顺序。

【修炼者】${cultivatorName}

【当前概要】
${summary}

要求：压缩后不超过500字，保留核心故事情节。直接输出压缩后的文本，不要 JSON 格式，不要多余说明。`;

  try {
    const text = await callAI({
      systemPrompt: "你是一个熟练的文本编辑。",
      userPrompt: prompt,
      maxTokens: 1000,
      temperature: 0.3,
    });
    return text.slice(0, 500);
  } catch {
    return summary; // 压缩失败，保留原概要
  }
}
```

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add src/lib/narrative.ts
git commit -m "feat: 新增 appendToSummary / shouldCompress / compressStorySummary 函数"
```

---

### 任务 3: 为每个叙事生成函数添加 `storySummary` 参数

**文件:**
- 修改: `src/lib/narrative.ts`

**接口:**
- 消费: `appendToSummary`, `shouldCompress`, `compressStorySummary`（来自 Task 2）
- 产生: 每个函数可选接收 `storySummary?: string`，prompt 中注入

- [ ] **Step 1: 修改 `generateDailyCultivationNarrative`**

在参数中添加 `storySummary?: string`，在 `buildSystemPrompt()` 调用处改为传参：

```typescript
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number; taskType: string; taskDescription?: string; cultivationExp: number;
  storySummary?: string; // 新增
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = { STUDY: "悟道", EXERCISE: "锻体", SLEEP: "静修", MEDITATE: "打坐", CUSTOM: "历练" };
  let prompt = `生成一段修仙小说的日常修炼叙事。

【修炼者信息】道号：${params.cultivatorName}，灵根：${params.spiritualRoot}，境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}，修炼值：${params.cultivationExp}
【今日修炼】方式：${taskNames[params.taskType] || "修炼"}${params.taskDescription ? `，描述：${params.taskDescription}` : ""}

要求：150-250字，体现灵根和境界特点

返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示"}`;

  // 注入剧情概要作为上下文
  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: 500, temperature: 0.8 });
    return extractJson(text, { title: "日常修炼", narrative: `${params.cultivatorName}盘膝而坐，默默运转功法……`, mood: "静", hint: "持之以恒" });
  } catch { return { title: "日常修炼", narrative: `${params.cultivatorName}静心修炼，灵力又精纯了几分。`, mood: "静", hint: "持之以恒" }; }
}
```

> 变更要点：将 `prompt` 从 const 改为 let，在末尾条件注入概要。

- [ ] **Step 2: 修改 `generateBreakthroughNarrative`**

同样添加 `storySummary?: string` 参数，在 prompt 末尾注入：

```typescript
export async function generateBreakthroughNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; fromRealm: string; fromLevel: number; toRealm: string; toLevel: number; totalExp: number; breakthroughCount: number;
  storySummary?: string;
}): Promise<NarrativeResult> {
  const isNewRealm = params.fromRealm !== params.toRealm;
  const scene = isNewRealm ? `突破大境界：从 ${params.fromRealm} 到 ${params.toRealm}！` : `${params.fromRealm} ${formatRealmLevel(params.fromRealm, params.fromLevel)} → ${formatRealmLevel(params.fromRealm, params.toLevel)}`;
  let prompt = `生成一段修仙小说的境界突破叙事。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，第${params.breakthroughCount + 1}次突破，累计修炼${params.totalExp}
【突破】${scene}

要求：${isNewRealm ? "300-500字，天地异象" : "200-300字，灵力增长"}
返回JSON：{"title":"标题","narrative":"正文","mood":"燃","hint":"建议"}`;

  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }
  // ... 后续代码不变
}
```

- [ ] **Step 3: 修改 `generateEncounterNarrative`**

```typescript
export async function generateEncounterNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number;
  storySummary?: string;
}): Promise<{ title: string; narrative: string; choices: { text: string; risk: "low" | "medium" | "high"; hint: string }[]; mood: string }> {
  let prompt = `生成一段修仙世界的奇遇事件。

【修炼者】${params.cultivatorName}，灵根${params.spiritualRoot}，境界${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}

要求：200-300字，给出3个选项（低/中/高风险）
返回JSON：{"title":"标题","narrative":"场景","choices":[{"text":"选项","risk":"low/medium/high","hint":"提示"}],"mood":"奇/险"}`;

  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }
  // ... 后续代码不变
}
```

- [ ] **Step 4: 修改 `generateActionNarrative`**

```typescript
export async function generateActionNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  age: number; worldId?: string; actionName: string; actionDescription: string;
  freeInput?: string; expGained: number; isAwakened: boolean; awakenEvent: boolean;
  storySummary?: string;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  const ageContext = params.age <= 3 ? "幼儿" : params.age <= 6 ? "孩童" : params.age <= 12 ? "少年" : params.age <= 15 ? "即将成年的少年" : "修炼者";
  let prompt = `写一段修仙小说的行动叙事。

【角色】${params.cultivatorName}，${params.age}岁${ageContext}，灵根${params.spiritualRoot}，境界${realmStr}
${params.isAwakened ? "" : "- 尚未觉醒，仍为凡人"}
${params.awakenEvent ? "- 觉醒时刻！" : ""}
【行动】${params.actionName}：${params.actionDescription}
${params.freeInput ? `玩家描述：${params.freeInput}` : ""}
获得修炼值：${params.expGained}

要求：150-300字，符合年龄认知，未觉醒角色不能出现超凡元素
返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃/险/奇","hint":"修炼提示"}`;

  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }
  // ... 后续代码不变
}
```

- [ ] **Step 5: 修改 `generateYearAdvanceNarrative`**

```typescript
export async function generateYearAdvanceNarrative(params: {
  cultivatorName: string; spiritualRoot: string; realm: string; realmLevel: number;
  oldAge: number; newAge: number; totalExp: number; worldId?: string; extraContext?: string;
  storySummary?: string;
}): Promise<NarrativeResult> {
  const realmStr = params.realm === "凡人" ? "凡人" : `${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}`;
  let prompt = `写一段修仙小说的时间推进叙事。

【角色】${params.cultivatorName}，${params.oldAge}岁→${params.newAge}岁，灵根${params.spiritualRoot}，境界${realmStr}，累计修炼${params.totalExp}
${params.extraContext ? `\n【背景】${params.extraContext}` : ""}

要求：100-200字，总结一年成长，未觉醒角色不能出现超凡元素
返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃/奇","hint":"展望"}`;

  if (params.storySummary) {
    prompt += `\n\n【已发生的剧情】\n${params.storySummary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }
  // ... 后续代码不变
}
```

- [ ] **Step 6: 修改剩余函数（`generateFamilyDialogue`、`generateBirthNarrative`、`generateNPCDialogue`）**

这三个函数也用同样的方式增加 `storySummary?: string` 参数，在 prompt 末尾注入。

> **注意：** `generateBirthNarrative` 是角色出生时的叙事，此时 storySummary 通常为 null，加参数只是为了统一接口，不影响使用。

- [ ] **Step 7: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: 无类型错误

- [ ] **Step 8: 提交**

```bash
git add src/lib/narrative.ts
git commit -m "feat: 叙事生成函数支持 storySummary 上下文注入"
```

---

### 任务 4: 修改 API 路由 — 加载/存储 storySummary

**文件:**
- 修改: `src/app/api/narrative/route.ts`

**接口:**
- 消费: `appendToSummary`, `shouldCompress`, `compressStorySummary`（来自 Task 2）
- 消费: 每个叙事函数新增的 `storySummary` 参数（来自 Task 3）
- 产生: 每个叙事类型处理完毕后更新 cultivator 的 storySummary

- [ ] **Step 1: 在路由文件顶部增加 import**

```typescript
import { appendToSummary, shouldCompress, compressStorySummary } from "@/lib/narrative";
```

- [ ] **Step 2: 在每个叙事分支中，生成叙事后追加概要**

修改模式：在每个 `case` 分支中，在生成 narrative 之后、返回响应之前，追加概要并保存。

**DAILY_CULTIVATION 分支示例（其他分支同理）：**

```typescript
case "DAILY_CULTIVATION": {
  // 读取当前概要
  const currentSummary = cultivator.storySummary;

  // 传入概要作为上下文
  const narrative = await generateDailyCultivationNarrative({
    cultivatorName: cultivator.name,
    spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
    realm: cultivator.realm,
    realmLevel: cultivator.realmLevel,
    taskType: taskType || "CUSTOM",
    taskDescription,
    cultivationExp: cultivator.cultivationExp,
    storySummary: currentSummary || undefined,
  });

  // 保存事件（原有代码不变）
  const event = await prisma.gameEvent.create({
    data: {
      cultivatorId: cultivator.id,
      type: "DAILY_CULTIVATION",
      title: narrative.title,
      narrative: narrative.narrative,
      reward: JSON.stringify({ mood: narrative.mood, hint: narrative.hint }),
    },
  });

  // 追加到概要（纯代码）
  const newSummary = appendToSummary(currentSummary, { title: narrative.title, narrative: narrative.narrative });
  const now = new Date();

  // 判断是否超出阈值，超长则异步压缩
  let finalSummary = newSummary;
  if (shouldCompress(newSummary)) {
    finalSummary = await compressStorySummary(newSummary, cultivator.name);
  }

  // 保存概要到 DB
  await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: {
      storySummary: finalSummary,
      storySummaryUpdatedAt: now,
    },
  });

  // 检查是否可以突破（原有代码）
  const canBreak = canBreakthrough(
    cultivator.realm,
    cultivator.realmLevel,
    cultivator.cultivationExp,
    cultivator.spiritualRoot as import("@/lib").SpiritualRoot
  );

  return NextResponse.json({ event, narrative, canBreakthrough: canBreak });
}
```

> 关键点：`appendToSummary` 和 `shouldCompress` 是纯代码；`compressStorySummary` 仅在超长时触发。

- [ ] **Step 3: 修改所有其他 case 分支**

对以下分支重复 Step 2 的模式。每个分支的修改只有一处不同——调用的叙事函数不同：

| case 分支 | 叙事函数 | 追加 title/narrative |
|-----------|---------|-------------------|
| `BIRTH` | `generateBirthNarrative` | 是 |
| `ENCOUNTER` | `generateEncounterNarrative` | 是 |
| `BREAKTHROUGH` | `generateBreakthroughNarrative` | 是 |

**注意：** `ENCOUNTER` 分支有两条代码路径（有 choiceIndex 和没有），两条路径后面都要追加概要。

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```
Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/app/api/narrative/route.ts
git commit -m "feat: 叙事后追加剧情概要 + 超长自动压缩"
```

---

### 任务 5: 最终集成验证

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```
Expected: 无类型错误

- [ ] **Step 2: 确认文件变更清单**

```bash
git status
```
Expected 变更文件：
- 修改: `prisma/schema.prisma`
- 修改: `src/lib/narrative.ts`
- 修改: `src/app/api/narrative/route.ts`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: AI 叙事上下文记忆（完成）"
```
