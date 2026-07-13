# 寿命系统 + 轮回转世 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Cultivator 增加寿元限制，超龄触发道消事件，玩家可轮回转世从 1 岁重修并获得天赋加成。

**Architecture:** Cultivator 新增 4 个字段；advance-year 路由中计算寿元、检查超限；cultivator 路由新增 reincarnate 分支；dashboard 显示寿元条和预警。

**Tech Stack:** Next.js 16 App Router, Prisma 7/SQLite, shadcn/ui

**设计文档:** `docs/superpowers/specs/2026-07-12-lifespan-reincarnation-design.md`

## 全局约束

- 渡劫期用 999999 存库，UI 显示「与天地同寿」
- 已有 cultivator 的 maxAge 为 null，首次推进年份时自动计算
- 不改动现有核心玩法逻辑

---

### 任务 1: Prisma 模型变更

**文件:**
- 修改: `prisma/schema.prisma`

- [ ] **Step 1: 在 Cultivator 模型添加 4 个字段**

在 `events` 之前添加：

```prisma
model Cultivator {
  // ... 现有字段不变（id, userId, name, spiritualRoot, realm, realmLevel, cultivationExp, totalExp, stamina, breakthroughCount, title, worldId, age, location, npcRelations, inventory, gold, createdAt, storyEntries, storyEntriesUpdatedAt）...

  maxAge              Int?
  bonusAge            Int      @default(0)
  reincarnationCount  Int      @default(0)
  talents             String?

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
git commit -m "feat: Cultivator 新增 maxAge/bonusAge/reincarnationCount/talents"
```

---

### 任务 2: 新增 `calculateMaxAge()` 函数

**文件:**
- 修改: `src/lib/cultivation-data.ts`

- [ ] **Step 1: 添加基础寿元表和计算函数**

在 `REALMS` 数组之后添加：

```typescript
/** 各境界基础寿元（年） */
const BASE_LIFESPAN: Record<string, number> = {
  "凡人": 80,
  "炼气期": 100,
  "筑基期": 200,
  "结丹期": 500,
  "元婴期": 1000,
  "化神期": 2000,
  "炼虚期": 5000,
  "合体期": 10000,
  "大乘期": 50000,
  "渡劫期": 999999, // 数据库 Int 无法存 Infinity
};

/** 计算修炼者的最大寿元 */
export function calculateMaxAge(
  realm: string,
  attributes: Record<string, number>,
  bonusAge = 0
): number {
  const base = BASE_LIFESPAN[realm] ?? 80;
  const rootBonus = (attributes.root ?? 0) * 2; // 根骨延寿
  const mindBonus = (attributes.mind ?? 0) * 1;  // 心性延寿
  return base + rootBonus + mindBonus + bonusAge;
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/cultivation-data.ts
git commit -m "feat: 新增 calculateMaxAge 寿命计算函数"
```

---

### 任务 3: 修改 advance-year 路由

**文件:**
- 修改: `src/app/api/advance-year/route.ts`

- [ ] **Step 1: 添加 import**

在文件顶部已有 import 中添加：
```typescript
import { calculateMaxAge } from "@/lib/cultivation-data";
```

- [ ] **Step 2: 在推进年份后计算寿元 + 检查超限**

在 `const oldAge = cultivator.age, newAge = oldAge + 1;` 之后添加：

```typescript
// 计算/更新寿元上限
const attrs = sanitizeAttributes(rawAttributes) || {};
let maxAge = cultivator.maxAge;
if (maxAge === null || cultivator.realm !== currentRealm) {
  maxAge = calculateMaxAge(cultivator.realm, attrs, cultivator.bonusAge || 0);
}

// 检查是否超限
if (newAge > maxAge) {
  return NextResponse.json({
    daoXiao: true,
    summary: {
      age: cultivator.age,
      realm: cultivator.realm,
      realmLevel: cultivator.realmLevel,
      breakthroughCount: cultivator.breakthroughCount,
      reincarnationCount: cultivator.reincarnationCount || 0,
      totalExp: cultivator.totalExp,
    },
  });
}

// 检查是否触发预警
const remaining = maxAge - newAge;
const totalLife = maxAge;
const warnEarly = remaining <= 10 || remaining < totalLife * 0.1;
```

- [ ] **Step 3: 在更新数据时写入 maxAge 和预警标记**

修改 `updateData` 对象，添加 `maxAge`，并在返回值中添加 `warnEarly`：

```typescript
const updateData: Prisma.CultivatorUpdateInput = {
  age: newAge,
  stamina: calculateMaxStamina(newAge, newAttributes),
  storyEntries: JSON.stringify(updatedEntries),
  storyEntriesUpdatedAt: new Date(),
  maxAge, // 持久化寿元
};
// ... 原有代码不变 ...

return NextResponse.json({
  narrative: narrativeResult,
  cultivator: updatedCultivator,
  awakenEvent,
  oldAge,
  newAge,
  newAttributes,
  schoolRank,
  schoolStage: schoolStage ? { name: schoolStage.name, grade: getSchoolGrade(newAge, schoolStage) } : null,
  occupation,
  examResult,
  warnEarly, // 新增：是否触发预警
  remaining, // 新增：剩余寿元
  maxAge,    // 新增：总寿元
});
```

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5: 提交**

```bash
git add src/app/api/advance-year/route.ts
git commit -m "feat: 推进年份时计算寿元、检查超限、返回道消/预警"
```

---

### 任务 4: 修改 cultivator API 路由

**文件:**
- 修改: `src/app/api/cultivator/route.ts`

- [ ] **Step 1: 在 POST handler 中新增 reincarnate 分支**

在 `try` 块开头，在其他逻辑之前添加：

```typescript
if (body.action === "reincarnate") {
  if (!body.userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  const cultivator = await prisma.cultivator.findUnique({
    where: { userId: body.userId },
  });
  if (!cultivator) {
    return NextResponse.json({ error: "修炼者不存在" }, { status: 404 });
  }

  const newCount = (cultivator.reincarnationCount || 0) + 1;

  const updated = await prisma.cultivator.update({
    where: { userId: body.userId },
    data: {
      realm: "凡人",
      realmLevel: 0,
      cultivationExp: 0,
      totalExp: 0,
      stamina: 20,
      breakthroughCount: 0,
      age: 1,
      gold: 50,
      location: null,
      inventory: null,
      npcRelations: null,
      title: null,
      maxAge: null,
      storyEntries: "[]",
      storyEntriesUpdatedAt: new Date(),
      reincarnationCount: newCount,
      talents: JSON.stringify(["前世记忆"]),
    },
  });

  return NextResponse.json({
    success: true,
    cultivator: updated,
    reincarnationCount: newCount,
  });
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/cultivator/route.ts
git commit -m "feat: POST 新增 reincarnate 轮回转世分支"
```

---

### 任务 5: 新建道消弹窗组件

**文件:**
- 创建: `src/components/dao-xiao-modal.tsx`

- [ ] **Step 1: 创建组件**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DaoXiaoSummary {
  age: number;
  realm: string;
  realmLevel: number;
  breakthroughCount: number;
  reincarnationCount: number;
  totalExp: number;
}

interface DaoXiaoModalProps {
  open: boolean;
  cultivatorName: string;
  userId: string;
  summary: DaoXiaoSummary;
  onClose: () => void;
}

export default function DaoXiaoModal({
  open,
  cultivatorName,
  userId,
  summary,
  onClose,
}: DaoXiaoModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReincarnate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reincarnate", userId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "轮回失败");
        return;
      }
      toast.success("轮回转世，重新踏上仙途！");
      onClose();
      router.replace("/create");
    } catch {
      toast.error("轮回失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🌑 道消身殒</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-center">
          <p className="text-foreground">
            {cultivatorName}道友，寿元耗尽，
            <br />于 <strong>{summary.age}</strong> 岁坐化于洞府之中。
          </p>
          <div className="bg-muted rounded-lg p-3 text-left text-sm space-y-1">
            <p className="text-muted-foreground">修炼一生回顾：</p>
            <p>· 最终境界：{summary.realm}</p>
            <p>· 突破次数：{summary.breakthroughCount} 次</p>
            <p>· 累计修炼：{summary.totalExp}</p>
            <p>· 轮回次数：{summary.reincarnationCount} 次</p>
          </div>
          <p className="text-xs text-muted-foreground">
            下一世将获得「前世记忆」天赋加成
          </p>
          <Button
            className="w-full"
            onClick={handleReincarnate}
            disabled={loading}
          >
            {loading ? "轮回中..." : "🔄 轮回转世"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: 提交**

```bash
git add src/components/dao-xiao-modal.tsx
git commit -m "feat: 新增道消弹窗组件 DaoXiaoModal"
```

---

### 任务 6: 修改 Dashboard

**文件:**
- 修改: `src/app/dashboard/page.tsx`

- [ ] **Step 1: 添加 import 和 state**

```tsx
import DaoXiaoModal from "@/components/dao-xiao-modal";
```

在 `Home` 函数中添加 state：
```tsx
const [daoXiao, setDaoXiao] = useState<{ summary: any; name: string } | null>(null);
const [warnEarly, setWarnEarly] = useState(false);
const [remaining, setRemaining] = useState(0);
const [maxAge, setMaxAge] = useState<number | null>(null);
```

- [ ] **Step 2: 推进年份响应中处理道消和预警**

在调用 advance-year API 之后、处理正常响应之前，检查 `daoXiao`：

```typescript
if (data.daoXiao) {
  setDaoXiao({ summary: data.summary, name: cultivator.name });
  return;
}

// 处理预警
if (data.warnEarly) {
  setWarnEarly(true);
  setRemaining(data.remaining);
  setMaxAge(data.maxAge);
}
```

- [ ] **Step 3: 角色信息区添加寿元显示**

在显示年龄的位置附近添加：
```tsx
{maxAge !== null && maxAge > 0 && (
  <div className="text-xs text-muted-foreground">
    <span>寿元：{cultivator.age} / {maxAge >= 999999 ? "∞" : maxAge} 岁</span>
    <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          remaining <= 5 ? "bg-red-500" : remaining < maxAge * 0.1 ? "bg-yellow-500" : "bg-green-500"
        }`}
        style={{ width: `${Math.max(0, (remaining / maxAge) * 100)}%` }}
      />
    </div>
    <span className="text-[10px]">剩余 {Math.max(0, remaining)} 年</span>
  </div>
)}
```

- [ ] **Step 4: 添加道消弹窗和预警提示**

在 `</main>` 之前添加：
```tsx
{daoXiao && (
  <DaoXiaoModal
    open={true}
    cultivatorName={daoXiao.name}
    userId={userId || ""}
    summary={daoXiao.summary}
    onClose={() => setDaoXiao(null)}
  />
)}

{warnEarly && (
  <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-50">
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg">
      <p className="text-red-700 text-sm font-medium">⚠️ 大限将至</p>
      <p className="text-red-600 text-xs mt-1">
        仅剩 {remaining} 年寿元。突破境界可延年益寿。
      </p>
      <button
        onClick={() => setWarnEarly(false)}
        className="text-red-500 text-xs underline mt-1"
      >
        知晓了
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: 验证编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 6: 提交**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: dashboard 集成寿元显示、大限预警、道消弹窗"
```

---

### 任务 7: 最终集成验证

- [ ] **Step 1: 完整编译检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 2: 确认文件变更清单**

```bash
git status
```
Expected：
- 修改: `prisma/schema.prisma`
- 修改: `src/lib/cultivation-data.ts`
- 修改: `src/app/api/advance-year/route.ts`
- 修改: `src/app/api/cultivator/route.ts`
- 新建: `src/components/dao-xiao-modal.tsx`
- 修改: `src/app/dashboard/page.tsx`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 寿命系统 + 轮回转世（完成）"
```