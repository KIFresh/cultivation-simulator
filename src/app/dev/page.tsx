"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Home, Trash2, Sparkles, Database, RefreshCw, Eye, EyeOff } from "lucide-react";

export default function DevPage() {
  const router = useRouter();
  const [dbStatus, setDbStatus] = useState<{ status: string; db: string; latencyMs?: number } | null>(null);
  const [localData, setLocalData] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    // 检查 dev mode
    if (localStorage.getItem("devMode") !== "true") {
      router.push("/");
      return;
    }
    // 加载 localStorage 数据
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || "";
    }
    setLocalData(data);
    // 检查数据库
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDbStatus(d))
      .catch(() => setDbStatus({ status: "error", db: "down" }));
  }, [router]);

  const handleQuickCreate = async () => {
    const els = ["金", "木", "水", "火", "土"];
    const qs = ["上品", "中品", "下品"];
    const root =
      Math.random() > 0.1
        ? `${els[Math.floor(Math.random() * 5)]}_${qs[Math.floor(Math.random() * 3)]}`
        : "chaos";
    const res = await fetch("/api/cultivator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: `dev_${Date.now()}`,
        cultivatorName: `测试_${Date.now()}`,
        spiritualRoot: root,
        worldId: "earth",
      }),
    });
    const data = await res.json();
    if (!data.user) {
      toast.error("生成失败");
      return;
    }
    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("cultivatorName", data.user.cultivator?.name ?? data.user.name);
    localStorage.setItem("attributes", JSON.stringify({}));
    toast.success(`已生成角色：${data.user.cultivator?.name ?? data.user.name}`);
    // 生成出生叙事
    try {
      await fetch("/api/narrative", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id, type: "BIRTH", worldName: "地球", identityName: "未知", age: 1, worldId: "earth", family: [] }),
      });
    } catch (e) { console.error("出生叙事生成失败:", e); }
    window.location.href = "/dashboard";
  };

  const handleReset = async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    // DELETE API 可能不存在，容错
    try { await fetch("/api/cultivator", { method: "DELETE" }); } catch {}
    toast.success("数据已重置");
    window.location.href = "/";
  };

  const handleClearLocal = () => {
    if (!window.confirm("确定要清空 localStorage 吗？")) return;
    localStorage.clear();
    setLocalData({});
    toast.success("localStorage 已清空");
  };

  const handleRefresh = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || "";
    }
    setLocalData(data);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDbStatus(d))
      .catch(() => setDbStatus({ status: "error", db: "down" }));
    toast.success("已刷新");
  };

  return (
    <main className="flex-1 min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-sm"
          >
            <Home className="w-4 h-4" /> 返回
          </button>
          <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded">
            DEV MODE
          </span>
        </div>

        <h1 className="text-xl font-bold text-foreground">⚙️ 调试面板</h1>

        {/* 快速操作 */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" /> 快速操作
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleQuickCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> 快速生成角色
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReset}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> 重置所有数据
            </Button>
            <Button size="sm" variant="outline" className="border-border" onClick={handleClearLocal}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> 清空 localStorage
            </Button>
            <Button size="sm" variant="outline" className="border-border" onClick={handleRefresh}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> 刷新
            </Button>
          </CardContent>
        </Card>

        {/* 数据库状态 */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" /> 数据库状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dbStatus ? (
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  状态：{" "}
                  <span
                    className={
                      dbStatus.status === "ok" ? "text-green-600 font-medium" : "text-red-600 font-medium"
                    }
                  >
                    {dbStatus.status === "ok" ? "✅ 正常" : "❌ 异常"}
                  </span>
                </p>
                <p>数据库：{dbStatus.db === "up" ? "✅ 已连接" : "❌ 断开"}</p>
                {dbStatus.latencyMs !== undefined && <p>延迟：{dbStatus.latencyMs}ms</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">检测中...</p>
            )}
          </CardContent>
        </Card>

        {/* localStorage 数据 */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-green-500" /> localStorage
              </span>
              <button
                onClick={() => setShowValues(!showValues)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(localData).length === 0 ? (
              <p className="text-xs text-muted-foreground">无数据</p>
            ) : (
              <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
                {Object.entries(localData).map(([key, value]) => (
                  <div key={key} className="flex gap-2 border-b border-border/50 pb-1 last:border-0">
                    <span className="font-medium text-foreground shrink-0 w-28 truncate">{key}</span>
                    <span className="text-muted-foreground truncate">
                      {showValues ? value : value.length > 50 ? `${value.slice(0, 50)}...` : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}