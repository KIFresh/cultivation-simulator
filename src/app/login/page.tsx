"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, ArrowLeft, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!name.trim() || !password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();
      if (data.user) {
        localStorage.setItem("userId", data.user.id);
        toast.success(`欢迎回来，${data.user.cultivator?.name || data.user.name}道友！`);
        router.replace("/dashboard");
      } else {
        toast.error(data.error || "登录失败");
      }
    } catch {
      toast.error("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-b from-amber-950/15 via-[#121212] to-[#121212] pointer-events-none" />
      <div className="relative z-10 max-w-lg w-full space-y-6">
        <Button variant="ghost" className="text-stone-400" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
        <Card className="bg-stone-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-xl text-amber-400 flex items-center gap-2">
              <LogIn className="w-5 h-5" /> 登录账号
            </CardTitle>
            <CardDescription className="text-stone-300">
              已有道号？输入账号名和密码继续修炼
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-stone-300">账号名</label>
              <Input
                placeholder="输入你的账号名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-stone-900 border-white/10 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-stone-300">密码</label>
              <Input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-stone-900 border-white/10 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500"
              disabled={!name.trim() || !password || loading}
              onClick={handleLogin}
            >
              {loading ? "正在踏入修仙世界..." : "登录"}
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-sm text-stone-400 text-center">
              还没有账号？<button className="text-amber-500 underline" onClick={() => router.push("/create")}>创建修炼者</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
