"use client";

import { Sparkles } from "lucide-react";
import { useGameStore } from "@/store";
import type { CultivatorData } from "@/app/dashboard/types";
import { isAwakened } from "@/lib/cultivation-data";
import { deriveSkillLevels, type SkillLevel } from "@/app/dashboard/hooks/use-data-sync";

export default function SkillsPanel() {
  const cultivator = useGameStore((s) => s.cultivator) as CultivatorData | null;

  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;

  const skills: SkillLevel[] = deriveSkillLevels(
    cultivator?.attributeExp ?? null,
    cultivator?.subjectExp ?? null,
    isAwake
  );

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm p-3 space-y-3">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        技艺
      </h3>
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">尚未习得任何技艺</p>
      ) : (
        <div className="space-y-2">
          {skills.map((sk) => {
            const percent = sk.expToNext > 0 ? Math.min(100, (sk.exp / sk.expToNext) * 100) : 0;
            return (
              <div key={sk.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground">{sk.name}</span>
                  <span className="text-muted-foreground">
                    Lv.{sk.level} · {sk.exp}/{sk.expToNext}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
