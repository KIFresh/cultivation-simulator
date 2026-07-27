"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins } from "lucide-react";
import { getItemById } from "@/lib";
import { toast } from "sonner";

interface ShopItemData { itemId: string; price: number; category: string; item: { id: string; name: string; icon: string; description: string; effect?: string } }

export default function ShopPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopItemData[]>([]);
  const [gold, setGold] = useState(0);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    fetch(`/api/cultivator?userId=${id}`).then((r) => r.json()).then((d) => { setGold(d.user?.cultivator?.gold ?? 50); }).catch(() => {});
    fetch("/api/shop").then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => {});
  }, [router]);

  const buy = async (itemId: string) => {
    if (!userId) return;
    const res = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, itemId, quantity: 1 }) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "购买失败"); return; }
    setGold(data.cultivator.gold);
    // 同步背包到 localStorage（后端已持久化，前端同步以便 dashboard 使用）
    if (data.cultivator.inventory) {
      try { localStorage.setItem("inventory", data.cultivator.inventory); } catch {}
    }
    toast.success(`购入成功！金币 -${data.totalCost}`);
  };

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <main className="flex-1 min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"><ArrowLeft className="w-4 h-4" /> 返回</button>
          <div className="flex items-center gap-1 text-sm"><Coins className="w-4 h-4 text-yellow-600" /><span className="font-bold text-foreground">{gold}</span></div>
        </div>
        <h1 className="text-xl font-bold text-foreground">坊市</h1>

        {categories.map((cat) => (
          <div key={cat}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">{cat}</h2>
            <div className="space-y-2">
              {items.filter((i) => i.category === cat).map((s) => (
                <Card key={s.itemId} className="border-border bg-card shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-xl">{s.item.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{s.item.name}</p>
                      <p className="text-xs text-muted-foreground">{s.item.description}</p>
                      {s.item.effect && <p className="text-[10px] text-amber-600">{s.item.effect}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{s.price}💰</p>
                      <Button size="sm" className="h-7 text-xs bg-primary hover:bg-[#B33A2A] text-white mt-1" disabled={gold < s.price} onClick={() => buy(s.itemId)}>购买</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}