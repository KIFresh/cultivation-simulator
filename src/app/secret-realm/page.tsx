"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mountain, ArrowLeft, Zap } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface RealmReward { attr?: string; value?: number; gold?: number; item?: string; }
interface SecretRealm { id: string; name: string; danger: string; desc: string; reqRealm: string; reward: RealmReward; }
interface Cultivator { id: string; name: string; stamina: number; realm: string; }

export default function SecretRealmPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [realms, setRealms] = useState<SecretRealm[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/secret-realm`),
      ]);
      const cData = await cRes.json();
      const rData = await rRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, stamina: c.stamina ?? 0, realm: c.realm });
      }
      if (rData.realms) setRealms(rData.realms);
    } catch { /* 忽略 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    load(id);
  }, [router, load]);

  const explore = async (realm: SecretRealm) => {
    if (!userId || busy) return;
    if ((cultivator?.stamina ?? 0) < 10) { toast.error("体力不足，无法探索"); return; }
    setBusy(realm.id);
    try {
      const res = await fetch("/api/secret-realm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realmId: realm.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "探索失败"); return; }
      setCultivator((c) => (c ? { ...c, stamina: c.stamina - 10 } : c));
      if (data.outcome === "success") {
        const parts: string[] = [];
        if (data.goldGained) parts.push(`${data.goldGained} 灵石`);
        if (data.gainedAttr) parts.push(`${data.gainedAttr.attr} +${data.gainedAttr.after - data.gainedAttr.before}`);
        if (data.item) parts.push(`宝物×1`);
        toast.success(`🌀 ${data.message}${parts.length ? "（" + parts.join("、") + "）" : ""}`);
      } else {
        toast(`🌫️ ${data.message}`);
      }
    } catch (e) { toast.error("探索失败，请重试"); }
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
            <CardTitle className="text-foreground flex items-center gap-2"><Mountain className="w-5 h-5 text-primary" /> 秘境钥匙</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-4 h-4" /> 体力</span>
            <span className="text-foreground font-bold">{cultivator.stamina}</span>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {realms.map((r) => {
            const reqOk = true; // 服务端已按 realm 过滤，能列出即可进入
            const cost = 10;
            return (
              <Card key={r.id} className="border-border bg-card shadow-md">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{r.name}</p>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.danger === "高" ? "bg-red-100 text-red-600" : r.danger === "中" ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>凶险 {r.danger}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                  <p className="text-[11px] text-muted-foreground">需 {r.reqRealm} 及以上 · 消耗体力 {cost}</p>
                  <Button size="sm" className="w-full bg-primary hover:bg-[#B33A2A] text-white" disabled={busy !== null || !reqOk || cultivator.stamina < cost} onClick={() => explore(r)}>
                    {busy === r.id ? "探索中..." : "入秘境探索"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {realms.length === 0 && <p className="text-muted-foreground text-xs text-center py-2">修为尚浅，暂无可入的秘境</p>}
        </div>
      </div>
    </main>
  );
}
