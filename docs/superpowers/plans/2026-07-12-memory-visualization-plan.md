# AI 叙事记忆可视化与编辑 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将剧情概要从纯后端文本升级为结构化的条目数组，新增「道心明镜」UI 面板，让玩家查看、标记、编辑、删除 AI 记忆条目。

**Architecture:** Cultivator 模型新增 `storyEntries` JSON 字段存储逐条记忆；`storySummary` 由 `buildSummaryFromEntries()` 实时生成；`POST /api/cultivator` 新增 `updateMemory` 和 `compressMemory` 两个 action 分支；dashboard 新增 `memory-panel` 组件。

**Tech Stack:** Next.js 16 App Router, Prisma 7/SQLite, shadcn/ui Dialog + Button + Input, Lucide icons

**设计文档:** `docs/superpowers/specs/2026-07-12-memory-visualization-design.md`

## 全局约束

- `storySummary` 字段不存在于当前 schema，只新增 `storyEntries` + `storyEntriesUpdatedAt`
- 已有 cultivator 的 `storyEntries` 为 null，前端显示「尚无记忆」
- 所有编辑操作不依赖 AI，纯前端 + 后端 DB 更新
- 不改动现有游戏核心逻辑（境界、突破、奇遇等）
- 不引入新的 npm 依赖

---

### 任务 1: Prisma 模型变更

**文件:**
- 修改: `prisma/schema.prisma`

**接口:**
- 产生: `Cultivator.storyEntries` (String?) + `Cultivator.storyEntriesUpdatedAt` (DateTime?)

- [ ] **Step 1: 在 Cultivator 模型添加两个字段**

在 `events` 之前添加：

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
  storyEntries          String?   // JSON 数组，逐条记忆
  storyEntriesUpdatedAt DateTime? // 最后修改时间
  events            GameEvent[]
}
```

- [ ] **Step 2: 生成 Prisma 客户端**

```bash
npx prisma generate
```

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: Cultivator 新增 storyEntries + storyEntriesUpdatedAt"
```

---

### 任务 2: `narrative.ts` 新增核心类型和工具函数

**文件:**
- 修改: `src/lib/narrative.ts`

**接口:**
- 产生: `StoryEntry` 接口、`buildSummaryFromEntries()`、`createEntry()`
- 消费: 已有 `callAI()`

- [ ] **Step 1: 添加 `StoryEntry` 接口和 `buildSummaryFromEntries`**

在 `NarrativeResult` 接口之前添加：

```typescript
export interface StoryEntry {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

/**
 * 从条目数组生成组合文本，用于注入 AI prompt。
 * 纯字符串操作，无 AI 调用。
 */
export function buildSummaryFromEntries(entries: StoryEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map(e =>
    `${e.important ? '⭐ ' : ''}【${e.title}】${e.summary}`
  ).join('\n');
}

/**
 * 创建一条新的记忆条目。
 * @param truncate - 默认 true，截断 summary 到 60 字；压缩条目传 false
 */
export function createEntry(title: string, summary: string, truncate = true): StoryEntry {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title,
    summary: truncate ? summary.slice(0, 60) + (summary.length > 60 ? '…' : '') : summary,
    important: false,
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: 修改 `compressStorySummary`**

替换原有实现，接收 `StoryEntry[]` 并区分重要/普通条目：

```typescript
export async function compressStorySummary(
  entries: StoryEntry[],
  cultivatorName: string
): Promise<string> {
  const importantEntries = entries.filter(e => e.important);
  const normalEntries = entries.filter(e => !e.important);

  let prompt = `你是一个修仙小说的编辑。将以下剧情概要压缩到500字以内。\n\n【修炼者】${cultivatorName}\n\n`;

  if (importantEntries.length > 0) {
    prompt += `重要事件（必须保留）：\n${importantEntries.map(e => `⭐ 【${e.title}】${e.summary}`).join('\n')}\n\n`;
  }
  if (normalEntries.length > 0) {
    prompt += `其他事件（可精简合并）：\n${normalEntries.map(e => `【${e.title}】${e.summary}`).join('\n')}\n\n`;
  }

  prompt += `要求：重要事件必须完整保留，其他事件可合并或精简。直接输出压缩后的纯文本，不要 JSON 格式。`;

  try {
    const text = await callAI({
      systemPrompt: "你是一个熟练的文本编辑。",
      userPrompt: prompt,
      maxTokens: [redacted],
      temperature: 0.3,
    });
    return text.slice(0, 500);
  } catch {
    return normalEntries.map(e => `【${e.title}】${e.summary}`).join('\n');
  }
}
```

- [ ] **Step 3: 修改每个叙事生成函数 — 接收 storyEntries 并注入 prompt**

在每个叙事函数的参数中添加 `storyEntries?: StoryEntry[]`（与之前的 `storySummary?: string` 参数共存或者替换）。

以 `generateDailyCultivationNarrative` 为例（其他 7 个函数同理）：

```typescript
export async function generateDailyCultivationNarrative(params: {
  cultivatorName: string; spiritualRoot: SpiritualRoot; realm: string; realmLevel: number; taskType: string; taskDescription?: string; cultivationExp: number;
  storyEntries?: StoryEntry[];
}): Promise<NarrativeResult> {
  const taskNames: Record<string, string> = { STUDY: "悟道", EXERCISE: "锻体", SLEEP: "静修", MEDITATE: "打坐", CUSTOM: "历练" };
  let prompt = `生成一段修仙小说的日常修炼叙事。\n\n【修炼者信息】道号：${params.cultivatorName}，灵根：${params.spiritualRoot}，境界：${params.realm} ${formatRealmLevel(params.realm, params.realmLevel)}，修炼值：${params.cultivationExp}\n【今日修炼】方式：${taskNames[params.taskType] || "修炼"}${params.taskDescription ? `，描述：${params.taskDescription}` : ""}\n\n要求：150-250字，体现灵根和境界特点\n\n返回JSON：{"title":"标题","narrative":"正文","mood":"静/悟/燃","hint":"提示"}`;

  // 注入剧情概要作为上下文
  if (params.storyEntries && params.storyEntries.length > 0) {
    const summary = buildSummaryFromEntries(params.storyEntries);
    prompt += `\n\n【已发生的剧情】\n${summary}\n\n请基于以上已发生的剧情，继续写接下来的故事。`;
  }

  try {
    const text = await callAI({ systemPrompt: buildSystemPrompt(), userPrompt: prompt, maxTokens: [redacted], temperature: 0.8 });
    return extractJson(text, { title: "日常修炼", narrative: `${params.cultivatorName}盘膝而坐，默默运转功法……`, mood: "静", hint: "持之以恒" });
  } catch { return { title: "日常修炼", narrative: `${params.cultivatorName}静心修炼，灵力又精纯了几分。`, mood: "静", hint: "持之以恒" }; }
}
```

> 对 `generateBreakthroughNarrative`、`generateEncounterNarrative`、`generateActionNarrative`、`generateYearAdvanceNarrative`、`generateFamilyDialogue`、`generateBirthNarrative`、`generateNPCDialogue` 做同样的修改：加 `storyEntries?` 参数，prompt 末尾注入。

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 5: 提交**

```bash
git add src/lib/narrative.ts
git commit -m "feat: 新增 StoryEntry 类型、buildSummaryFromEntries、createEntry，修改 compressStorySummary"
```

---

### 任务 3: 修改叙事 API 路由

**文件:**
- 修改: `src/app/api/narrative/route.ts`

- [ ] **Step 1: 修改 import**

添加：
```typescript
import { StoryEntry, createEntry, buildSummaryFromEntries, compressStorySummary } from "@/lib/narrative";
```

- [ ] **Step 2: 在每个叙事 case 分支中，改用 entries 操作**

以 `DAILY_CULTIVATION` 分支为例。在每个 `case` 分支中：

```typescript
case "DAILY_CULTIVATION": {
  // 读取当前 entries（新增）
  const currentEntries: StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');

  // 传入 entries 作为上下文（替换原有 storySummary 传参）
  const narrative = await generateDailyCultivationNarrative({
    cultivatorName: cultivator.name,
    spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
    realm: cultivator.realm,
    realmLevel: cultivator.realmLevel,
    taskType: taskType || "CUSTOM",
    taskDescription,
    cultivationExp: cultivator.cultivationExp,
    storyEntries: currentEntries, // 新增
  });

  // 保存事件（不变）
  const event = await prisma.gameEvent.create({
    data: {
      cultivatorId: cultivator.id,
      type: "DAILY_CULTIVATION",
      title: narrative.title,
      narrative: narrative.narrative,
      reward: JSON.stringify({ mood: narrative.mood, hint: narrative.hint }),
    },
  });

  // 创建新条目 + 追加
  const newEntry = createEntry(narrative.title, narrative.narrative);
  const updatedEntries = [...currentEntries, newEntry];

  // 检查压缩阈值
  const summaryText = buildSummaryFromEntries(updatedEntries);
  let finalEntries = updatedEntries;

  if (updatedEntries.length > 50 || summaryText.length > 1000) {
    const compressedText = await compressStorySummary(updatedEntries, cultivator.name);
    const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);
    const importantEntries = updatedEntries.filter(e => e.important);
    finalEntries = [...importantEntries, compressedEntry];
  }

  // 保存 cultivator
  await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: {
      storyEntries: JSON.stringify(finalEntries),
      storyEntriesUpdatedAt: new Date(),
    },
  });

  // 检查突破（不变）
  const canBreak = canBreakthrough(
    cultivator.realm, cultivator.realmLevel,
    cultivator.cultivationExp,
    cultivator.spiritualRoot as import("@/lib").SpiritualRoot
  );

  return NextResponse.json({ event, narrative, canBreakthrough: canBreak });
}
```

> 对 `BIRTH`、`ENCOUNTER`（两条路径都要加）、`BREAKTHROUGH` 分支做同样的 entries 操作。

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/narrative/route.ts
git commit -m "feat: 叙事后操作 storyEntries 数组，支持自动压缩"
```

---

### 任务 4: 修改 Cultivator API 路由

**文件:**
- 修改: `src/app/api/cultivator/route.ts`

**接口:**
- 新增: `POST` 的 `action: "updateMemory"` 和 `action: "compressMemory"` 分支
- 修改: `GET` 返回时自动解析 `storyEntries` JSON

- [ ] **Step 1: 在 POST handler 中新增 updateMemory 分支**

在 `POST` 函数的 `try` 块开头，在现有逻辑之前：

```typescript
const { action, ...rest } = body;

// 更新记忆条目
if (action === "updateMemory") {
  if (!rest.userId || !rest.storyEntries) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }
  const cultivator = await prisma.cultivator.update({
    where: { userId: rest.userId },
    data: {
      storyEntries: JSON.stringify(rest.storyEntries),
      storyEntriesUpdatedAt: new Date(),
    },
  });
  return NextResponse.json({
    success: true,
    entries: JSON.parse(cultivator.storyEntries || '[]'),
  });
}

// 手动压缩记忆
if (action === "compressMemory") {
  const cultivator = await prisma.cultivator.findUnique({
    where: { userId: rest.userId },
  });
  if (!cultivator) {
    return NextResponse.json({ error: "不存在" }, { status: 404 });
  }

  const { compressStorySummary, createEntry } = await import("@/lib/narrative");
  const entries: import("@/lib/narrative").StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
  const importantEntries = entries.filter(e => e.important);
  const normalEntries = entries.filter(e => !e.important);

  if (normalEntries.length === 0) {
    return NextResponse.json({ entries, message: "无非重要条目需要压缩" });
  }

  const compressedText = await compressStorySummary(entries, cultivator.name);
  const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);

  const newEntries = [...importantEntries, compressedEntry];

  await prisma.cultivator.update({
    where: { userId: rest.userId },
    data: {
      storyEntries: JSON.stringify(newEntries),
      storyEntriesUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, entries: newEntries });
}
```

- [ ] **Step 2: 修改 GET handler — 自动解析 storyEntries**

在 GET 的 return 之前添加：

```typescript
// 自动解析 storyEntries JSON
if (user.cultivator?.storyEntries) {
  (user.cultivator as any).storyEntries = JSON.parse(user.cultivator.storyEntries);
}
```

- [ ] **Step 3: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/cultivator/route.ts
git commit -m "feat: POST 新增 updateMemory + compressMemory；GET 自动解析 storyEntries"
```

---

### 任务 5: 新建 `memory-panel.tsx` 组件

**文件:**
- 创建: `src/components/memory-panel.tsx`

- [ ] **Step 1: 创建组件**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface StoryEntry {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

interface MemoryPanelProps {
  cultivatorId: string;
  entries: StoryEntry[];
  onEntriesChange: (entries: StoryEntry[]) => void;
}

export default function MemoryPanel({ cultivatorId, entries, onEntriesChange }: MemoryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [fullEdit, setFullEdit] = useState("");
  const [showFullEdit, setShowFullEdit] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const summaryText = entries.map(e =>
    `${e.important ? "⭐ " : ""}【${e.title}】${e.summary}`
  ).join("\n");

  const saveEntries = async (newEntries: StoryEntry[]) => {
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateMemory", userId: cultivatorId, storyEntries: newEntries }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onEntriesChange(data.entries);
      toast.success("记忆已更新");
    } catch {
      toast.error("保存失败");
    }
  };

  const toggleImportant = (id: string) => {
    const next = entries.map(e =>
      e.id === id ? { ...e, important: !e.important } : e
    );
    saveEntries(next);
  };

  const startEdit = (entry: StoryEntry) => {
    setEditingId(entry.id);
    setEditText(entry.summary);
  };

  const saveEdit = (id: string) => {
    const next = entries.map(e =>
      e.id === id ? { ...e, summary: editText.slice(0, 60) + (editText.length > 60 ? "…" : "") } : e
    );
    saveEntries(next);
    setEditingId(null);
  };

  const deleteEntry = (id: string) => {
    if (!window.confirm("确定删除这条记忆吗？")) return;
    const next = entries.filter(e => e.id !== id);
    saveEntries(next);
  };

  const saveFullEdit = () => {
    // 创建「📝 玩家记述」条目，保留重要条目
    const importantEntries = entries.filter(e => e.important);
    const newEntry: StoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: "📝 玩家记述",
      summary: fullEdit.slice(0, 500),
      important: false,
      createdAt: new Date().toISOString(),
    };
    saveEntries([...importantEntries, newEntry]);
    setShowFullEdit(false);
  };

  const handleCompress = async () => {
    setCompressing(true);
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compressMemory", userId: cultivatorId }),
      });
      const data = await res.json();
      if (data.entries) {
        onEntriesChange(data.entries);
        toast.success(data.message || "记忆已压缩");
      }
    } catch {
      toast.error("压缩失败");
    } finally {
      setCompressing(false);
    }
  };

  if (!entries || entries.length === 0) return null;

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        <span>📖 道心明镜 · AI 记住了这些事</span>
        <span>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-sm py-1 border-b border-muted last:border-0">
              <button
                onClick={() => toggleImportant(entry.id)}
                className="text-base shrink-0"
                title={entry.important ? "取消重要标记" : "标记为重要"}
              >
                {entry.important ? "⭐" : "☆"}
              </button>

              <span className="text-foreground font-medium shrink-0">{entry.title}</span>

              {editingId === entry.id ? (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(entry.id)}
                  className="flex-1 h-7 text-xs"
                  autoFocus
                />
              ) : (
                <span className="text-muted-foreground flex-1 truncate text-xs">{entry.summary}</span>
              )}

              <div className="flex gap-1 shrink-0">
                {editingId === entry.id ? (
                  <button onClick={() => saveEdit(entry.id)} className="text-xs text-primary hover:underline">保存</button>
                ) : (
                  <button onClick={() => startEdit(entry)} className="text-xs text-muted-foreground hover:text-foreground" title="编辑">✏️</button>
                )}
                <button onClick={() => deleteEntry(entry.id)} className="text-xs text-muted-foreground hover:text-red-500" title="删除">🗑️</button>
              </div>
            </div>
          ))}

          {/* 编辑全文概要 */}
          {showFullEdit ? (
            <div className="space-y-1 pt-2">
              <textarea
                value={fullEdit}
                onChange={(e) => setFullEdit(e.target.value)}
                className="w-full h-24 text-xs p-2 border border-border rounded bg-white text-foreground resize-none"
                placeholder="编辑完整的记忆文本…"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveFullEdit}>保存</Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setShowFullEdit(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setFullEdit(summaryText); setShowFullEdit(true); }}
              className="text-xs text-muted-foreground hover:text-primary pt-1"
            >
              📝 编辑全文概要
            </button>
          )}

          {/* 统计 + 压缩按钮 */}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>共 {entries.length} 条 · {summaryText.length} 字</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleCompress}
              disabled={compressing}
            >
              {compressing ? "压缩中..." : "🔄 压缩记忆"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: 提交**

```bash
git add src/components/memory-panel.tsx
git commit -m "feat: 新建设置弹窗组件（AI供应方配置 + 开发者模式）"
```

---

### 任务 6: 修改 Dashboard 集成记忆面板

**文件:**
- 修改: `src/app/dashboard/page.tsx`

- [ ] **Step 1: 添加 import 和 state**

在文件顶部添加：
```tsx
import MemoryPanel from "@/components/memory-panel";
```

在 `Home` 函数中添加 state：
```tsx
const [memoryEntries, setMemoryEntries] = useState<import("@/lib/narrative").StoryEntry[]>([]);
```

- [ ] **Step 2: 在获取 cultivator 信息时读取 storyEntries**

在现有的 `fetchCultivator` 或 `useEffect` 中，添加：
```tsx
if (data.user.cultivator?.storyEntries) {
  setMemoryEntries(data.user.cultivator.storyEntries);
}
```

> 注意：由于 GET API 已自动解析 JSON，`data.user.cultivator.storyEntries` 已经是数组。

- [ ] **Step 3: 在叙事卡片下方添加 MemoryPanel**

在叙事卡片（`{narrative && (...)}`）之后、行动面板之前插入：
```tsx
<MemoryPanel
  cultivatorId={userId}
  entries={memoryEntries}
  onEntriesChange={setMemoryEntries}
/>
```

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 5: 提交**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: dashboard 集成道心明镜记忆面板"
```

---

### 任务 7: 最终集成验证

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```

- [ ] **Step 2: 确认文件变更清单**

```bash
git status
```
Expected：
- 修改: `prisma/schema.prisma`
- 修改: `src/lib/narrative.ts`
- 修改: `src/app/api/narrative/route.ts`
- 修改: `src/app/api/cultivator/route.ts`
- 新建: `src/components/memory-panel.tsx`
- 修改: `src/app/dashboard/page.tsx`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: AI 叙事记忆可视化与编辑（完成）"
```