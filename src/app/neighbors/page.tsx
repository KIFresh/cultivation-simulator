"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, Coins } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";
import { NEIGHBOR_ACTION_DEFS, type NeighborNpc, type NeighborAction } from "@/lib/neighbors";

interface Cultivator { id: string; name: string; gold: number; }

export default function NeighborsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [neighbors, setNeighbors] = useState<NeighborNpc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, nRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/neighbors`),
      ]);
      const cData = await cRes.json();
      const nData = await nRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, gold: c.gold ?? 0 });
      }
      if (nData.neighbors) setNeighbors(nData.neighbors);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    load(id);
  }, [router, load]);

  const interact = async (neighbor: NeighborNpc, action: NeighborAction) => {
    if (!userId || busy) return;
    setBusy(neighbor.name + action);
    try {
      const res = await fetch("/api/neighbors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, neighborName: neighbor.name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "互动失败"); return; }
      setCultivator((c) => (c ? { ...c, gold: data.gold } : c));
      setNeighbors((prev) => prev.map((n) => (n.name === neighbor.name ? data.neighbor : n)));
      toast(data.result?.flavor || "互动完成");
    } catch (e) { toast.error("互动失败，请重试"); }
    finally { setBusy(null); }
  };

  if (loading) return <main className="flex-1 flex items-center justify-center min-h-screen"><p className="text-muted-foreground">加载中...</p></main>;
  if (!cultivator) return <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-4"><p className="text-muted-foreground mb-4">尚未创建修炼者</p><Button onClick={() => router.push("/create")}>创建角色</Button></main>;

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button onClick={() => router.push("/life")} className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"><ArrowLeft className="w-4 h-4" /> 返回生活</button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2"><Home className="w-5 h-5 text-primary" /> 邻里</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-4 h-4" /> 灵石</span>
            <span className="text-foreground font-bold">{cultivator.gold}</span>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {neighbors.map((n) => (
            <Card key={n.name} className="border-border bg-card shadow-md">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{n.avatar}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{n.name}</p>
                    <p className="text-[11px] text-muted-foreground">{n.realm}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">亲密度 {n.intimacy}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, n.intimacy)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(Object.keys(NEIGHBOR_ACTION_DEFS) as NeighborAction[]).map((a) => {
                    const def = NEIGHBOR_ACTION_DEFS[a];
                    const disabled = busy !== null || (def.cost > 0 && cultivator.gold < def.cost);
                    return (
                      <Button key={a} size="sm" variant="outline" className="border-border text-[11px] h-8" disabled={disabled} onClick={() => interact(n, a)}>
                        {def.icon} {def.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          {neighbors.length === 0 && <p className="text-muted-foreground text-xs text-center py-2">串门走动后，邻里才会入住此处</p>}
        </div>
      </div>
    </main>
  );
}
