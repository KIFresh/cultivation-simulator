"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, AlertTriangle } from "lucide-react";
import { getItemById } from "@/lib";
import { toast } from "sonner";

import TopNav from "@/components/top-nav";

interface ShopItemData {
  itemId: string;
  price: number;
  category: string;
  minRealm?: string;
  locked?: boolean;
  lockReason?: string;
  item: { id: string; name: string; icon: string; description: string; effect?: string };
}

export default function ShopPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopItemData[]>([]);
  const [gold, setGold] = useState(0);
  const [realm, setRealm] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/");
      return;
    }
    fetch(`/api/cultivator?userId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d.user?.cultivator;
        setGold(c?.gold ?? 0);
        setRealm(c?.realm || "");
        setLocation(c?.location || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!realm) return;
    const params = new URLSearchParams();
    params.set("realm", realm);
    if (location) params.set("location", location);
    fetch(`/api/shop?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, [realm, location]);

  const buy = async (itemId: string) => {
    const res = await fetch("/api/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 服务端通过 requireCultivator 从 cookie/session 鉴权，不再传 userId
      body: JSON.stringify({ itemId, quantity: 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "购买失败");
      return;
    }
    setGold(data.cultivator.gold);
    if (data.cultivator.inventory) {
      try {
        localStorage.setItem("inventory", data.cultivator.inventory);
      } catch {}
    }
    toast.success(`购入成功！金币 -${data.totalCost}`);
  };

  const isMarket = location === "market";
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <main className="min-h-screen bg-[#FAF4EB]">
      <TopNav />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-amber-700"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#2C1E1E]">{isMarket ? "坊市" : "商店"}</h1>
              <p className="text-xs text-gray-400">{isMarket ? "风险与机遇并存" : "按需选购"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-700">{gold}</span>
          </div>
        </div>

        {isMarket && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>坊市可越境购买高阶商品，但携带高价物品在野外可能被劫</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400">加载中…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400">暂无商品</p>
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
                {cat}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items
                  .filter((i) => i.category === cat)
                  .map((s) => {
                    const isLocked = s.locked && !isMarket;
                    return (
                      <Card
                        key={s.itemId}
                        className={`overflow-hidden rounded-2xl border ${isLocked ? "border-gray-200 opacity-55" : "border-[#EADCD0]"} bg-white shadow-sm`}
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF4EB] text-lg">
                              {s.item.icon || "📦"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{s.item.name}</p>
                              <p className="text-xs text-muted-foreground">{s.item.description}</p>
                              {s.item.effect && (
                                <p className="text-[10px] text-amber-600">{s.item.effect}</p>
                              )}
                              {isLocked && s.lockReason && (
                                <p className="text-[10px] font-medium text-red-500">
                                  {s.lockReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{s.price}💰</p>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary hover:bg-[#B33A2A] text-white mt-1"
                              disabled={isLocked || gold < s.price}
                              onClick={() => buy(s.itemId)}
                            >
                              {isLocked ? "锁定" : "购买"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
