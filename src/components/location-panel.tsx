"use client";

import { useGameStore } from "@/store";
import { Button } from "@/components/ui/button";

const LOCATION_NAMES: Record<string, string> = {
  home: '🏠 家', kindergarten: '🧸 幼儿园', school: '🏫 学校',
  park: '🌳 公园', library: '📚 图书馆', clinic: '🏥 诊所',
  store_snack: '🏪 小卖部', store_furniture: '🪑 家具店', mall: '🏬 大商场',
  downtown: '🏙️ 市区', wild: '🌲 野外', cave: '🏔️ 洞府', market: '🏪 坊市',
};

export default function LocationPanel() {
  const location = useGameStore(s => s.location) ?? "";
  const unlockedLocations = useGameStore(s => s.unlockedLocations) ?? [];
  const setLocation = useGameStore(s => s.setLocation);

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">📍 当前位置: {LOCATION_NAMES[location] || location}</p>
      <div className="flex flex-wrap gap-1">
        {unlockedLocations.filter(l => l !== location).map(loc => (
          <Button key={loc} variant="outline" size="sm" onClick={() => setLocation(loc)}>
            {LOCATION_NAMES[loc] || loc}
          </Button>
        ))}
      </div>
    </div>
  );
}