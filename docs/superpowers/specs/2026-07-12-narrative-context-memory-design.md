# AI 叙事上下文记忆 — 设计规范

## 概述

为 AI 叙事引擎增加剧情上下文记忆功能：每次叙事后自动追加一句话摘要到剧情概要，概要超过 1000 字时触发 AI 压缩，从而让 AI 在生成新叙事时「记得」之前发生过什么，提升故事连续性。

---

## 1. 数据模型

### 1.1 Prisma 变更

在 `Cultivator` 模型新增两个字段：

```prisma
model Cultivator {
  // ... 现有字段不变 ...

  storySummary          String?   // 剧情概要，默认 null
  storySummaryUpdatedAt DateTime? // 最后更新时间（追加或压缩）
}
```

- `storySummary` 为 null 表示尚未初始化（新角色），第一次叙事后写入
- `storySummaryUpdatedAt` 用于调试和追踪
- 已有 cultivator 兼容：null 字段，下次叙事时自动初始化

---

## 2. 概要追加逻辑（纯代码，零 AI 开销）

### 2.1 追加格式

每次新叙事后，自动追加一行：

```
【标题】叙事前 60 字…
```

### 2.2 追加函数

```typescript
function appendToSummary(currentSummary: string | null, event: { title: string; narrative: string }): string {
  const summaryLine = `【${event.title}】${event.narrative.slice(0, 60)}…`;
  if (!currentSummary) return summaryLine;
  return currentSummary + '\n' + summaryLine;
}
```

### 2.3 压缩阈值检查（纯代码）

```typescript
function shouldCompress(summary: string): boolean {
  const text = summary.replace(/\n/g, '');
  return text.length > 1000; // 中文字符数
}
```

- 纯 `if` 判断，零开销
- 仅当 `true` 时才触发 AI 压缩

---

## 3. AI 压缩逻辑

### 3.1 阈值

- 概要超过 **1000 字**（中文）时触发压缩
- 目标压缩到 **500 字以内**

### 3.2 压缩函数

在 `src/lib/narrative.ts` 中新增：

```typescript
export async function compressStorySummary(
  summary: string,
  cultivatorName: string
): Promise<string> {
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
    // 压缩失败不影响游戏，保留原概要
    return summary;
  }
}
```

### 3.3 设计要点

- temperature 设低（0.3）保证压缩的一致性
- 输出纯文本，不要求 JSON，减少出错概率
- 压缩失败保留原概要，不阻断游戏流程

---

## 4. 完整流程

```
用户触发行动 → POST /api/narrative
  │
  ├─ 1. 读取 cultivator（含 storySummary）
  ├─ 2. 将 storySummary 注入 prompt 作为上下文
  ├─ 3. 生成叙事（AI 调用）
  ├─ 4. 保存 GameEvent
  ├─ 5. appendToSummary() 追加到概要（纯代码）
  ├─ 6. shouldCompress() 判断是否超 1000 字（纯代码）
  │     ├─ 否 → 保存 cultivator，返回响应
  │     └─ 是 → compressStorySummary() AI 压缩 → 保存 → 返回响应
  └─ 7. 返回叙事结果
```

### 4.1 Prompt 中注入概要

在每个叙事生成函数的 prompt 末尾追加：

```
【已发生的剧情】
{storySummary}

请基于以上已发生的剧情，继续写接下来的故事。
```

---

## 5. 涉及文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | Cultivator 加 storySummary、storySummaryUpdatedAt |
| `src/lib/narrative.ts` | 修改 | 新增 `compressStorySummary` 函数 |
| `src/lib/narrative.ts` | 修改 | 每个生成函数 prompt 追加概要上下文 |
| `src/app/api/narrative/route.ts` | 修改 | 叙事后执行追加 + 阈值检查 + 触发压缩 |

---

## 6. 兼容性

- 已有 cultivator 的 `storySummary` 为 null，下次叙事时自动初始化
- 压缩失败不影响游戏，概要维持原样
- 追加逻辑是纯字符串操作，不会抛出异常
- 无需数据迁移脚本

---

## 7. 设计原则

- **日常零开销**：追加和阈值检查是纯代码，无 AI 调用
- **压缩隔离开**：压缩失败不阻断主流程
- **渐进增强**：新字段为 null，旧数据全兼容
- **YAGNI**：只做概要记忆，不做向量化、不做 RAG、不做多轮对话记忆