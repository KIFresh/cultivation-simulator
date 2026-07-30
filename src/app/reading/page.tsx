"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowLeft, Zap } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";
import { ATTR_INFO } from "@/lib";

interface Book {
  id: string;
  title: string;
  author: string;
  attr: string;
  gain: number;
  staminaCost: number;
  desc: string;
}
interface ReadingEntry {
  bookId: string;
  title: string;
  finishedAt: string;
}
interface Cultivator {
  id: string;
  name: string;
  stamina: number;
}

const ATTR_LABEL: Record<string, string> = Object.fromEntries(
  ATTR_INFO.map((a) => [a.key, `${a.icon}${a.label}`])
);

export default function ReadingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [log, setLog] = useState<ReadingEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/reading`),
      ]);
      const cData = await cRes.json();
      const rData = await rRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, stamina: c.stamina ?? 0 });
      }
      if (rData.availableBooks) setBooks(rData.availableBooks);
      if (rData.readingLog) setLog(rData.readingLog);
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/");
      return;
    }
    setUserId(id);
    load(id);
  }, [router, load]);

  const read = async (book: Book) => {
    if (!userId || busy) return;
    if ((cultivator?.stamina ?? 0) < book.staminaCost) {
      toast.error("体力不足，无法研读");
      return;
    }
    setBusy(book.id);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "研读失败");
        return;
      }
      setCultivator((c) => (c ? { ...c, stamina: data.stamina } : c));
      setLog(data.readingLog);
      const g = data.gain;
      toast.success(`📖 ${book.title}：${ATTR_LABEL[g.attr] ?? g.attr} +${g.after - g.before}`);
    } catch (e) {
      toast.error("研读失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    );
  if (!cultivator)
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground mb-4">尚未创建修炼者</p>
        <Button onClick={() => router.push("/create")}>创建角色</Button>
      </main>
    );

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button
          onClick={() => router.push("/life")}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 返回生活
        </button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> 课外阅读
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Zap className="w-4 h-4" /> 体力
            </span>
            <span className="text-foreground font-bold">{cultivator.stamina}</span>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {books.map((b) => (
            <Card key={b.id} className="border-border bg-card shadow-md">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.author} · {b.desc}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    体力 {b.staminaCost} · {ATTR_LABEL[b.attr] ?? b.attr} +{b.gain}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-[#B33A2A] text-white shrink-0"
                  disabled={busy !== null || cultivator.stamina < b.staminaCost}
                  onClick={() => read(b)}
                >
                  {busy === b.id ? "..." : "研读"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {log.length > 0 && (
          <Card className="border-border bg-card shadow-md">
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs">已读 {log.length} 本</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-40 overflow-y-auto">
              {log
                .slice()
                .reverse()
                .map((e, i) => (
                  <p
                    key={i}
                    className="text-xs text-foreground border-b border-muted pb-1 last:border-0"
                  >
                    {e.title}
                  </p>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
