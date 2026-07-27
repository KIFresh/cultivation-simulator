"use client";

import { useState } from "react";
import { useGameStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";
import { isAwakened } from "@/lib";

export default function ActionPanel() {
  const availableActions = useGameStore(s => s.availableActions);
  const actionLoading = useGameStore(s => s.actionLoading);
  const canBreakthrough = useGameStore(s => s.canBreakthrough);
  const performAction = useGameStore(s => s.performAction);
  const breakthrough = useGameStore(s => s.breakthrough);
  const advanceQuarter = useGameStore(s => s.advanceQuarter);
  const realm = useGameStore(s => s.cultivator?.realm);
  const [protector, setProtector] = useState<string>("");

  // 未觉醒（凡人）前，屏蔽一切与修炼相关的按钮（功法/打坐/吐纳/炼丹/闭关）
  const isAwake = realm ? isAwakened(realm) : false;
  const visibleActions = availableActions.filter((a: any) => isAwake || a.category !== "cultivate");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action: any) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            onClick={() => performAction(action.id)}
            disabled={actionLoading}
          >
            {action.icon || <Sparkles className="w-4 h-4 mr-1" />}
            {action.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {canBreakthrough && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={protector}
              onChange={(e) => setProtector(e.target.value)}
              title="渡劫护道：仅大境界跨越时生效并扣费，降低突破失败率与心魔"
              className="rounded border border-[#234155] bg-[#0f1c26] px-2 py-1 text-xs text-[#cfe3ee]"
            >
              <option value="">无护道</option>
              <option value="sanxiu">散修护道（80中品 · 失败−15%/心魔−30%）</option>
              <option value="zhanglao">长老护道（400中品 · 失败−35%/心魔−60%）</option>
              <option value="duijie">渡劫护道（30上品 · 失败−60%/心魔−90%）</option>
            </select>
            <Button onClick={() => breakthrough(protector || undefined)} disabled={actionLoading}>
              <Zap className="w-4 h-4 mr-1" /> 突破
            </Button>
          </div>
        )}
        <Button variant="secondary" onClick={advanceQuarter} disabled={actionLoading}>
          ⏭ 推进一季
        </Button>
      </div>
    </div>
  );
}