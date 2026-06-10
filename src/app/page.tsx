"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Sword, BookOpen, Moon, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [hasCultivator, setHasCultivator] = useState<boolean | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`/api/cultivator?userId=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.cultivator) {
            setHasCultivator(true);
          } else {
            setHasCultivator(false);
          }
        })
        .catch(() => setHasCultivator(false));
    } else {
      setHasCultivator(false);
    }
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      {/* 背景装饰 */}
      <div className="fixed inset-0 bg-gradient-to-b from-amber-950/20 via-stone-950 to-stone-950 pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-3">
          <div className="text-6xl">⚔️</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            修仙模拟器
          </h1>
          <p className="text-stone-400 text-lg">
            现实修炼 · AI 修仙世界
          </p>
          <p className="text-stone-500 text-sm">
            把今天的努力，变成修仙世界的修为
          </p>
        </div>

        {/* 特色介绍 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-stone-900/50 border-stone-800">
            <CardHeader className="pb-2">
              <BookOpen className="w-5 h-5 text-amber-400 mx-auto" />
              <CardTitle className="text-sm text-stone-300 text-center">学习=悟道</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-stone-500 text-center">
              今日学习打卡，即修炼悟道
            </CardContent>
          </Card>
          <Card className="bg-stone-900/50 border-stone-800">
            <CardHeader className="pb-2">
              <Sword className="w-5 h-5 text-red-400 mx-auto" />
              <CardTitle className="text-sm text-stone-300 text-center">运动=锻体</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-stone-500 text-center">
              强身健体，淬炼肉身修为
            </CardContent>
          </Card>
          <Card className="bg-stone-900/50 border-stone-800">
            <CardHeader className="pb-2">
              <Moon className="w-5 h-5 text-blue-400 mx-auto" />
              <CardTitle className="text-sm text-stone-300 text-center">早睡=静修</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-stone-500 text-center">
              早睡养神，蕴养元神灵力
            </CardContent>
          </Card>
          <Card className="bg-stone-900/50 border-stone-800">
            <CardHeader className="pb-2">
              <Sparkles className="w-5 h-5 text-purple-400 mx-auto" />
              <CardTitle className="text-sm text-stone-300 text-center">AI叙事</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-stone-500 text-center">
              每次修炼都有专属修仙故事
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          {hasCultivator === null ? (
            <Button disabled className="w-full h-12 text-lg bg-stone-800">
              加载中...
            </Button>
          ) : hasCultivator ? (
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
                className="text-stone-500 text-sm"
                onClick={() => {
                  localStorage.removeItem("userId");
                  router.push("/create");
                }}
              >
                重开仙途
              </Button>
            </div>
          ) : (
            <Button
              className="w-full h-12 text-lg bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500"
              onClick={() => router.push("/create")}
            >
              开启仙途
              <Sparkles className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>

        {/* 底部 */}
        <p className="text-stone-700 text-xs pt-4">
          同人创作 · 致敬凡人修仙传 · 与官方无关
        </p>
      </div>
    </main>
  );
}
