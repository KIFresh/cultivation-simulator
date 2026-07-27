"use client";

import { useState, useMemo } from "react";
import { getEquippedItems, getBackpackItems, getItemById } from "@/lib";
import type { InventoryItem } from "@/lib";

interface InventoryPanelProps {
  inventory: InventoryItem[];
  onUseItem: (itemId: string) => void;
}

interface ItemTooltipState {
  item: any;
  anchor: "eq" | "bp";
  x: number;
  y: number;
}

export function InventoryPanel({ inventory, onUseItem }: InventoryPanelProps) {
  const [tooltip, setTooltip] = useState<ItemTooltipState | null>(null);
  const items = useMemo(() => {
    const equipped: { inv: InventoryItem; item: any }[] = [];
    const backpack: { inv: InventoryItem; item: any }[] = [];
    getEquippedItems(inventory).forEach((inv) => {
      const item = getItemById(inv.itemId);
      if (item) equipped.push({ inv, item });
    });
    getBackpackItems(inventory).forEach((inv) => {
      const item = getItemById(inv.itemId);
      if (item) backpack.push({ inv, item });
    });
    return { equipped, backpack };
  }, [inventory]);

  return (
    <div className="mt-3 p-3 text-[11px] text-gray-400 bg-[#FAF4EB] rounded-xl border border-[#EADCD0] flex flex-wrap gap-1">
      {items.equipped.length === 0 && items.backpack.length === 0 && (
        <span className="text-gray-400">袖里乾坤空空如也，尚无灵材入账。</span>
      )}
      {items.equipped.map(({ inv, item }) => (
        <span
          key={`eq-${inv.itemId}`}
          className="inline-flex items-center gap-1 text-[10px] bg-[#F0E8D8] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#D8C8B0] m-0.5 cursor-help"
          onMouseEnter={(e) =>
            setTooltip({
              item,
              anchor: "eq",
              x: e.clientX,
              y: e.clientY,
            })
          }
          onMouseMove={(e) =>
            setTooltip((prev) =>
              prev && prev.anchor === "eq"
                ? { item, anchor: "eq", x: e.clientX, y: e.clientY }
                : prev,
            )
          }
          onMouseLeave={() => setTooltip(null)}
        >
          {item.icon}
          {item.name}
        </span>
      ))}
      {items.backpack.map(({ inv, item }) => (
        <span
          key={`bp-${inv.itemId}`}
          className="inline-flex items-center gap-1 text-[10px] bg-[#FAF4EB] text-gray-500 px-1.5 py-0.5 rounded m-0.5 cursor-help"
          onMouseEnter={(e) =>
            setTooltip({
              item,
              anchor: "bp",
              x: e.clientX,
              y: e.clientY,
            })
          }
          onMouseMove={(e) =>
            setTooltip((prev) =>
              prev && prev.anchor === "bp"
                ? { item, anchor: "bp", x: e.clientX, y: e.clientY }
                : prev,
            )
          }
          onMouseLeave={() => setTooltip(null)}
        >
          {item.icon}
          {item.name}
          {inv.quantity > 1 ? `×${inv.quantity}` : ""}
        </span>
      ))}
      {tooltip && (
        <div
          className="fixed z-50 rounded-md border border-[#EADCD0] bg-white px-3 py-2 text-xs text-[#2C1E1E] shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-medium">
            {tooltip.item.icon} {tooltip.item.name}
          </p>
          <p className="text-gray-400 mt-0.5">{tooltip.item.description}</p>
          {tooltip.item.effect && (
            <p className="text-[#D49B4B] mt-0.5">✨ {tooltip.item.effect}</p>
          )}
          {(tooltip.item as any).useEffect && (
            <button
              onClick={() => {
                const itemId = tooltip.item.id;
                setTooltip(null);
                onUseItem(itemId);
              }}
              className="mt-1 w-full text-xs bg-[#B83227] text-white rounded px-2 py-0.5 hover:bg-[#7A1F18]"
            >
              {(tooltip.item as any).useLabel || "使用"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
