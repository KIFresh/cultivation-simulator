"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import BottomNav from "@/components/bottom-nav";

interface GameEvent {
  id: string;
  type: string;
  title: string;
  narrative: string;
  createdAt: string;
}

const typeLabel = (type: string) => {
  if (type === "BREAKTHROUGH")     return { text: "突破", cls: "border-red-700 text-red-400" };
  if (type === "ENCOUNTER")        return { text: "奇遇", cls: "border-purple-700 text-purple-400" };
  if (type === "RANDOM_ENCOUNTER") return { text: "奇遇", cls: "border-purple-700 text-purple-400" };
  return { text: "修炼", cls: "border-white/20 text-stone-400" };
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function HistoryPage() {
  const router = useRouter();
  const [events, setEvents]     = useState<GameEvent[]>([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchEvents = useCallback(async (p: number, append = false) => {
    const id = localStorage.getItem("userId");
    if (!id) { router.replace("/"); return; }

    const res  = await fetch(`/api/events?userId=${id}&page=${p}&limit=20`);
    const data = await res.json();

    setEvents(prev => append ? [...prev, ...(data.events || [])] : (data.events || []));
    setHasMore(data.hasMore || false);
    setTotal(data.total || 0);
  }, [router]);

  useEffect(() => {
    fetchEvents(1).finally(() => setLoading(false));
  }, [fetchEvents]);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    await fetchEvents(next, true);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-stone-800 rounded-xl" />)}
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-amber-400">修炼记录</h1>
        <p className="text-sm text-stone-400 mt-0.5">共 {total} 条修炼轨迹</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-4xl mb-3">📜</p>
          <p>修炼之路方才开始……</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const { text, cls } = typeLabel(event.type);
            return (
              <div key={event.id} className="bg-stone-800 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${cls}`}>{text}</Badge>
                    <span className="text-sm font-medium text-white">{event.title}</span>
                  </div>
                  <span className="text-xs text-stone-500 shrink-0 ml-2">{fmt(event.createdAt)}</span>
                </div>
                <p className="text-sm text-stone-300 leading-relaxed line-clamp-3">{event.narrative}</p>
              </div>
            );
          })}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full border-white/10 text-stone-300 hover:text-white h-11"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loadingMore ? "加载中…" : "加载更多"}
            </Button>
          )}

          {!hasMore && events.length > 0 && (
            <p className="text-center text-xs text-stone-600 py-2">已加载全部记录</p>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
