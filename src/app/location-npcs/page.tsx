"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type LocationNpc,
  type LocationNpcAction,
  type LocationNpcInteractionResult,
  LOCATION_NPC_ACTION_DEFS,
} from "@/lib/location-npcs";

import TopNav from "@/components/top-nav";

const ATTR_LABEL: Record<string, string> = {
  root: "根骨",
  spirit: "神识",
  insight: "悟性",
  luck: "气运",
  charm: "魅力",
  mind: "心智",
};

interface LocationNpcPayload {
  npcs: LocationNpc[];
  locationId: string;
  gold: number;
  age: number;
}

export default function LocationNpcsPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<LocationNpcPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocationNpcInteractionResult | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/location-npc");
      const data = await res.json();
      if (!res.ok) setError(data.error || "无法加载地点人物");
      else setPayload(data as LocationNpcPayload);
    } catch {
      setError("网络异常，无法加载地点人物");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function interact(name: string, action: LocationNpcAction) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/location-npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, npcName: name }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "互动失败");
      else {
        setResult(data.result);
        setPayload((p) =>
          p
            ? {
                ...p,
                npcs: p.npcs.map((n) => (n.name === name ? data.npc : n)),
                gold: data.gold,
              }
            : p
        );
      }
    } catch {
      setError("网络异常，互动失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b1020] to-[#10202b] text-[#e3f0f5] flex flex-col items-center px-4 py-10">
      <TopNav />
      <div className="w-full max-w-2xl">
        <button
          onClick={() => router.push("/life")}
          className="text-sm text-[#5B8aa8] hover:text-[#8fc2dd] mb-6 transition-colors"
        >
          ← 回到生活
        </button>

        <h1 className="text-2xl font-semibold tracking-wide mb-1">地点人物</h1>
        <p className="text-xs text-[#5B8aa8] mb-2">每个去处都有常驻的脸孔，处久了便是缘。</p>
        {payload && <p className="text-xs text-[#7fa8c0] mb-6">💰 金币 {payload.gold}</p>}

        {loading && <p className="text-[#5B8aa8] animate-pulse">正在张望……</p>}
        {error && <p className="text-red-400">{error}</p>}

        {payload && !loading && (
          <div className="space-y-4">
            {payload.npcs.length === 0 && (
              <p className="text-[#3f6072] text-sm">
                这里还没遇上什么人。多来几趟，面孔自然就熟了。
              </p>
            )}
            {payload.npcs.map((n) => (
              <div
                key={n.name}
                className="rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-4 shadow-[0_0_40px_-10px_rgba(240,180,120,0.25)]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{n.avatar}</span>
                  <div className="flex-1">
                    <h2 className="text-lg text-[#f5c98a]">{n.name}</h2>
                    <p className="text-xs text-[#7fa8c0]">{n.realm}</p>
                  </div>
                  <span className="text-xs text-[#9fd6ee]">亲密度 {n.intimacy}</span>
                </div>
                {n.intro && <p className="text-[11px] text-[#5B8aa8] mb-2">{n.intro}</p>}
                <div className="h-2 rounded-full bg-[#16293a] mb-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#f5c98a] to-[#ff9e6b]"
                    style={{ width: `${n.intimacy}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(LOCATION_NPC_ACTION_DEFS) as LocationNpcAction[]).map((act) => {
                    const def = LOCATION_NPC_ACTION_DEFS[act];
                    return (
                      <button
                        key={act}
                        disabled={busy || (def.cost > 0 && payload.gold < def.cost)}
                        onClick={() => interact(n.name, act)}
                        className="text-xs px-2 py-2 rounded-lg border border-[#234155] text-[#9fd6ee] hover:bg-[#16293a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {def.icon} {def.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#3f6072] mt-2">
                  {LOCATION_NPC_ACTION_DEFS.gossip.desc} · {LOCATION_NPC_ACTION_DEFS.gift.desc} ·{" "}
                  {LOCATION_NPC_ACTION_DEFS.help.desc}
                </p>
              </div>
            ))}
          </div>
        )}

        {result && !loading && (
          <div className="mt-4 rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-4">
            <p className="text-sm text-[#cfe6f0] mb-1">{result.flavor}</p>
            <p className="text-xs text-[#f5d98a]">
              ✦ 亲密度 +{result.intimacyDelta}
              {result.attr && result.attrDelta
                ? ` · ${ATTR_LABEL[result.attr]} +${result.attrDelta}`
                : ""}
            </p>
            {result.goldDelta !== 0 && (
              <p className="text-xs text-[#9fe0c8]">
                {result.goldDelta > 0
                  ? `💰 获得 ${result.goldDelta} 金币`
                  : `💰 花费 ${-result.goldDelta} 金币`}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
