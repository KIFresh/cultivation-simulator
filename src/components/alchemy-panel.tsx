"use client";

import { FlaskConical, Plus } from "lucide-react";
import { useGameStore } from "@/store";
import type { InventoryItem } from "@/lib";
import { getAllFormulas, getFormulaById } from "@/lib/alchemy-data";
import { toast } from "sonner";

export default function AlchemyPanel() {
  const inventory = useGameStore((s) => s.inventory) as InventoryItem[];
  const useItem = useGameStore((s) => s.useItem);
  const actionLoading = useGameStore((s) => s.actionLoading);

  const formulas = getAllFormulas();

  const handleUse = async (itemId: string) => {
    try {
      await useItem(itemId);
      toast.success("已服用");
    } catch {
      toast.error("服用失败");
    }
  };

  const ownedItems = (inventory ?? []).filter((i) => (i.quantity ?? 0) > 0);

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm p-3 space-y-3">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-purple-600" />
        丹房
      </h3>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">随身丹药</p>
        {ownedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">尚未持有任何丹药</p>
        ) : (
          ownedItems.map((item) => {
            const formula = getFormulaById(item.itemId);
            const name = formula?.productName ?? item.itemId;
            return (
              <div
                key={item.itemId}
                className="flex items-center justify-between border border-border rounded-lg p-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">数量 ×{item.quantity ?? 0}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleUse(item.itemId);
                  }}
                  disabled={actionLoading}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#8C2D19] text-white hover:bg-[#6f2314] disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  服用
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">已知丹方</p>
        {formulas.slice(0, 4).map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span>{f.productName}</span>
            <span>
              难度 {f.difficultyLevel} · 成率 {f.baseSuccessRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
