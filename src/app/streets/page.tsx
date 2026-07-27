"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/top-nav";
import {
  type OmenResult,
  type DistrictKey,
  type BoonEntry,
  DISTRICTS,
  loadStreetBoons,
  saveStreetBoon,
} from "@/lib/street-omen";

interface StreetPayload {
  omen: OmenResult;
  cultivator: { id: string; age: number; quarter: number };
}

export default function StreetsPage() {
  const router = useRouter();
  const [district, setDistrict] = useState<DistrictKey>("oldtown");
  const [payload, setPayload] = useState<StreetPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boons, setBoons] = useState<BoonEntry[]>([]);

  async function wander() {
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const res = await fetch("/api/streets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "无法感知街角");
      } else {
        const p = data as StreetPayload;
        setPayload(p);
        setBoons(loadStreetBoons(p.cultivator.id));
      }
    } catch (e) {
      setError("网络异常，无法感知街角");
    } finally {
      setLoading(false);
    }
  }

  function collect() {
    if (!payload || !payload.omen.boon) return;
    setBoons(saveStreetBoon(payload.cultivator.id, payload.omen.boon, payload.omen.season));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b1020] to-[#10202b] text-[#e3f0f5] flex flex-col items-center px-4 py-10">
      <TopNav /><div className="w-full max-w-2xl">
        <button
          onClick={() => router.push("/weather")}
          className="text-sm text-[#5B8aa8] hover:text-[#8fc2dd] mb-6 transition-colors"
        >
          ← 回到天时录
        </button>

        <h1 className="text-2xl font-semibold tracking-wide mb-1">街遇录</h1>
        <p className="text-xs text-[#5B8aa8] mb-8">
          城市的缝隙里藏着道。挑一个街区，出门走走。
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {DISTRICTS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDistrict(d.key)}
              className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                district === d.key
                  ? "border-[#3a6c88] bg-[#16293a] text-[#9fd6ee]"
                  : "border-[#234155] text-[#7fa8c0] hover:bg-[#16293a]"
              }`}
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={wander}
          className="w-full text-sm px-4 py-3 rounded-lg border border-[#234155] text-[#9fd6ee] hover:bg-[#16293a] transition-colors mb-6"
        >
          外出游荡
        </button>

        {loading && <p className="text-[#5B8aa8] animate-pulse">正在游荡……</p>}
        {error && <p className="text-red-400">{error}</p>}

        {payload && !loading && (
          <div className="rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-6 shadow-[0_0_40px_-10px_rgba(80,160,200,0.35)]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{payload.omen.omen.icon}</span>
              <div>
                <h2 className="text-xl text-[#9fd6ee]">
                  {payload.omen.omen.title}
                  <span className="text-sm text-[#5B8aa8] ml-2">
                    {payload.omen.district.label} · {payload.omen.seasonLabel}
                  </span>
                </h2>
                <p className="text-sm text-[#7fa8c0]">
                  {payload.omen.omen.kind === "sage" ? "奇人" : "线索"}
                </p>
              </div>
            </div>
            <p className="leading-relaxed text-[#cfe6f0] mb-3">{payload.omen.omen.text}</p>
            {payload.omen.boon && (
              <button
                onClick={collect}
                className="text-xs text-[#9fe0c8] border border-[#234155] rounded-lg px-3 py-2 hover:bg-[#16293a] transition-colors"
              >
                ✦ 收入机缘：{payload.omen.boon.title}
              </button>
            )}
            {!payload.omen.boon && (
              <p className="text-xs text-[#3f6072]">这次只是寻常际遇，无可收藏的机缘。</p>
            )}
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-sm text-[#5B8aa8] mb-2">机缘收藏</h3>
          {boons.length === 0 ? (
            <p className="text-xs text-[#3f6072]">尚无收藏。去街角碰碰机缘吧。</p>
          ) : (
            <ul className="space-y-2">
              {boons.map((b, i) => (
                <li
                  key={`${b.ts}-${i}`}
                  className="text-xs text-[#9fd6ee] border border-[#234155] rounded-lg px-3 py-2 bg-[#0f1c26]/40"
                >
                  <span className="text-[#7fa8c0]">第{b.season}季 · </span>
                  <span className="text-[#9fe0c8]">{b.title}</span>
                  <span className="text-[#7fa8c0]"> —— {b.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
