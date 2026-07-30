"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const inventory = useGameStore((s) => s.inventory);
  const useItem = useGameStore((s) => s.useItem);
  const actionLoading = useGameStore((s) => s.actionLoading);
  const [usingId, setUsingId] = useState<string | null>(null);

  const { equipped, usable, other } = useMemo(() => categorizeItems(inventory), [inventory]);

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
    showUseButton: boolean
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
            <span className="text-xs text-[#8B7355] ml-2">×{item.inv.quantity}</span>
          </p>
          {desc && <p className="text-xs text-[#8B7355] mt-0.5">{desc}</p>}
          {effect && <p className="text-xs text-[#D49B4B] mt-0.5">✨ {effect}</p>}
        </div>
        {showUseButton && def?.useEffect ? (
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="default"
              disabled={actionLoading || usingId === item.inv.itemId}
              onClick={() => handleUse(item.inv.itemId)}
              className="h-7 text-xs"
            >
              {usingId === item.inv.itemId ? "使用中..." : useLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 text-xs p-0"
              onClick={() => setOpenItemId(item.inv.itemId)}
              title="详情"
            >
              ℹ
            </Button>
          </div>
        ) : (
          <div className="shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 text-xs p-0"
              onClick={() => setOpenItemId(item.inv.itemId)}
              title="详情"
            >
              ℹ
            </Button>
          </div>
        )}
      </div>
    );
  };

  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (inventory.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAF7F3]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>🎒 背包物品</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">尚无随身物品</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F3]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-sm text-[#8B7355] hover:text-[#2C1E1E] transition-colors"
          aria-label="返回仪表盘"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        {/* 页面标题 */}
        <div>
          <h1 className="text-xl font-bold text-[#2C1E1E]">🎒 背包物品</h1>
          <p className="text-xs text-[#8B7355] mt-1">随身携带的各类物品，可在修炼中发挥作用</p>
        </div>

        {/* 装备中 */}
        {equipped.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B83227]" />
              装备中
            </h2>
            <div className="space-y-2">{equipped.map((item) => renderItem(item, false))}</div>
          </section>
        )}

        {/* 可使用 */}
        {usable.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
              可使用
            </h2>
            <div className="space-y-2">{usable.map((item) => renderItem(item, true))}</div>
          </section>
        )}

        {/* 材料/其他 */}
        {other.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              材料/其他
            </h2>
            <div className="space-y-2">{other.map((item) => renderItem(item, false))}</div>
          </section>
        )}

        {openItemId &&
          (() => {
            const def = getItemById(openItemId);
            const inv = inventory.find((i) => i.itemId === openItemId);
            if (!def) return null;
            return (
              <div className="border border-[#EADCD0] bg-white rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#2C1E1E]">{def.name}</p>
                    <p className="text-xs text-[#8B7355]">×{inv?.quantity ?? 0}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setOpenItemId(null)}
                  >
                    关闭
                  </Button>
                </div>
                {def.description && (
                  <p className="text-xs text-[#8B7355] mt-2">{def.description}</p>
                )}
                {def.effect && <p className="text-xs text-[#D49B4B] mt-1">✨ {def.effect}</p>}
                {def.useLabel && (
                  <p className="text-xs text-[#8B7355] mt-2">使用方式：{def.useLabel}</p>
                )}
              </div>
            );
          })()}
      </div>
    </main>
  );
}
