"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Sword, BookOpen, Moon, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [hasUserId, setHasUserId] = useState(false);

  useEffect(() => {
    setHasUserId(!!localStorage.getItem("userId"));
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      {/* 背景装饰 */}
      <div className="fixed inset-0 bg-gradient-to-b from-amber-950/15 via-[#121212] to-[#121212] pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-3">
          <div className="text-6xl">⚔️</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            修仙模拟器
          </h1>
          <p className="text-stone-300 text-lg">
            现实修炼 · AI 修仙世界
          </p>
          <p className="text-stone-400 text-base">
            把今天的努力，变成修仙世界的修为
          </p>
        </div>

        {/* 三步引导 */}
        <div className="bg-stone-800 border border-white/10 rounded-xl p-5 text-left space-y-3">
          <p className="text-white text-base font-semibold">⚔️ 道友，修炼只需三步：</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold shrink-0 w-5">1</span>
              <span className="text-stone-300">取道号 → 测灵根 → 踏入仙途</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold shrink-0 w-5">2</span>
              <span className="text-stone-300">每天学习/运动/早睡 → 回来点一下</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-400 font-bold shrink-0 w-5">3</span>
              <span className="text-stone-300">AI 把你的坚持写成修仙故事</span>
            </div>
          </div>
          <p className="text-stone-400 text-sm pt-1">⚠️ 真的去做再点。靠自觉——骗系统没意义，你骗不了自己。</p>
        </div>

        {/* 特色介绍 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-stone-800 border-white/10">
            <CardHeader className="pb-2">
              <BookOpen className="w-5 h-5 text-amber-400 mx-auto" />
              <CardTitle className="text-sm text-white font-semibold text-center">学习=悟道</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-400 text-center">
              今日学习打卡，即修炼悟道
            </CardContent>
          </Card>
          <Card className="bg-stone-800 border-white/10">
            <CardHeader className="pb-2">
              <Sword className="w-5 h-5 text-red-400 mx-auto" />
              <CardTitle className="text-sm text-white font-semibold text-center">运动=锻体</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-400 text-center">
              强身健体，淬炼肉身修为
            </CardContent>
          </Card>
          <Card className="bg-stone-800 border-white/10">
            <CardHeader className="pb-2">
              <Moon className="w-5 h-5 text-blue-400 mx-auto" />
              <CardTitle className="text-sm text-white font-semibold text-center">早睡=静修</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-400 text-center">
              早睡养神，蕴养元神灵力
            </CardContent>
          </Card>
          <Card className="bg-stone-800 border-white/10">
            <CardHeader className="pb-2">
              <Sparkles className="w-5 h-5 text-purple-400 mx-auto" />
              <CardTitle className="text-sm text-white font-semibold text-center">AI叙事</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-400 text-center">
              每次修炼都有专属修仙故事
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          {hasUserId ? (
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-lg bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500"
                onClick={() => router.push("/dashboard")}
              >
                继续修炼
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="text-stone-400 text-base"
                onClick={() => {
                  localStorage.removeItem("userId");
                  window.location.href = "/";
                }}
              >
                重开仙途
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-lg bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500"
                onClick={() => router.push("/create")}
              >
                开启仙途
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="w-full text-stone-400 text-base"
                onClick={() => router.push("/login")}
              >
                已有道号？登录账号
              </Button>
            </div>
          )}
        </div>

        {/* 底部 */}
        <button
          className="text-stone-400 text-sm underline pt-2"
          onClick={() => {
            localStorage.clear();
            window.location.href = "/";
          }}
        >
          加载异常？清除缓存重试
        </button>
        <p className="text-stone-500 text-sm pt-4">
          同人创作 · 致敬凡人修仙传 · 与官方无关
        </p>
      </div>
    </main>
  );
}
