"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PiggyBank, ArrowLeft, Coins } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface Cultivator { id: string; name: string; gold: number; savings: number; }

export default function SavingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (uid: string) => {
    try {
      const cRes = await fetch(`/api/cultivator?userId=${uid}`);
      const cData = await cRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, gold: c.gold ?? 0, savings: c.savings ?? 0 });
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

  const operate = async (action: "deposit" | "withdraw") => {
    if (!userId || busy) return;
    if (amount <= 0) { toast.error("金额必须为正整数"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || "操作失败"); return; }
      setCultivator((c) => (c ? { ...c, gold: data.gold, savings: data.savings } : c));
      toast.success(action === "deposit" ? `💰 存入 ${data.amount} 灵石` : `💰 取出 ${data.amount} 灵石`);
    } catch (e) { toast.error("操作失败，请重试"); }
    finally { setBusy(false); }
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
            <CardTitle className="text-foreground flex items-center gap-2"><PiggyBank className="w-5 h-5 text-primary" /> 储蓄罐</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-muted rounded p-3">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Coins className="w-3 h-3" /> 手中灵石</p>
                <p className="text-foreground font-bold text-lg">{cultivator.gold}</p>
              </div>
              <div className="bg-muted rounded p-3">
                <p className="text-xs text-muted-foreground">🐷 储蓄罐</p>
                <p className="text-foreground font-bold text-lg">{cultivator.savings}</p>
              </div>
            </div>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10)))} className="bg-white border-border text-foreground" />
            <div className="grid grid-cols-2 gap-2">
              <Button className="bg-primary hover:bg-[#B33A2A] text-white" disabled={busy || cultivator.gold < amount} onClick={() => operate("deposit")}>存入</Button>
              <Button variant="outline" className="border-border" disabled={busy || cultivator.savings < amount} onClick={() => operate("withdraw")}>取出</Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">储蓄罐里的灵石只在跨年时悄然生息，平日安稳不动。</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
