"use client";

import { useState } from "react";
import { useGameStore } from "@/store";
import { getItemById } from "@/lib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);
  const gold = useGameStore((s) => s.gold);
  const useItem = useGameStore((s) => s.useItem);
  const [showItems, setShowItems] = useState(false);

  if (!showItems) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowItems(true)}>
        🎒 背包 ({inventory.length})
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm flex justify-between">
          <span>🎒 背包 (💰{gold})</span>
          <button
            className="text-muted-foreground hover:underline text-xs"
            onClick={() => setShowItems(false)}
          >
            关闭
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 max-h-48 overflow-y-auto space-y-1">
        {inventory.length === 0 && <p className="text-xs text-muted-foreground">背包空空</p>}
        {inventory.map((item: any, i: number) => {
          const def = getItemById(item.itemId);
          const name = item.name || def?.name || item.itemId;
          const icon = item.icon || def?.icon || "📦";
          return (
            <div
              key={i}
              className="flex justify-between items-center text-sm py-1 border-b last:border-0"
            >
              <span>
                {icon} {name} ×{item.quantity}
              </span>
              <Button variant="ghost" size="sm" onClick={() => useItem(item.itemId)}>
                使用
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
