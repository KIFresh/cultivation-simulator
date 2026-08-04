"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MemoryEntryView {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

/**
 * 道心明镜 — 只读查看最近 5 条压缩记忆（summary）。
 * 编辑/标记重要在 /memory 记忆页面完成，本组件仅展示 AI 真正读到的记忆。
 */
export default function MemoryPanel({ cultivatorId }: { cultivatorId: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [entries, setEntries] = useState<MemoryEntryView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/memory?limit=5`, {
          headers: { "x-user-id": cultivatorId },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEntries((data.entries || []).slice(0, 5));
      } catch {
        // 记忆加载失败不阻塞主界面
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cultivatorId]);

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        <span>📖 道心明镜</span>
        <span>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          <div className="space-y-1 max-h-[10rem] overflow-y-auto">
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">加载中…</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">暂无记忆</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="text-xs py-1 border-b border-[var(--border)] last:border-0">
                  <span className="text-[var(--foreground)] font-medium">
                    {entry.important ? "⭐ " : ""}
                    {entry.title}
                  </span>
                  {entry.summary && <span className="text-[var(--muted-foreground)] ml-2 truncate">{entry.summary}</span>}
                </div>
              ))
            )}
          </div>

          {!loading && entries.length > 0 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-[var(--border)]">
              <span>共 {entries.length} 条</span>
              <Link
                href="/memory"
                className="inline-flex h-7 items-center justify-center rounded-md border border-input bg-background px-3 text-xs hover:bg-accent hover:text-accent-foreground"
              >
                查看全部记忆 →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
