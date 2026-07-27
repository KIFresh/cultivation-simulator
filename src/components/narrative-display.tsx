"use client";

import { useState } from "react";
import { useGameStore } from "@/store";
import { Card, CardContent } from "@/components/ui/card";

export default function NarrativeDisplay() {
  const narrative = useGameStore(s => s.narrative);
  const streamingText = useGameStore(s => s.streamingText);
  const narrativeError = useGameStore(s => s.narrativeError);
  const narrativeRetrying = useGameStore(s => s.narrativeRetrying);
  const retryNarrative = useGameStore(s => s.retryNarrative);
  const [expanded, setExpanded] = useState(false);

  // 错误态：保留已流式文本（冻结）+ 报错卡 + 重试（RISK-2：不丢弃 streamingText）
  if (narrativeError) {
    const frozen = streamingText;
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          {frozen ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {frozen}
              <span className="animate-pulse">▍</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h3 className="font-bold text-lg text-red-500">叙事生成失败</h3>
          </div>
          <p className="text-sm text-muted-foreground">{narrativeError.message}</p>
          <button
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={() => retryNarrative()}
            disabled={narrativeRetrying}
          >
            {narrativeRetrying ? "重试中…" : "🔄 重试生成叙事"}
          </button>
        </CardContent>
      </Card>
    );
  }

  // streamingText !== null 即处于流式态（含空串），行尾光标脉冲；否则展示已落定叙事
  const isStreaming = streamingText !== null;
  const displayText = isStreaming ? (streamingText || "生成中…") : (narrative?.narrative || "");
  const preview = displayText.slice(0, 150);

  if (!displayText && !isStreaming) return null;

  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        {narrative?.title && (
          <h3 className="font-bold text-lg">{narrative.title}</h3>
        )}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {isStreaming ? (
            <>
              <span>{displayText}</span>
              <span className="animate-pulse">▍</span>
            </>
          ) : expanded ? (
            displayText
          ) : (
            <>
              {preview}
              {displayText.length > 150 && (
                <button
                  className="text-primary ml-1 hover:underline"
                  onClick={() => setExpanded(true)}
                >
                  ...展开全部
                </button>
              )}
            </>
          )}
        </div>
        {narrative?.mood && (
          <p className="text-xs text-muted-foreground mt-1">心境: {narrative.mood}</p>
        )}
      </CardContent>
    </Card>
  );
}
