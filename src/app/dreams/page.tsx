"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, ArrowLeft, Sparkles } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";

interface Dream {
  title: string;
  text: string;
  omen: string;
}

export default function DreamsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dream, setDream] = useState<Dream | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/");
      return;
    }
    setUserId(id);
  }, [router]);

  const dreamNow = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/dream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "入梦失败");
        return;
      }
      setDream(data.dream);
    } catch (e) {
      toast.error("入梦失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button
          onClick={() => router.push("/weather")}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 返回天象
        </button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Moon className="w-5 h-5 text-primary" /> 梦境预兆
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              闭目凝神，梦境将预示一段命运的低语。入梦不会消耗任何修为。
            </p>
            <Button
              className="w-full bg-primary hover:bg-[#B33A2A] text-white"
              disabled={loading || !userId}
              onClick={dreamNow}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? "入梦中..." : "入梦"}
            </Button>
          </CardContent>
        </Card>

        {dream && (
          <Card className="border-primary/30 bg-primary/5 shadow-md">
            <CardContent className="p-4 space-y-2">
              <p className="text-primary font-bold text-lg">{dream.title}</p>
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {dream.text}
              </p>
              <p className="text-xs text-muted-foreground">征兆：{dream.omen}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
