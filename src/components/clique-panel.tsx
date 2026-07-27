"use client";

import { Users, MapPin, Check } from "lucide-react";
import { useGameStore } from "@/store";
import type { CultivatorData } from "@/app/dashboard/types";
import { cn } from "@/lib/utils";

export default function CliquePanel() {
  const cultivator = useGameStore((s) => s.cultivator) as CultivatorData | null;
  const location = useGameStore((s) => s.location);
  const unlockedLocations = useGameStore((s) => s.unlockedLocations) as string[];
  const setLocation = useGameStore((s) => s.setLocation);

  const clique = cultivator?.clique ?? null;
  const current = location ?? "洞府";
  const locations = unlockedLocations ?? [];

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm p-3 space-y-3">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-600" />
        势力
      </h3>

      <div className="text-sm">
        <span className="text-muted-foreground">所属势力：</span>
        <span className="text-foreground">{clique ?? "散修（无门无派）"}</span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          可前往地点
        </p>
        {locations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            暂无已解锁的地点
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => {
              const active = loc === current;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setLocation(loc);
                  }}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
                    active
                      ? "bg-[#8C2D19] text-white border-[#8C2D19]"
                      : "bg-card text-foreground border-border hover:border-[#8C2D19]"
                  )}
                >
                  {active && <Check className="w-3 h-3" />}
                  {loc}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
