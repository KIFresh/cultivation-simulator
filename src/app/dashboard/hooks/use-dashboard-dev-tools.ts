"use client";

import { useCallback } from "react";
import { toast } from "sonner";

const BIRTH_TABLE = [
  {id:"waste",p:5},{id:"mortal",p:8},{id:"elite",p:11},{id:"prodigy",p:14},{id:"monster",p:17},{id:"reborn",p:21},{id:"chosen",p:25}
];
const IDENTITY_TABLE = [
  {id:"orphan",c:0},{id:"scholar",c:2},{id:"merchant",c:3},{id:"general",c:4},{id:"sect",c:5}
];
const ELEMENT_TABLE = ["金","木","水","火","土"];
const QUALITY_TABLE = ["上品","中品","下品"];
const TALENT_TABLE = [
  {id:"protagonist",c:5},{id:"sword",c:4},{id:"pill",c:3},{id:"array",c:3},{id:"forge",c:3},{id:"treasure",c:4},{id:"body",c:2},{id:"mind",c:2}
];

export interface UseDevToolsOptions {
  onAfterCreate?: () => void;
}

export interface UseDevToolsResult {
  handleQuickCreate: () => Promise<void>;
  handleReset: () => Promise<void>;
}

export function useDevTools({ onAfterCreate }: UseDevToolsOptions = {}): UseDevToolsResult {
  const handleQuickCreate = useCallback(async () => {
    const birth = BIRTH_TABLE[Math.floor(Math.random() * BIRTH_TABLE.length)];
    const identity = IDENTITY_TABLE[Math.floor(Math.random() * IDENTITY_TABLE.length)];
    const root = Math.random() > 0.1
      ? `${ELEMENT_TABLE[Math.floor(Math.random()*5)]}_${QUALITY_TABLE[Math.floor(Math.random()*3)]}`
      : "chaos";
    const talents = TALENT_TABLE.slice().sort(() => Math.random() - 0.5);
    let budget = birth.p - identity.c - 2;
    const selectedTalentIds: string[] = [];
    for (const t of talents) {
      if (t.c <= budget) {
        selectedTalentIds.push(t.id);
        budget -= t.c;
      }
    }
    const attrKeys = ["root","spirit","insight","luck","charm","mind"];
    const attr: Record<string, number> = {};
    const base = Math.floor(budget / 6);
    const rem = budget % 6;
    attrKeys.forEach((k, i) => { attr[k] = base + (i < rem ? 1 : 0); });

    const res = await fetch("/api/cultivator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: `dev_${Date.now()}`,
        cultivatorName: `测试_${Date.now()}`,
        spiritualRoot: root,
        worldId: "earth",
      }),
    });
    const data = await res.json();
    if (!data.user) {
      toast.error("生成失败");
      return;
    }
    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("cultivatorName", data.user.cultivator.name);
    localStorage.setItem("attributes", JSON.stringify(attr));

    const identityName = { orphan:"山野遗孤", scholar:"书香门第", merchant:"商贾之子", general:"将门之后", sect:"散修传人" }[identity.id];
    const genNarrative = async (): Promise<boolean> => {
      try {
        const r = await fetch("/api/narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, type: "BIRTH", worldName: "地球", identityName, age: 1, worldId: "earth" }),
        });
        if (!r.ok) {
          const ed = await r.json().catch(() => ({}));
          throw new Error(ed.error || "出生叙事生成失败");
        }
        const birthData = await r.json().catch(() => ({}));
        if (birthData.suggestedName || birthData.cultivator?.name) {
          localStorage.setItem("cultivatorName", birthData.cultivator?.name || birthData.suggestedName);
        }
        return true;
      } catch (err) {
        console.error("出生叙事生成失败:", err);
        return new Promise((resolve) => {
          toast.error(`出生叙事生成失败: ${(err as Error).message}`, {
            action: { label: "重试", onClick: () => resolve(genNarrative()) },
            duration: 10000,
          });
        });
      }
    };

    if (await genNarrative()) {
      onAfterCreate?.();
      window.location.reload();
    }
  }, [onAfterCreate]);

  const handleReset = useCallback(async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    try {
      await fetch("/api/cultivator", { method: "DELETE" });
    } catch {}
    window.location.href = "/";
  }, []);

  return { handleQuickCreate, handleReset };
}
