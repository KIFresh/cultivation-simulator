"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const apps = [
  { name: "消息", icon: "💬", href: "/relationships", desc: "与NPC聊天" },
  { name: "地图", icon: "🗺️", href: "/dashboard", desc: "查看地点" },
  { name: "商城", icon: "🏪", href: "/shop", desc: "购买物品" },
  { name: "社交", icon: "👥", href: "/relationships", desc: "人际关系" },
  { name: "记录", icon: "📜", href: "/history", desc: "修炼历程" },
];

export default function PhonePage() {
  const router = useRouter();
  return (
    <main className="flex-1 min-h-screen bg-background">
      <div className="max-w-sm mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-primary"><ArrowLeft className="w-4 h-4" /></button>
          <h1 className="text-lg font-bold text-foreground">📱 手机</h1>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {apps.map((app) => (
            <Card key={app.name} className="border-border bg-card shadow-sm hover:border-primary/30 cursor-pointer transition-colors" onClick={() => router.push(app.href)}>
              <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                <span className="text-2xl">{app.icon}</span>
                <span className="text-xs font-medium text-foreground">{app.name}</span>
                <span className="text-[9px] text-muted-foreground">{app.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}