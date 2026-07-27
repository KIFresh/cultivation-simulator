"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, ArrowLeft, MapPin, Compass } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";
import { LOCATIONS, isAwakened, TRAVEL_MODES, calcTravelCostByMode, type TravelModeId } from "@/lib";

interface Cultivator {
  id: string; name: string; realm: string; realmLevel: number;
  cultivationExp: number; spiritualRoot: string; age: number;
  attributes: Record<string, number> | string | null;
  location: string | null; stamina: number; gold: number;
}

export default function WorldPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TravelModeId>("walk");

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    fetch(`/api/cultivator?userId=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.user?.cultivator) setCultivator(d.user.cultivator); })
      .catch(() => {});
  }, [router]);

  const awake = cultivator ? isAwakened(cultivator.realm) : false;

  const handleTravel = async (locId: string, mode: TravelModeId) => {
    if (!userId || traveling) return;
    setTraveling(true);
    try {
      const res = await fetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, locationId: locId, travelMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "旅行失败"); return; }
      setCultivator(data.cultivator);
      localStorage.setItem("currentLocation", locId);
    } catch {
      alert("旅行失败");
    } finally {
      setTraveling(false);
    }
  };

  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm text-[#7A1F18] hover:text-[#B83227] transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回修行
        </button>

        <div className="silk-card rounded-3xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#EADCD0]">
            <h3 className="font-calligraphy text-2xl font-bold tracking-widest text-[#7A1F18] flex items-center">
              <Globe className="mr-2.5 text-[#D49B4B]" /> 世界
            </h3>
            <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">WORLD MAP</span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 pt-4">
            {/* 左侧：出行方式选择 */}
            <div className="md:w-52 shrink-0 space-y-3">
              <div className="flex items-center space-x-2 pb-1 text-xs font-bold text-[#2C1E1E]">
                <Compass className="text-[#B83227]" /> 出行方式
              </div>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                {TRAVEL_MODES.map((m) => {
                  const active = m.id === selectedMode;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMode(m.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                        active
                          ? "border-[#B83227] bg-[#FDF2F0]"
                          : "border-[#EADCD0] bg-white hover:border-[#D49B4B]"
                      }`}
                    >
                      <span className="text-lg leading-none">{m.icon}</span>
                      <div>
                        <div className="text-[13px] font-medium text-[#2C1E1E]">{m.name}</div>
                        <div className="text-[9px] text-gray-400 leading-tight">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                选定出行方式后，点击右侧地点即可按该方式前往。
              </p>
            </div>

            {/* 右侧：可往之地 */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center space-x-2 pb-1 text-xs font-bold text-[#2C1E1E]">
                <MapPin className="text-[#B83227]" /> 可往之地
              </div>
              {LOCATIONS.map((loc) => {
                const unlocked = !loc.requireAwakened || awake;
                const isCurrent = (cultivator?.location || "home") === loc.id;
                const cost = calcTravelCostByMode(cultivator?.location || "home", loc.id, selectedMode);
                const disabled =
                  traveling || isCurrent || !unlocked
                  || cost.staminaCost > (cultivator?.stamina ?? 0)
                  || cost.goldCost > (cultivator?.gold ?? 0);
                return (
                  <div key={loc.id} className={`p-4 rounded-2xl border transition-all ${
                    unlocked ? "bg-[#FAF4EB] border-[#D49B4B]/40" : "bg-gray-50/70 border-[#EADCD0]/60 opacity-60 select-none"
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${
                          unlocked ? "bg-white text-[#B83227] border-[#EADCD0]" : "bg-gray-100 text-gray-400 border-gray-200"
                        }`}>
                          <span>{loc.icon}</span>
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${unlocked ? "text-[#2C1E1E]" : "text-gray-500"}`}>{loc.name}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{loc.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {isCurrent ? (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#B83227] text-white">当前所在地</span>
                        ) : unlocked ? (
                          <button
                            disabled={disabled}
                            onClick={() => { if (window.confirm(`确定前往「${loc.name}」吗？\n体力${cost.staminaCost} · 金币${cost.goldCost}`)) handleTravel(loc.id, selectedMode); }}
                            title={`体力${cost.staminaCost} · 金币${cost.goldCost}`}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#EADCD0] bg-white text-[#2C1E1E] hover:border-[#B83227] hover:bg-[#FDF2F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            前往 · 体力{cost.staminaCost} 金{cost.goldCost}
                          </button>
                        ) : (
                          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-400">需觉醒</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </VermilionShell>
  );
}
