"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();

      if (!data.user) {
        setError(data.message || "服务器返回异常");
        return;
      }

      if (data.action === "login") {
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("cultivatorName", data.user.name);
        toast.success(`欢迎回来，${data.user.name}道友！`);
        router.replace("/dashboard");
      } else if (data.action === "created") {
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("cultivatorName", data.user.name);
        toast.success("道籍已录，塑造你的化身吧");
        router.replace("/create");
      } else {
        setError(data.message || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="relative z-10 max-w-lg w-full space-y-6">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <LogIn className="w-5 h-5" /> 踏入仙途
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              新道友自动创建道籍，老道友直接登录
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">账号名</label>
              <Input
                placeholder="输入你的账号名"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">密码</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!name.trim() || !password || loading}
              onClick={handleSubmit}
            >
              {loading ? "正在感应天道..." : "开始修仙"}
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              · 新道友自动创建 ·
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}