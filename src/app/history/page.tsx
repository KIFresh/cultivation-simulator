"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";

interface GameEvent {
  id: string;
  type: string;
  title: string;
  narrative: string;
  createdAt: string;
}

const typeLabel = (type: string) => {
  if (type === "BIRTH") return { text: "出生", cls: "border-green-300 text-green-700" };
  if (type === "BREAKTHROUGH") return { text: "突破", cls: "border-red-300 text-red-700" };
  if (type === "ENCOUNTER" || type === "RANDOM_ENCOUNTER")
    return { text: "奇遇", cls: "border-purple-300 text-purple-700" };
  if (type === "ACTION") return { text: "行动", cls: "border-[#B83227]/30 text-[#B83227]" };
  return { text: "修炼", cls: "border-[#EADCD0] text-gray-500" };
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function HistoryPage() {
  const router = useRouter();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchEvents = useCallback(
    async (p: number, append = false) => {
      const id = localStorage.getItem("userId");
      if (!id) {
        router.replace("/");
        return;
      }
      const res = await fetch(`/api/events?page=${p}&limit=20`);
      const data = await res.json();
      setEvents((prev) => (append ? [...prev, ...(data.events || [])] : data.events || []));
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    },
    [router]
  );

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
      <VermilionShell>
        <TopNav />
        <div className="main-container space-y-3 pt-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-[#EADCD0]/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </VermilionShell>
    );
  }

  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <div className="pt-2">
          <h1 className="font-calligraphy text-2xl font-bold text-[#7A1F18] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#D49B4B]" /> 修炼记录
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {total} 条修炼轨迹</p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📜</p>
            <p>修炼之路方才开始……</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-[#EADCD0] ml-3 pl-6 space-y-6">
            {events.map((event) => {
              const isLong = event.narrative.length > 150;
              const isExp = expanded[event.id];
              return (
                <div key={event.id} className="relative">
                  <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-[#B83227] border-2 border-white" />
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${typeLabel(event.type).cls}`}>
                      {typeLabel(event.type).text}
                    </Badge>
                    <span className="text-sm font-medium text-[#2C1E1E]">{event.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmt(event.createdAt)}</span>
                  </div>
                  <p
                    className={`text-sm text-[#5b4a42] leading-relaxed ${!isExp && isLong ? "line-clamp-3" : ""}`}
                  >
                    {event.narrative}
                  </p>
                  {isLong && (
                    <button
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))
                      }
                      className="text-[#B83227] text-xs hover:underline mt-1"
                    >
                      {isExp ? "▲ 收起" : "▼ 展开全文"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full h-11 rounded-2xl border border-[#EADCD0] bg-white text-sm font-medium text-[#7A1F18] hover:border-[#B83227] hover:bg-[#FDF2F0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        )}

        {!hasMore && events.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-2">已加载全部记录</p>
        )}
      </div>
    </VermilionShell>
  );
}
