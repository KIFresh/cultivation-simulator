"use client";

import { Coins, MapPin, Flame, Heart, Brain, ArrowUpCircle } from "lucide-react";
import { useGameStore } from "@/store";
import type { CultivatorData } from "@/app/dashboard/types";
import { cn } from "@/lib/utils";

export default function StatusBar() {
  const cultivator = useGameStore((s) => s.cultivator) as CultivatorData | null;
  const gold = useGameStore((s) => s.gold);
  const location = useGameStore((s) => s.location);
  const canBreakthrough = useGameStore((s) => s.canBreakthrough);
  const breakthrough = useGameStore((s) => s.breakthrough);
  const actionLoading = useGameStore((s) => s.actionLoading);

  const realm = cultivator?.realm ?? "凡人";
  const realmLevel = cultivator?.realmLevel ?? 0;
  const exp = cultivator?.cultivationExp ?? 0;
  const totalExp = cultivator?.totalExp ?? 0;
  const health = cultivator?.health ?? 0;
  const mindDemon = cultivator?.mindDemon ?? 0;
  const age = cultivator?.age ?? 0;
  const maxAge = cultivator?.maxAge ?? null;

  const expLabel = totalExp > 0 ? `${exp} / ${totalExp}` : `${exp}`;
  const expPercent = totalExp > 0 ? Math.min(100, (exp / totalExp) * 100) : 0;

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{realm}</span>
          <span className="text-xs text-muted-foreground">Lv.{realmLevel}</span>
        </div>
        {canBreakthrough && (
          <button
            type="button"
            onClick={() => {
              void breakthrough();
            }}
            disabled={actionLoading}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-md",
              "bg-[#8C2D19] text-white hover:bg-[#6f2314] disabled:opacity-50"
            )}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            突破
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            修为
          </span>
          <span>{expLabel}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${expPercent}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Coins className="w-3.5 h-3.5 text-yellow-600" />
          {gold}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          {location ?? "未知"}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          气血 {health}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Brain className="w-3.5 h-3.5 text-violet-500" />
          心魔 {mindDemon}
        </span>
        <span className="text-muted-foreground">
          寿元 {age}
          {maxAge ? `/${maxAge}` : ""}
        </span>
      </div>
    </div>
  );
}
