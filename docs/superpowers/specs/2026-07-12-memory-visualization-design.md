# AI 叙事记忆可视化与编辑 — 设计规范

## 概述

在原有 AI 叙事上下文记忆的基础上，增加玩家可见、可编辑的记忆系统：将剧情概要从纯后端文本升级为结构化的条目数组，在 dashboard 叙事卡片下方展示「道心明镜」面板，玩家可以查看 AI 记住了哪些内容、标记重要事件、编辑或删除记忆条目。

---

## 1. 数据模型

### 1.1 原有模型调整

**Cultivator 模型变更：**

| 字段 | 类型 | 说明 |
|------|------|------|
| ~~`storySummary`~~ | ~~`String?`~~ | **移除**，不再单独存储 |
| `storyEntriesUpdatedAt` | `DateTime?` | 新增（原名 storySummaryUpdatedAt），记录 entries 最后修改时间 |
| `storyEntries` | `String?` | **新增**，JSON 数组存储逐条记忆 |

`storySummary` 由 `storyEntries` 实时生成，不再持久化存储，消除数据同步问题。

### 1.2 storyEntries JSON 结构

```typescript
interface StoryEntry {
  id: string;            // 唯一标识，Date.now().toString(36)
  title: string;         // 事件标题（如「日常修炼」「突破筑基」）
  summary: string;       // 简短摘要（叙事前 60 字 + …）
  important: boolean;    // 玩家标记为重要？
  createdAt: string;     // ISO 时间戳
}
```

存储示例：
```json
[
  {"id":"m1x2", "title":"李明出世", "summary":"在青云山脚下的李家庄，一个男婴呱呱坠地…", "important":true, "createdAt":"2026-01-01T00:00:00Z"},
  {"id":"m3y4", "title":"日常修炼", "summary":"李明盘膝而坐，感受天地灵气缓缓流入体内…", "important":false, "createdAt":"2026-01-02T00:00:00Z"},
  {"id":"m5z6", "title":"突破炼气一层", "summary":"体内灵气瞬间冲破经脉桎梏！成功踏入炼气…", "important":true, "createdAt":"2026-01-05T00:00:00Z"}
]
```

---

## 2. 核心函数

### 2.1 从条目数组生成组合文本

替换原有的 `appendToSummary`（追加纯文本），改为从 entries 实时生成：

```typescript
interface StoryEntry {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

function buildSummaryFromEntries(entries: StoryEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map(e => 
    `${e.important ? '⭐ ' : ''}【${e.title}】${e.summary}`
  ).join('\n');
}
```

每次需要 `storySummary` 时调用此函数，不持久化。

### 2.2 创建新条目

```typescript
function createEntry(title: string, summary: string, truncate = true): StoryEntry {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title,
    summary: truncate ? summary.slice(0, 60) + (summary.length > 60 ? '…' : '') : summary,
    important: false,
    createdAt: new Date().toISOString(),
  };
}
```

`truncate` 参数默认为 `true`，普通条目截断 60 字。AI 压缩生成的「📜 记忆凝练」条目传 `false`，保留完整内容。

### 2.3 修改后的压缩函数

AI 压缩时，在 prompt 中区分重要和普通条目：

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
    return buildSummaryFromEntries(entries); // 压缩失败则用原文本
  }
}
```

---

## 3. 叙事生成流程（更新后）

```
用户触发行动 → POST /api/narrative
  │
  ├─ 1. 读取 cultivator（含 storyEntries）
  ├─ 2. 计算 storySummary = buildSummaryFromEntries(entries)
  ├─ 3. 将 storySummary 注入 prompt 作为上下文
  ├─ 4. 生成叙事（AI 调用）
  ├─ 5. 保存 GameEvent
  ├─ 6. createEntry(title, narrative) 创建新条目
  ├─ 7. 追加到 entries 数组
  ├─ 8. 判断：条目数 > 50 或 总字数 > 1000
  │     ├─ 是 → compressStorySummary() AI 压缩
  │     │      → 创建一条压缩摘要条目: createEntry("📜 记忆凝练", compressedText, false)
  │     │      → 不标记重要，下次压缩时自动合并
  │     │      → 删除原非重要条目，仅保留重要 ⭐ 条目 + 这条凝练条目
  │     └─ 否 → 跳过
  ├─ 9. 保存 cultivator.storyEntries
  └─ 10. 返回叙事结果
```

### 压缩时的条目替换规则

```
压缩前：12 条 = 3 条重要 ⭐ + 9 条普通
压缩后：4 条  = 3 条重要 ⭐（不动） + 1 条「📜 记忆凝练」（代表 9 条的压缩结果）
```

重要条目永远保留不会被压缩掉。

---

## 4. UI — 「道心明镜」记忆面板

### 4.1 位置

在 dashboard 页面的叙事卡片下方，作为可折叠面板。

### 4.2 布局

```
┌────────────────────────────────────────┐
│ 📖 道心明镜 · AI 记住了这些事  [▼]    │
├────────────────────────────────────────┤
│                                        │
│  ⭐ 【突破筑基】灵气汇聚…    [✏️][🗑️]  │
│    【日常修炼】盘膝而坐…     [☆][✏️][🗑️]│
│  ⭐ 【获得玄铁剑】在洞府…   [✏️][🗑️]  │
│  📜 【记忆凝练】经历了数月…  [✏️][🗑️]  │
│                                        │
│  ┌────────────────────────────────────┐│
│  │ 📝 编辑全文概要              [保存]││
│  └────────────────────────────────────┘│
│                                        │
│  [🔄 压缩记忆]  共 12 条 · 856 字      │
└────────────────────────────────────────┘
```

### 4.3 交互

| 操作 | 效果 |
|------|------|
| ⭐/☆ 点击 | 切换 important 标记，星标条目压缩时优先保留 |
| ✏️ 点击 | 该行变成输入框，可编辑 summary，回车保存 |
| 🗑️ 点击 | 确认后删除该条目 |
| 编辑全文概要 | textarea 编辑完整文本，点击保存 → 创建一条 `title="📝 玩家记述"` 的特殊条目，清除非重要旧条目 |
| 「压缩记忆」按钮 | 手动触发：`POST /api/cultivator` 传 `{ action: "compressMemory", userId }`，后端调 AI 压缩 |
| 面板折叠 | 默认展开，localStorage 记忆折叠状态 |

### 4.4 组件

新建 `src/components/memory-panel.tsx`：

```typescript
interface MemoryPanelProps {
  cultivatorId: string;
  entries: StoryEntry[];
  onEntriesChange: (entries: StoryEntry[]) => void;
}
```

- 接收 entries 列表，内部维护编辑状态
- 每次修改后调 `POST /api/cultivator`（`action: "updateMemory"`）保存
- `onEntriesChange` 通知父组件刷新

---

## 5. API

不新建独立路由，在已有 `POST /api/cultivator` 中增加 `action` 分支：

### 5.1 读取记忆条目

通过已有 `GET /api/cultivator?userId=X` 返回，数据中已包含 `storyEntries`（由 Prisma 自动返回）。

### 5.2 更新记忆条目

```
POST /api/cultivator
Body: { action: "updateMemory", userId, storyEntries: [...] }
```

```typescript
if (body.action === "updateMemory") {
  if (!body.userId || !body.storyEntries) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }
  const cultivator = await prisma.cultivator.update({
    where: { userId: body.userId },
    data: { storyEntries: JSON.stringify(body.storyEntries), storyEntriesUpdatedAt: new Date() },
  });
  return NextResponse.json({ success: true, entries: JSON.parse(cultivator.storyEntries || '[]') });
}
```

### 5.3 手动压缩记忆

```
POST /api/cultivator
Body: { action: "compressMemory", userId }
```

```typescript
if (body.action === "compressMemory") {
  const cultivator = await prisma.cultivator.findUnique({ where: { userId: body.userId } });
  if (!cultivator) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const entries: StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
  const importantEntries = entries.filter(e => e.important);
  const normalEntries = entries.filter(e => !e.important);

  if (normalEntries.length === 0) {
    return NextResponse.json({ entries, message: "无非重要条目需要压缩" });
  }

  const compressedText = await compressStorySummary(entries, cultivator.name);
  const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);
  // 不标记 important，下次压缩时自然合并

  const newEntries = [...importantEntries, compressedEntry];

  await prisma.cultivator.update({
    where: { userId: body.userId },
    data: { storyEntries: JSON.stringify(newEntries), storyEntriesUpdatedAt: new Date() },
  });

  return NextResponse.json({ success: true, entries: newEntries });
}
```

### 5.4 读取时自动解析 JSON

修改 `GET /api/cultivator` 的返回逻辑，在返回前解析 `storyEntries`：

```typescript
if (user.cultivator?.storyEntries) {
  user.cultivator.storyEntries = JSON.parse(user.cultivator.storyEntries);
}
```

前端直接使用 `data.user.cultivator.storyEntries` 作为数组，无需手动 `JSON.parse`。

---

## 6. 涉及文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | Cultivator 加 `storyEntries String?`，移除 `storySummary` |
| `src/lib/narrative.ts` | 修改 | 新增 `StoryEntry` 接口、`buildSummaryFromEntries`、`createEntry`；修改 `appendToSummary` → 操作 entries；修改 `compressStorySummary` 接收 entries+importance |
| `src/app/api/narrative/route.ts` | 修改 | 叙事后操作 entries 而非纯文本 |
| `src/app/api/cultivator/route.ts` | 修改 | POST 新增 `action: "updateMemory"` + `action: "compressMemory"` 分支；GET 返回时自动解析 storyEntries JSON |
| `src/components/memory-panel.tsx` | **新建** | 道心明镜面板组件 |
| `src/app/dashboard/page.tsx` | 修改 | 引入 memory-panel，读取/传递 entries |

---

## 7. 兼容性

- 已有 cultivator 的 `storyEntries` 为 null，显示「尚无记忆」
- 原 `storySummary` 字段不删除但不再使用（可后续迁移脚本合并）
- 所有编辑操作离线友好，不依赖 AI
- 压缩失败不丢数据（entries 在压缩前已保存）