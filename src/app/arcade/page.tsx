"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, ArrowLeft, Coins } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface ArcadeStats {
  played: number;
  wins: number;
  gold: number;
}
interface ArcadeGame {
  id: string;
  name: string;
  cost: number;
  maxPrize: number;
  desc: string;
}
interface Cultivator {
  id: string;
  name: string;
  gold: number;
}

export default function ArcadePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [stats, setStats] = useState<ArcadeStats>({ played: 0, wins: 0, gold: 0 });
  const [games, setGames] = useState<ArcadeGame[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/arcade`),
      ]);
      const cData = await cRes.json();
      const aData = await aRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, gold: c.gold ?? 0 });
      }
      if (aData.arcadeStats) setStats(aData.arcadeStats);
      if (aData.games) setGames(aData.games);
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

  const play = async (game: ArcadeGame) => {
    if (!userId || busy) return;
    if ((cultivator?.gold ?? 0) < game.cost) {
      toast.error("灵石不足，无法投币");
      return;
    }
    setBusy(game.id);
    try {
      const res = await fetch("/api/arcade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "游玩失败");
        return;
      }
      setCultivator((c) => (c ? { ...c, gold: data.gold } : c));
      setStats(data.arcadeStats);
      if (data.win) toast.success(`🎉 ${data.game}：赢得 ${data.prize} 灵石！`);
      else toast(`💸 ${data.game}：未中彩，花费 ${data.cost} 灵石`);
    } catch (e) {
      toast.error("游玩失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    );
  if (!cultivator)
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground mb-4">尚未创建修炼者</p>
        <Button onClick={() => router.push("/create")}>创建角色</Button>
      </main>
    );

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
              <Gamepad2 className="w-5 h-5 text-primary" /> 街机厅
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="w-4 h-4" /> 灵石
              </span>
              <span className="text-foreground font-bold">{cultivator.gold}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              <div>
                <p className="text-foreground font-bold">{stats.played}</p>游玩
              </div>
              <div>
                <p className="text-foreground font-bold">{stats.wins}</p>胜场
              </div>
              <div>
                <p className="text-foreground font-bold">{stats.gold}</p>净灵石
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {games.map((g) => (
            <Card key={g.id} className="border-border bg-card shadow-md">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.desc}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    花费 {g.cost} · 最高奖 {g.maxPrize}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-[#B33A2A] text-white shrink-0"
                  disabled={busy !== null || cultivator.gold < g.cost}
                  onClick={() => play(g)}
                >
                  {busy === g.id ? "..." : "投币"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {games.length === 0 && (
            <p className="text-muted-foreground text-xs text-center py-2">暂无游艺项目</p>
          )}
        </div>
      </div>
    </main>
  );
}
