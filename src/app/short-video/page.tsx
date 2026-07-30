"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Video, ArrowLeft, Coins } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface VideoEntry { id: string; title: string; narrative: string; createdAt: string; }
interface Cultivator { id: string; name: string; gold: number; }

export default function ShortVideoPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, vRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/short-video`),
      ]);
      const cData = await cRes.json();
      const vData = await vRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, gold: c.gold ?? 0 });
      }
      if (vData.videos) setVideos(vData.videos);
    } catch { /* 忽略 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
    load(id);
  }, [router, load]);

  const publish = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/short-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "发布失败"); return; }
      setCultivator((c) => (c ? { ...c, gold: data.gold } : c));
      if (data.video) setVideos((prev) => [{ id: data.video.id, title: data.video.title, narrative: data.video.narrative, createdAt: new Date().toISOString().toString() }, ...prev]);
      setTitle("");
      toast.success(`📱 发布成功，收获 ${data.video?.goldGained ?? 0} 灵石打赏`);
    } catch (e) { toast.error("发布失败，请重试"); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="flex-1 flex items-center justify-center min-h-screen"><p className="text-muted-foreground">加载中...</p></main>;
  if (!cultivator) return <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-4"><p className="text-muted-foreground mb-4">尚未创建修炼者</p><Button onClick={() => router.push("/create")}>创建角色</Button></main>;

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button onClick={() => router.push("/life")} className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"><ArrowLeft className="w-4 h-4" /> 返回生活</button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2"><Video className="w-5 h-5 text-primary" /> 短视频奇遇</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-4 h-4" /> 灵石</span>
              <span className="text-foreground font-bold">{cultivator.gold}</span>
            </div>
            <Input placeholder="给短片起个标题（可留空）" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white border-border text-foreground" />
            <Button className="w-full bg-primary hover:bg-[#B33A2A] text-white" disabled={busy} onClick={publish}>{busy ? "发布中..." : "发布短视频"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {videos.map((v) => (
            <Card key={v.id} className="border-border bg-card shadow-md">
              <CardContent className="p-3 space-y-1">
                <p className="font-semibold text-foreground text-sm">{v.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{v.narrative}</p>
              </CardContent>
            </Card>
          ))}
          {videos.length === 0 && <p className="text-muted-foreground text-xs text-center py-2">还没有发布过短视频</p>}
        </div>
      </div>
    </main>
  );
}
