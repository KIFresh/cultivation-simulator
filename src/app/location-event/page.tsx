"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationEvent, LocationEventEffect } from "@/lib/location-events";

import TopNav from "@/components/top-nav";

const ATTR_LABEL: Record<string, string> = {
  root: "根骨",
  spirit: "神识",
  insight: "悟性",
  luck: "气运",
  charm: "魅力",
  mind: "心智",
};

function effectHints(fx: LocationEventEffect): string[] {
  const out: string[] = [];
  if (fx.goldDelta)
    out.push(fx.goldDelta > 0 ? `💰 获得 ${fx.goldDelta} 金币` : `💰 花费 ${-fx.goldDelta} 金币`);
  if (fx.healthDelta) out.push(`❤️ 健康 ${fx.healthDelta > 0 ? "+" : ""}${fx.healthDelta}`);
  if (fx.attrExp)
    for (const [k, v] of Object.entries(fx.attrExp))
      out.push(`📖 ${ATTR_LABEL[k] ?? k}经验 +${v}`);
  if (fx.npcMeet) out.push(`🤝 遇见：${fx.npcMeet}`);
  if (fx.memory) out.push(`📝 记入记忆`);
  return out;
}

interface EventResult {
  event: LocationEvent;
  gold?: number;
  health?: number;
}

export default function LocationEventPage() {
  const router = useRouter();
  const [event, setEvent] = useState<LocationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventResult | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/location-event");
      const data = await res.json();
      if (!res.ok) setError(data.error || "无法探索此地");
      else setEvent(data.event ?? null);
    } catch {
      setError("网络异常，无法探索此地");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function experience() {
    if (!event || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/location-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "经历失败");
      else {
        setResult(data as EventResult);
        setDone(true);
      }
    } catch {
      setError("网络异常，经历失败");
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

        <h1 className="text-2xl font-semibold tracking-wide mb-1">地点奇遇</h1>
        <p className="text-xs text-[#5B8aa8] mb-6">
          行走市井山野，说不定就撞上一段机缘。
        </p>

        {loading && <p className="text-[#5B8aa8] animate-pulse">正在张望四周……</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !done && event && (
          <div className="rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-5 shadow-[0_0_40px_-10px_rgba(240,180,120,0.25)]">
            <h2 className="text-lg text-[#f5c98a] mb-2">✦ {event.title}</h2>
            <p className="text-sm text-[#cfe6f0] mb-3">{event.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {effectHints(event.effects).map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-1 rounded-full bg-[#16293a] text-[#9fd6ee]"
                >
                  {h}
                </span>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={experience}
              className="w-full text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-[#f5c98a] to-[#ff9e6b] text-[#10131a] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? "经历中……" : "经历这段奇遇"}
            </button>
          </div>
        )}

        {!loading && !done && !event && (
          <p className="text-[#3f6072] text-sm">
            今天此地风平浪静，没什么特别的事发生。换个点逛逛，或明天再来看看。
          </p>
        )}

        {done && result && (
          <div className="mt-2 rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-5">
            <p className="text-sm text-[#cfe6f0] mb-1">
              ✦ {result.event.title} —— 已收入经历。
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {effectHints(result.event.effects).map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-1 rounded-full bg-[#16293a] text-[#9fe6c8]"
                >
                  {h}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-[#3f6072] mt-3">
              同一地点每天只会撞见一件奇遇，明天再来看看。
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
