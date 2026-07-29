"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/store";
import { getItemById } from "@/lib/cultivation-data";
import type { InventoryItem } from "@/lib/cultivation-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function categorizeItems(inventory: InventoryItem[]) {
  const equipped: { inv: InventoryItem; def: ReturnType<typeof getItemById> }[] = [];
  const usable: { inv: InventoryItem; def: ReturnType<typeof getItemById> }[] = [];
  const other: { inv: InventoryItem; def: ReturnType<typeof getItemById> }[] = [];

  for (const inv of inventory) {
    const def = getItemById(inv.itemId);
    if (inv.equipped) {
      equipped.push({ inv, def });
    } else if (def?.useEffect) {
      usable.push({ inv, def });
    } else {
      other.push({ inv, def });
    }
  }
  return { equipped, usable, other };
}

export default function ItemsPage() {
  const inventory = useGameStore((s) => s.inventory);
  const useItem = useGameStore((s) => s.useItem);
  const actionLoading = useGameStore((s) => s.actionLoading);
  const [usingId, setUsingId] = useState<string | null>(null);

  const { equipped, usable, other } = useMemo(
    () => categorizeItems(inventory),
    [inventory],
  );

  const handleUse = async (itemId: string) => {
    setUsingId(itemId);
    try {
      await useItem(itemId);
      toast.success("使用成功");
    } catch {
      toast.error("使用失败");
    } finally {
      setUsingId(null);
    }
  };

  const renderItem = (
    item: { inv: InventoryItem; def: ReturnType<typeof getItemById> },
    showUseButton: boolean,
  ) => {
    const def = item.def;
    const name = def?.name || item.inv.itemId;
    const icon = def?.icon || "📦";
    const desc = def?.description || "";
    const effect = def?.effect || "";
    const useLabel = def?.useLabel || "使用";

    return (
      <div
        key={item.inv.itemId}
        className="flex items-start gap-3 border border-[#EADCD0] bg-white rounded-lg p-3"
      >
        <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#2C1E1E]">
            {name}
            <span className="text-xs text-[#8B7355] ml-2">
              ×{item.inv.quantity}
            </span>
          </p>
          {desc && (
            <p className="text-xs text-[#8B7355] mt-0.5">{desc}</p>
          )}
          {effect && (
            <p className="text-xs text-[#D49B4B] mt-0.5">✨ {effect}</p>
          )}
        </div>
        {showUseButton && def?.useEffect && (
          <Button
            size="sm"
            variant="default"
            disabled={actionLoading || usingId === item.inv.itemId}
            onClick={() => handleUse(item.inv.itemId)}
            className="shrink-0 h-7 text-xs"
          >
            {usingId === item.inv.itemId ? "使用中..." : useLabel}
          </Button>
        )}
      </div>
    );
  };

  if (inventory.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAF7F3]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>🎒 背包物品</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                尚无随身物品
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F3]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-xl font-bold text-[#2C1E1E]">🎒 背包物品</h1>
          <p className="text-xs text-[#8B7355] mt-1">
            随身携带的各类物品，可在修炼中发挥作用
          </p>
        </div>

        {/* 装备中 */}
        {equipped.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B83227]" />
              装备中
            </h2>
            <div className="space-y-2">
              {equipped.map((item) => renderItem(item, false))}
            </div>
          </section>
        )}

        {/* 可使用 */}
        {usable.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
              可使用
            </h2>
            <div className="space-y-2">
              {usable.map((item) => renderItem(item, true))}
            </div>
          </section>
        )}

        {/* 材料/其他 */}
        {other.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              材料/其他
            </h2>
            <div className="space-y-2">
              {other.map((item) => renderItem(item, false))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}