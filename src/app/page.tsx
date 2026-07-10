"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Sword, Moon, Sparkles, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [hasUserId, setHasUserId] = useState(false);

  useEffect(() => {
    setHasUserId(!!localStorage.getItem("userId"));
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="relative z-10 max-w-lg w-full space-y-6">
        {/* 标题区 */}
        <div className="text-center space-y-2 pt-8">
          <h1 className="text-4xl font-bold text-foreground tracking-wider">
            修仙模拟器
          </h1>
          <p className="text-muted-foreground text-lg">
            现实修炼 · AI 修仙世界
          </p>
          <p className="text-muted-foreground text-sm">
            把今天的努力，变成修仙世界的修为
          </p>
        </div>

        {/* 三步引导 */}
        <Card className="bg-card border border-border">
          <CardContent className="p-5 space-y-3">
            <p className="text-foreground text-base font-semibold">道友，修炼只需三步：</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold shrink-0 w-5">1</span>
                <span className="text-muted-foreground">取道号 → 测灵根 → 踏入仙途</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold shrink-0 w-5">2</span>
                <span className="text-muted-foreground">每天学习/运动/早睡 → 回来点一下</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold shrink-0 w-5">3</span>
                <span className="text-muted-foreground">AI 把你的坚持写成修仙故事</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs pt-2">
              ⚠️ 真的去做再点。靠自觉——骗系统没意义，你骗不了自己。
            </p>
          </CardContent>
        </Card>

        {/* 特色介绍 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <BookOpen className="w-5 h-5 text-primary mx-auto" />
              <CardTitle className="text-sm text-foreground font-semibold text-center">学习=悟道</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center">
              今日学习打卡，即修炼悟道
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <Sword className="w-5 h-5 text-destructive mx-auto" />
              <CardTitle className="text-sm text-foreground font-semibold text-center">运动=锻体</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center">
              强身健体，淬炼肉身修为
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <Moon className="w-5 h-5 text-blue-500 mx-auto" />
              <CardTitle className="text-sm text-foreground font-semibold text-center">早睡=静修</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center">
              早睡养神，蕴养元神灵力
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <Sparkles className="w-5 h-5 text-purple-500 mx-auto" />
              <CardTitle className="text-sm text-foreground font-semibold text-center">AI叙事</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center">
              每次修炼都有专属修仙故事
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          {hasUserId ? (
            <>
              <Button
                className="w-full h-12 text-lg bg-primary hover:bg-primary/90"
                onClick={() => router.push("/dashboard")}
              >
                继续修炼
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground text-base"
                onClick={() => {
                  localStorage.removeItem("userId");
                  window.location.href = "/";
                }}
              >
                重开仙途
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full h-12 text-lg bg-primary hover:bg-primary/90"
                onClick={() => router.push("/create")}
              >
                开启仙途
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground text-base"
                onClick={() => router.push("/login")}
              >
                已有道号？登录账号
              </Button>
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="text-center space-y-2 pb-8">
          <button
            className="text-muted-foreground text-sm underline"
            onClick={() => {
              localStorage.clear();
              window.location.href = "/";
            }}
          >
            加载异常？清除缓存重试
          </button>
          <p className="text-muted-foreground text-xs">
            同人创作 · 致敬凡人修仙传 · 与官方无关
          </p>
        </div>
      </div>
    </main>
  );
}
