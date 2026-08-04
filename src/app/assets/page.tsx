"use client";

import { useEffect, useState } from "react";
import { Coins, Gem } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";

interface AssetData {
  gold?: number;
  inventory?: unknown[] | string | null;
  spiritStone?: number;
}

function parseInventory(inv: unknown[] | string | null): { name: string }[] {
  let arr: unknown[] = [];
  if (Array.isArray(inv)) arr = inv;
  else if (typeof inv === "string") {
    try {
      arr = JSON.parse(inv || "[]");
    } catch {
      arr = [];
    }
  }
  return arr.map((it, i) => {
    if (typeof it === "string") return { name: it };
    if (it && typeof it === "object" && "name" in (it as Record<string, unknown>)) {
      return { name: String((it as Record<string, unknown>).name) };
    }
    return { name: `遗物${i + 1}` };
  });
}

export default function AssetsPage() {
  const [data, setData] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = typeof window !== "undefined" ? window.localStorage.getItem("userId") : null;
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/cultivator?userId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const c = d?.user?.cultivator ?? d?.cultivator ?? null;
        if (c)
          setData({ gold: c.gold ?? 0, inventory: c.inventory, spiritStone: c.spiritStone ?? 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = data ? parseInventory(data.inventory ?? null) : [];

  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <div className="pt-2">
          <h1 className="font-calligraphy text-2xl font-bold text-[var(--primary)]">修仙资产</h1>
          <p className="text-sm text-gray-500 mt-0.5">储物囊与灵石积蓄</p>
        </div>

        {loading ? (
          <div className="silk-card rounded-3xl p-8 text-center text-gray-400 text-sm">加载中…</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="silk-card rounded-2xl p-5 text-center">
                <span className="text-xs text-gray-500 block mb-1">世俗金钱</span>
                <span className="font-mono font-bold text-2xl text-[var(--primary)]">
                  {data.gold ?? 0}
                </span>
                <span className="text-[10px] text-amber-900/60 block mt-1">文钱</span>
              </div>
              <div className="silk-card rounded-2xl p-5 text-center">
                <span className="text-xs text-gray-500 block mb-1">下品灵石</span>
                <span className="font-mono font-bold text-2xl text-emerald-700">
                  {data.spiritStone ?? 0}
                </span>
                <span className="text-[10px] text-emerald-800/60 block mt-1">块</span>
              </div>
            </div>

            <div className="silk-card rounded-3xl p-6">
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 pb-3 mb-3 border-b border-[var(--border)]">
                <Coins className="w-4 h-4 text-[var(--ring)]" /> 背包遗藏
                <span className="text-xs font-normal text-gray-400 ml-auto">
                  储物囊 {items.length} 件
                </span>
              </h3>
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-3 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
                  袖里乾坤空空如也，尚无灵材入账。
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((it, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--muted)] text-[var(--ring)] flex items-center justify-center">
                        <Gem className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-[var(--foreground)]">{it.name}</h5>
                        <p className="text-[10px] text-gray-400">随身之物</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="silk-card rounded-3xl p-8 text-center text-gray-400 text-sm">
            暂无资产数据，请先创建修炼者。
          </div>
        )}
      </div>
    </VermilionShell>
  );
}
