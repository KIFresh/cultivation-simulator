"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PawPrint, ArrowLeft, Gem, Leaf, Egg } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface SpiritPet { id: string; name?: string; level: number; state?: "active" | "resting"; skipQuarters?: number; [key: string]: unknown; }
interface UpkeepCost { petId: string; level: number; cost: { low: number; grass: number } }
interface UpgradeCost { petId: string; level: number; cost: { mid: number; grass: number } | null }

interface PetState {
  pets: SpiritPet[];
  hasEgg: boolean;
  spiritStoneLow: number;
  spiritStoneMid: number;
  grass: number;
  maxLevel: number;
  hatchCost: { amount: number };
  upkeepCosts: UpkeepCost[];
  upgradeCosts: UpgradeCost[];
}

export default function SpiritPetPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PetState | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/spirit-pet`);
      const data = await res.json();
      if (data.pets) {
        setState({
          pets: data.pets,
          hasEgg: data.hasEgg,
          spiritStoneLow: data.spiritStoneLow ?? 0,
          spiritStoneMid: data.spiritStoneMid ?? 0,
          grass: data.grass ?? 0,
          maxLevel: data.maxLevel ?? 5,
          hatchCost: data.hatchCost ?? { amount: 20 },
          upkeepCosts: data.upkeepCosts ?? [],
          upgradeCosts: data.upgradeCosts ?? [],
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    load(id);
  }, [router, load]);

  const call = async (body: Record<string, unknown>, key: string) => {
    if (!userId || busy) return;
    setBusy(key);
    try {
      const res = await fetch("/api/spirit-pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { toast.error(data.error || "操作失败"); return; }
      if (data.pets) {
        setState((s) => (s ? {
          ...s,
          pets: data.pets,
          hasEgg: body.action === "hatch" ? false : s.hasEgg,
          spiritStoneLow: body.action === "hatch" ? s.spiritStoneLow - s.hatchCost.amount : s.spiritStoneLow,
        } : s));
      }
      toast.success("✅ 灵宠洞府已更新");
    } catch (e) { toast.error("操作失败，请重试"); }
    finally { setBusy(null); }
  };

  if (loading) return <main className="flex-1 flex items-center justify-center min-h-screen"><p className="text-muted-foreground">加载中...</p></main>;

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button onClick={() => router.push("/life")} className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"><ArrowLeft className="w-4 h-4" /> 返回生活</button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2"><PawPrint className="w-5 h-5 text-primary" /> 灵宠洞府</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-muted rounded p-2"><p className="text-foreground font-bold">{state?.spiritStoneLow ?? 0}</p><p className="text-muted-foreground flex items-center justify-center gap-0.5"><Gem className="w-3 h-3" />下品</p></div>
            <div className="bg-muted rounded p-2"><p className="text-foreground font-bold">{state?.spiritStoneMid ?? 0}</p><p className="text-muted-foreground flex items-center justify-center gap-0.5"><Gem className="w-3 h-3" />中品</p></div>
            <div className="bg-muted rounded p-2"><p className="text-foreground font-bold">{state?.grass ?? 0}</p><p className="text-muted-foreground flex items-center justify-center gap-0.5"><Leaf className="w-3 h-3" />灵草</p></div>
          </CardContent>
        </Card>

        {state?.hasEgg && (
          <Card className="border-primary/30 bg-primary/5 shadow-md">
            <CardContent className="p-3 space-y-2">
              <p className="text-sm text-foreground flex items-center gap-1"><Egg className="w-4 h-4" /> 你拥有一枚灵宠蛋</p>
              <Input placeholder="给灵宠起个名字（可留空）" value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-border text-foreground" />
              <Button className="w-full bg-primary hover:bg-[#B33A2A] text-white" disabled={busy !== null || (state?.spiritStoneLow ?? 0) < state.hatchCost.amount} onClick={() => call({ action: "hatch", name: name.trim() || undefined }, "hatch")}>
                {busy === "hatch" ? "孵化中..." : `孵化（消耗 ${state.hatchCost.amount} 下品灵石）`}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {state?.pets.map((p) => {
            const up = state.upgradeCosts.find((u) => u.petId === p.id);
            const upc = state.upkeepCosts.find((u) => u.petId === p.id);
            const canUpgrade = p.level < (state.maxLevel ?? 5) && !!up?.cost && (state.spiritStoneMid >= up.cost.mid) && (state.grass >= up.cost.grass);
            const canUpkeep = upc && (state.spiritStoneLow >= upc.cost.low) && (state.grass >= upc.cost.grass);
            return (
              <Card key={p.id} className="border-border bg-card shadow-md">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{p.name || "灵宠"}</p>
                    <span className="text-xs text-muted-foreground">等级 {p.level}/{state?.maxLevel ?? 5}</span>
                  </div>
                  <div className="flex gap-2">
                    {p.level < (state.maxLevel ?? 5) && (
                      <Button size="sm" className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={busy !== null || !canUpgrade} onClick={() => call({ action: "upgrade", petId: p.id }, "up_" + p.id)}>
                        {busy === "up_" + p.id ? "培育中..." : up?.cost ? `培育（${up.cost.mid}中品·${up.cost.grass}草）` : "已满级"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1 border-border" disabled={busy !== null || !canUpkeep} onClick={() => call({ action: "upkeep" }, "upkeep")}>
                      {busy === "upkeep" ? "养护中..." : upc ? `养护（${upc.cost.low}下品·${upc.cost.grass}草）` : "养护"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!state || state.pets.length === 0) && <p className="text-muted-foreground text-xs text-center py-2">尚无灵宠，先孵化一枚灵宠蛋吧</p>}
        </div>
      </div>
    </main>
  );
}
