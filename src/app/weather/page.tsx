"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/top-nav";
import {
  type WeatherResult,
  type WeatherAction,
  type ActionResult,
  type BoonEntry,
  resolveAction,
  loadBoons,
  saveBoon,
} from "@/lib/weather";

interface WeatherPayload {
  weather: WeatherResult;
  cultivator: { id: string; age: number; quarter: number };
}

const ACTION_LABELS: Record<WeatherAction, string> = {
  wander: "外出闲逛",
  meditate: "静室打坐",
  readsky: "观云测运",
};

export default function WeatherPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ActionResult | null>(null);
  const [boons, setBoons] = useState<BoonEntry[]>([]);

  async function fetchWeather() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/weather", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "无法感知天时");
      } else {
        const p = data as WeatherPayload;
        setPayload(p);
        setBoons(loadBoons(p.cultivator.id));
      }
    } catch (e) {
      setError("网络异常，无法感知天时");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAction(action: WeatherAction) {
    if (!payload) return;
    const r = resolveAction(payload.cultivator, payload.weather, action);
    setResult(r);
    if (r.boon) {
      setBoons(saveBoon(payload.cultivator.id, r.boon, payload.weather.season));
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b1020] to-[#10202b] text-[#e3f0f5] flex flex-col items-center px-4 py-10">
      <TopNav /><div className="w-full max-w-2xl">
        <button
          onClick={() => router.push("/dreams")}
          className="text-sm text-[#5B8aa8] hover:text-[#8fc2dd] mb-6 transition-colors"
        >
          ← 回到夜梦录
        </button>

        <h1 className="text-2xl font-semibold tracking-wide mb-1">天时录</h1>
        <p className="text-xs text-[#5B8aa8] mb-8">
          凡人时期，抬头看天也是一种修行。天气牵引心情，也藏着机缘。
        </p>

        {loading && <p className="text-[#5B8aa8] animate-pulse">正在感知天时……</p>}
        {error && <p className="text-red-400">{error}</p>}

        {payload && !loading && (
          <>
            <div className="rounded-2xl border border-[#234155] bg-[#0f1c26]/70 p-6 shadow-[0_0_40px_-10px_rgba(80,160,200,0.35)]">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{payload.weather.weather.icon}</span>
                <div>
                  <h2 className="text-xl text-[#9fd6ee]">
                    {payload.weather.weather.label}
                    <span className="text-sm text-[#5B8aa8] ml-2">
                      {payload.weather.seasonLabel}
                    </span>
                  </h2>
                  <p className="text-sm text-[#7fa8c0]">
                    心情 {payload.weather.mood >= 0 ? "+" : ""}
                    {payload.weather.mood} · 运势 {payload.weather.fortune.label}
                  </p>
                </div>
              </div>
              <p className="leading-relaxed text-[#cfe6f0] mb-3">
                {payload.weather.weather.desc}
              </p>
              <p className="text-xs text-[#5B8aa8] border-t border-[#234155] pt-3">
                运势 · {payload.weather.fortune.label}：{payload.weather.fortune.desc}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {(Object.keys(ACTION_LABELS) as WeatherAction[]).map((a) => (
                <button
                  key={a}
                  onClick={() => handleAction(a)}
                  className="text-sm px-3 py-3 rounded-lg border border-[#234155] text-[#9fd6ee] hover:bg-[#16293a] transition-colors"
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>

            {result && (
              <div className="mt-5 rounded-xl border border-[#234155] bg-[#0f1c26]/60 p-5">
                <p className="text-sm text-[#7fa8c0] mb-1">
                  {ACTION_LABELS[result.action]} · 心情{" "}
                  {result.moodEffect >= 0 ? "+" : ""}
                  {result.moodEffect}
                </p>
                <p className="leading-relaxed text-[#dcecf4]">{result.text}</p>
                {result.boon && (
                  <p className="mt-3 text-xs text-[#9fe0c8]">
                    ✦ 机缘入藏：{result.boon.title} —— {result.boon.detail}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-sm text-[#5B8aa8] mb-2">机缘收藏</h3>
              {boons.length === 0 ? (
                <p className="text-xs text-[#3f6072]">尚无收藏。去天气里碰碰机缘吧。</p>
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

            <button
              onClick={fetchWeather}
              className="mt-6 text-sm px-4 py-2 rounded-lg border border-[#234155] text-[#9fd6ee] hover:bg-[#16293a] transition-colors"
            >
              重新感知天时
            </button>
          </>
        )}
      </div>
    </main>
  );
}
