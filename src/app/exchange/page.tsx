"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Banknote, ArrowLeft, Coins, Gem } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

type Direction = "stone_to_gold" | "gold_to_stone";
type Tier = "low" | "mid" | "high";
interface StoneBalances {
  spiritStoneLow: number;
  spiritStoneMid: number;
  spiritStoneHigh: number;
}

const TIER_LABEL: Record<Tier, string> = { low: "下品灵石", mid: "中品灵石", high: "上品灵石" };

export default function ExchangePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gold, setGold] = useState(0);
  const [stones, setStones] = useState<StoneBalances>({
    spiritStoneLow: 0,
    spiritStoneMid: 0,
    spiritStoneHigh: 0,
  });
  const [direction, setDirection] = useState<Direction>("stone_to_gold");
  const [tier, setTier] = useState<Tier>("low");
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, eRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/exchange`),
      ]);
      const cData = await cRes.json();
      const eData = await eRes.json();
      if (cData.user?.cultivator) setGold(cData.user.cultivator.gold ?? 0);
      if (eData.spiritStones) setStones(eData.spiritStones);
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/");
      return;
    }
    setUserId(id);
    load(id);
  }, [router, load]);

  const swap = async () => {
    if (!userId || busy) return;
    if (amount <= 0) {
      toast.error("数量必须为正整数");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, tier, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "兑换失败");
        return;
      }
      setGold(data.gold);
      setStones(data.spiritStones);
      toast.success("✅ 兑换完成");
    } catch (e) {
      toast.error("兑换失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button
          onClick={() => router.push("/life")}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 返回生活
        </button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" /> 兑换所
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="w-4 h-4" /> 金币
              </span>
              <span className="text-foreground font-bold">{gold}</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Gem className="w-3 h-3" /> 灵石余额
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-muted rounded p-1.5">
                  <p className="text-foreground font-bold">{stones.spiritStoneLow}</p>
                  <p className="text-muted-foreground">下品</p>
                </div>
                <div className="bg-muted rounded p-1.5">
                  <p className="text-foreground font-bold">{stones.spiritStoneMid}</p>
                  <p className="text-muted-foreground">中品</p>
                </div>
                <div className="bg-muted rounded p-1.5">
                  <p className="text-foreground font-bold">{stones.spiritStoneHigh}</p>
                  <p className="text-muted-foreground">上品</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm">兑换操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["stone_to_gold", "gold_to_stone"] as Direction[]).map((d) => (
                <Button
                  key={d}
                  variant={direction === d ? "default" : "outline"}
                  className={
                    direction === d ? "bg-primary hover:bg-[#B33A2A] text-white" : "border-border"
                  }
                  onClick={() => setDirection(d)}
                >
                  {d === "stone_to_gold" ? "灵石 → 金币" : "金币 → 灵石"}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
                className="flex-1 h-9 rounded-md border border-border bg-white text-foreground text-sm px-2"
              >
                {(Object.keys(TIER_LABEL) as Tier[]).map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-24 h-9 bg-white border-border text-foreground"
              />
            </div>
            <Button
              className="w-full bg-primary hover:bg-[#B33A2A] text-white"
              disabled={busy}
              onClick={swap}
            >
              {busy ? "兑换中..." : "兑换"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
