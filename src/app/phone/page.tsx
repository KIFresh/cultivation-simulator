"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, CarTaxiFront } from "lucide-react";
import { toast } from "sonner";
import { getUnlockedLocations, isAwakened, calcTravelCost } from "@/lib";
import { getWorlds } from "@/lib/worlds-data";

interface CultivatorBrief {
  id: string; name: string; realm: string; age: number;
  stamina: number; gold: number; location: string;
  inventory: string | null; worldId: string | null;
}

const apps = [
  { name: "消息", icon: "💬", href: "/relationships", desc: "与NPC聊天" },
  { name: "地图", icon: "🗺️", desc: "查看地点和打车" },
  { name: "商城", icon: "🏪", href: "/shop", desc: "购买物品" },
  { name: "社交", icon: "👥", desc: "人际关系" },
  { name: "记录", icon: "📜", href: "/history", desc: "修炼历程" },
];

export default function PhonePage() {
  const router = useRouter();
  const [cultivator, setCultivator] = useState<CultivatorBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [taxiLoading, setTaxiLoading] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) { router.push("/"); return; }
    fetch(`/api/cultivator?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { toast.error(data.error); return; }
        setCultivator(data);
      })
      .catch(() => toast.error("加载角色数据失败"))
      .finally(() => setLoading(false));
  }, [router]);

  const hasPhone = cultivator?.inventory
    ? (() => {
        try {
          const inv = JSON.parse(cultivator.inventory);
          return Array.isArray(inv) && inv.some((i: any) => i.itemId === "phone");
        } catch { return false; }
      })()
    : false;

  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;
  const locs = cultivator
    ? getUnlockedLocations(cultivator.age, isAwake, [])
    : [];
  const worldLocs = getWorlds().find((w) => w.id === (cultivator?.worldId || "earth"))?.locations || [];
  const locDetails = locs.map((l: { id: string }) => ({
    ...l,
    name: worldLocs.find((wl: any) => wl.id === l.id)?.name || l.id,
  }));

  const handleTaxi = async (locId: string) => {
    if (!cultivator) return;
    const target = locDetails.find((l: any) => l.id === locId);
    if (!target || locId === cultivator.location) { toast.info("已在此处"); return; }
    const cost = calcTravelCost(cultivator.location, locId);
    const taxiStaminaCost = Math.max(1, Math.floor(cost / 3));
    const taxiGoldCost = cost * 3;
    if (cultivator.stamina < taxiStaminaCost) { toast.error(`体力不足！需要${taxiStaminaCost}`); return; }
    if (cultivator.gold < taxiGoldCost) { toast.error(`金币不足！需要${taxiGoldCost}金`); return; }

    setTaxiLoading(true);
    try {
      const res = await fetch("/api/travel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: cultivator.id, locationId: locId, useTaxi: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "打车失败"); return; }
      setCultivator(data.cultivator);
      toast.success(`🚕 打车到${target.name}（-${taxiGoldCost}金 -${taxiStaminaCost}体力）`, { duration: 2000 });
    } catch { toast.error("打车失败"); }
    finally { setTaxiLoading(false); }
  };

  if (loading) return (
    <main className="flex-1 min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">加载中…</p>
    </main>
  );

  if (showMap) return (
    <main className="flex-1 min-h-screen bg-background">
      <div className="max-w-sm mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMap(false)} className="text-muted-foreground hover:text-primary"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-lg font-bold text-foreground">🗺️ 地图</h1>
        </div>
        {cultivator && (
          <div className="text-xs text-muted-foreground">
            当前位置：{worldLocs.find((l: any) => l.id === cultivator.location)?.name || cultivator.location}
            &nbsp;| 体力：{cultivator.stamina} | 金币：{cultivator.gold}
          </div>
        )}
        {!hasPhone && (
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              需要智能手机才能使用打车功能。去市区商店购买一个。
            </CardContent>
          </Card>
        )}
        <div className="grid gap-2">
          {locDetails.map((loc: any) => {
            const isCurrent = cultivator?.location === loc.id;
            const cost = cultivator ? calcTravelCost(cultivator.location, loc.id) : 0;
            const taxiStaminaCost = Math.max(1, Math.floor(cost / 3));
            const taxiGoldCost = cost * 3;
            const canTaxi = hasPhone && cultivator && cultivator.stamina >= taxiStaminaCost && cultivator.gold >= taxiGoldCost && !isCurrent;
            return (
              <Card key={loc.id} className={`border-border bg-card ${isCurrent ? "opacity-60" : ""}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{loc.name}</span>
                    {isCurrent && <span className="text-xs text-muted-foreground ml-2">（当前）</span>}
                    {!isCurrent && <div className="text-xs text-muted-foreground mt-0.5">🚕 {taxiGoldCost}金 / {taxiStaminaCost}体力</div>}
                  </div>
                  {!isCurrent && hasPhone && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canTaxi || taxiLoading}
                      onClick={() => handleTaxi(loc.id)}
                    >
                      <CarTaxiFront className="w-3 h-3 mr-1" />
                      {taxiLoading ? "打车中…" : "打车"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );

  return (
    <main className="flex-1 min-h-screen bg-background">
      <div className="max-w-sm mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-primary"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-lg font-bold text-foreground">📱 手机</h1>
        </div>
        {cultivator && (
          <div className="text-xs text-muted-foreground px-1">
            {cultivator.name} | 💰 {cultivator.gold}金
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {apps.map((app) => (
            <Card key={app.name} className={`border-border bg-card shadow-sm hover:border-primary/30 cursor-pointer transition-colors ${app.href ? "" : ""}`}
              onClick={() => {
                if (app.name === "地图") {
                  if (!hasPhone) { toast.info("需要智能手机才能使用地图"); return; }
                  setShowMap(true);
                } else if (app.href) {
                  router.push(app.href);
                }
              }}
            >
              <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                <span className="text-2xl">{app.icon}</span>
                <span className="text-xs font-medium text-foreground">{app.name}</span>
                <span className="text-[9px] text-muted-foreground">{app.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}