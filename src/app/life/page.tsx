"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";

const LIFE_ACTIVITIES = [
  { href: "/streets", icon: "🚶", name: "街头机缘", desc: "市井之间，偶遇奇人异事。" },
  {
    href: "/short-video",
    icon: "📱",
    name: "短视频奇遇",
    desc: "指尖滑过，都市修仙的碎片落进心里。",
  },
  { href: "/class-enroll", icon: "📚", name: "课外班", desc: "报名兴趣班，年复一年锤炼心性。" },
  { href: "/savings", icon: "💰", name: "储蓄罐", desc: "零花钱存进储蓄罐，跨年长出利息。" },
  { href: "/neighbors", icon: "🏘️", name: "邻里", desc: "串门唠嗑，邻里情分也是修行。" },
  { href: "/arcade", icon: "🕹️", name: "街机厅", desc: "投币开玩，手速与运气齐飞。" },
  { href: "/reading", icon: "📖", name: "课外阅读", desc: "图书馆看书，积累知识储备。" },
  { href: "/location-event", icon: "✨", name: "地点奇遇", desc: "行走市井山野，撞上一段机缘。" },
  { href: "/location-npcs", icon: "🧑‍🤝‍🧑", name: "地点人物", desc: "每个去处都有常驻的脸孔。" },
  { href: "/shop", icon: "🛒", name: "地点商铺", desc: "每个地点卖不同的货色，看中便带走。" },
  {
    href: "/exchange",
    icon: "🏦",
    name: "兑换所",
    desc: "金币与灵石在此桥接，凡人可预存、修士能变现。",
  },
  { href: "/spirit-pet", icon: "🐾", name: "灵宠洞府", desc: "孵化灵宠蛋，养成战力与采集双加成。" },
  {
    href: "/secret-realm",
    icon: "🌀",
    name: "秘境钥匙",
    desc: "以灵石灵草为门票，入秘境搏灵草、残页与机缘。",
  },
];

export default function LifePage() {
  const router = useRouter();
  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1 text-sm text-[#7A1F18] hover:text-[#B83227] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 回到修行台
        </button>

        <div className="pt-2">
          <h1 className="font-calligraphy text-2xl font-bold text-[#7A1F18] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#D49B4B]" /> 凡人生活
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">修行之外，烟火人间也有机缘与成长。</p>
        </div>

        <div className="space-y-3">
          {LIFE_ACTIVITIES.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="silk-card rounded-2xl p-4 flex items-center gap-3 hover:border-[#B83227] transition-all"
            >
              <span className="text-2xl">{a.icon}</span>
              <div>
                <p className="text-base font-bold text-[#2C1E1E]">{a.name}</p>
                <p className="text-xs text-gray-400">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </VermilionShell>
  );
}
