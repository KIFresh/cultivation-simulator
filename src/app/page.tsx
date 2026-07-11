"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function HomePage() {
  const router = useRouter();
  const [hasUserId, setHasUserId] = useState(false);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    setHasUserId(!!localStorage.getItem("userId"));
    setDevMode(localStorage.getItem("devMode") === "true");
  }, []);

  const handleQuickCreate = async () => {
    const els = ["金","木","水","火","土"]; const qs = ["上品","中品","下品"];
    const root = Math.random() > 0.1 ? `${els[Math.floor(Math.random()*5)]}_${qs[Math.floor(Math.random()*3)]}` : "chaos";
    const res = await fetch("/api/cultivator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: `dev_${Date.now()}`, cultivatorName: `测试_${Date.now()}`, spiritualRoot: root, worldId: "earth" }) });
    const data = await res.json();
    if (!data.user) { toast.error("生成失败"); return; }
    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("cultivatorName", data.user.cultivator.name);
    localStorage.setItem("attributes", JSON.stringify({}));
    window.location.href = "/dashboard";
  };

  const handleReset = async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    setDevMode(false);
    window.location.href = "/";
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen bg-background">
      {devMode && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-xs text-center py-1 z-50">
          DEV MODE
        </div>
      )}
      <div className="relative z-10 max-w-lg w-full space-y-6">
        <div className="text-center space-y-2 pt-8">
          <h1 className="text-4xl font-bold text-foreground tracking-wider">修仙模拟器</h1>
          <p className="text-muted-foreground text-lg">AI 修仙世界</p>
        </div>

        <Card className="bg-card border border-border">
          <CardContent className="p-5 space-y-3">
            <p className="text-foreground text-base font-semibold">⚔️ 道友，修炼只需三步：</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3"><span className="text-primary font-bold shrink-0 w-5">1</span><span className="text-muted-foreground">选世界 → 定出生 → 踏入仙途</span></div>
              <div className="flex items-start gap-3"><span className="text-primary font-bold shrink-0 w-5">2</span><span className="text-muted-foreground">每次行动都有 AI 生成专属修仙叙事</span></div>
              <div className="flex items-start gap-3"><span className="text-primary font-bold shrink-0 w-5">3</span><span className="text-muted-foreground">从凡人到渡劫，一步步突破境界</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {hasUserId ? (
            <>
              <Button className="w-full h-12 text-lg bg-primary hover:bg-primary/90" onClick={() => router.push("/dashboard")}>
                继续修炼 <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground text-base" onClick={() => { localStorage.removeItem("userId"); window.location.href = "/"; }}>
                重开仙途
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full h-12 text-lg bg-primary hover:bg-primary/90" onClick={() => router.push("/create")}>
                开启仙途 <Sparkles className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground text-base" onClick={() => router.push("/login")}>
                已有道号？登录账号
              </Button>
            </>
          )}

          {devMode && (
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleQuickCreate}>
                快速生成
              </Button>
              <Button variant="outline" className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50" onClick={handleReset}>
                重置数据
              </Button>
              <Button variant="outline" className="flex-1 border-border" onClick={() => { localStorage.removeItem("devMode"); window.location.href = "/"; }}>
                退出
              </Button>
            </div>
          )}
        </div>

        <div className="text-center space-y-2 pb-8">
          <button className="text-muted-foreground text-sm underline" onClick={() => { localStorage.clear(); window.location.href = "/"; }}>
            加载异常？清除缓存重试
          </button>
          <p className="text-muted-foreground text-xs">同人创作 · 致敬凡人修仙传 · 与官方无关</p>
        </div>
      </div>
    </main>
  );
}