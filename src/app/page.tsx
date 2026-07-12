"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Noto_Serif_SC } from "next/font/google";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import SettingsDialog from "@/components/settings-dialog";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export default function Home() {
  const router = useRouter();
  const [devMode, setDevMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
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

  const handleExitDev = () => {
    localStorage.removeItem("devMode");
    window.location.href = "/";
  };
  return (
    <div
      className={`min-h-screen bg-[#FDFBF7] text-[#2C2C2C] relative overflow-x-hidden selection:bg-[#8F9A8A] selection:text-white ${notoSerifSC.className}`}
    >
      {devMode && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-xs text-center py-1 z-50 flex items-center justify-center gap-4">
          <span>DEV MODE</span>
          <button onClick={handleQuickCreate} className="underline hover:no-underline">快速生成</button>
          <button onClick={handleReset} className="underline hover:no-underline">重置数据</button>
          <button onClick={handleExitDev} className="underline hover:no-underline">退出</button>
        </div>
      )}
      {/* 局部内联动画样式 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .fade-in-up {
            opacity: 0;
            transform: translateY(30px);
            animation: fadeInUp 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          }
          .delay-200 { animation-delay: 0.2s; }
          .delay-400 { animation-delay: 0.4s; }
          
          @keyframes fadeInUp {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />

      {/* 装饰性背景：水墨晕染与祥云纹理 */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
        {/* 左下角黛绿光晕 */}
        <div className="absolute bottom-[-20%] left-[-10%] w-[40rem] h-[40rem] bg-[#8F9A8A] rounded-full blur-[120px] opacity-20"></div>
        {/* 右上角淡墨光晕 */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#2C2C2C] rounded-full blur-[100px] opacity-10"></div>

        {/* 极简祥云 SVG 装饰 */}
        <svg
          className="absolute top-12 right-12 text-[#8F9A8A] opacity-30 w-48 h-48"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M70,45 A15,15 0 0,0 55,30 A20,20 0 0,0 20,40 A15,15 0 0,0 20,70 L70,70 A15,15 0 0,0 70,45 Z" />
        </svg>
        <svg
          className="absolute bottom-32 left-12 text-[#8F9A8A] opacity-20 w-32 h-32 transform rotate-180"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          <path d="M70,45 A15,15 0 0,0 55,30 A20,20 0 0,0 20,40 A15,15 0 0,0 20,70 L70,70 A15,15 0 0,0 70,45 Z" />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* 导航栏 */}
        <nav className="flex justify-between items-center py-8 fade-in-up">
          <div className="flex items-center gap-3">
            {/* 模拟古风印章 */}
            <div className="w-10 h-10 bg-[#8B2626] text-[#FDFBF7] flex flex-col items-center justify-center font-bold text-xs rounded-sm border-2 border-[#8B2626] transform -rotate-3 shadow-sm">
              <span className="leading-none">无</span>
              <span className="leading-none mt-1">尽</span>
            </div>
            <span className="text-2xl font-black tracking-[0.2em] text-[#2C2C2C]">
              无尽仙途
            </span>
          </div>
          <div className="flex gap-8 items-center">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-[#5C5C5C] hover:text-[#8B2626] transition-colors"
              title="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
            {/* 对接 Next.js 路由的登录入口 */}
            <Link
              href="/login"
              className="text-[#5C5C5C] hover:text-[#8B2626] transition-colors tracking-widest font-medium text-sm"
            >
              仙录登入
            </Link>
            <button className="px-6 py-2 border border-[#2C2C2C] text-[#2C2C2C] hover:bg-[#2C2C2C] hover:text-[#FDFBF7] transition-all duration-300 rounded-sm tracking-widest font-medium text-sm">
              结缘预约
            </button>
          </div>
        </nav>

        {/* Hero 主视觉区域 */}
        <main className="mt-24 flex flex-col items-center text-center fade-in-up delay-200">
          <div className="mb-8 flex items-center justify-center gap-4">
            <span className="h-[1px] w-12 bg-[#8F9A8A] opacity-60"></span>
            <span className="text-[#8F9A8A] tracking-[0.4em] text-sm font-medium">
              贰零贰陆 · 飞升之卷
            </span>
            <span className="h-[1px] w-12 bg-[#8F9A8A] opacity-60"></span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-[#2C2C2C] mb-10 leading-tight flex flex-col items-center tracking-widest">
            <span className="mb-4">凡尘一念，</span>
            <span className="relative">
              可达天听。
              <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-[#8B2626]"></span>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#5C5C5C] max-w-2xl leading-loose mb-16 tracking-wide">
            回归文字的本源，于素笺之上勾勒大道轮廓。<br />
            在这里，没有繁复的霓虹，唯有清风明月，与你长生久视的执念。<br />
            修仙，修的是心，亦是命。
          </p>

          {/* 水墨风格按钮，对接 Next.js 路由的创建角色/主页入口 */}
          <Link
            href="/create"
            className="relative group px-14 py-4 bg-transparent border-2 border-[#2C2C2C] text-[#2C2C2C] font-bold text-lg tracking-[0.3em] overflow-hidden transition-all duration-300 rounded-sm inline-block"
          >
            <div className="absolute inset-0 bg-[#2C2C2C] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-in-out z-0"></div>
            <span className="relative z-10 group-hover:text-[#FDFBF7] transition-colors duration-500 flex items-center gap-2">
              叩问仙门
              <svg
                className="w-5 h-5 transform group-hover:translate-x-2 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                ></path>
              </svg>
            </span>
          </Link>
        </main>

        {/* 游戏特色展示区 */}
        <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-8 pb-32 fade-in-up delay-400">
          {/* 特色卡片 1 */}
          <div className="group flex flex-col items-center text-center p-10 bg-[#F5F2E9] border border-[#E5E0D0] rounded-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative hover:-translate-y-2 transition-all duration-500 cursor-default">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#8F9A8A] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
            <svg
              className="w-14 h-14 mb-8 text-[#5C5C5C] group-hover:text-[#8F9A8A] transition-colors duration-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 20L12 4L22 20Z" strokeLinejoin="round" />
              <path d="M12 20L18 10" strokeLinejoin="round" />
            </svg>
            <h3 className="text-2xl font-bold text-[#2C2C2C] mb-4 tracking-widest">
              寻道山海
            </h3>
            <p className="text-[#5C5C5C] leading-loose text-sm">
              纵情大千世界，遍历奇山异水。机缘与斗争并存，你的因果，由此牵绊。
            </p>
          </div>

          {/* 特色卡片 2 */}
          <div className="group flex flex-col items-center text-center p-10 bg-[#F5F2E9] border border-[#E5E0D0] rounded-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative hover:-translate-y-2 transition-all duration-500 cursor-default md:translate-y-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#8B2626] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
            <svg
              className="w-14 h-14 mb-8 text-[#5C5C5C] group-hover:text-[#8B2626] transition-colors duration-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M12 2 A10 10 0 0 1 12 22 A5 5 0 0 0 12 12 A5 5 0 0 1 12 2 Z"
                fill="currentColor"
                opacity="0.2"
              />
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="#FDFBF7" />
            </svg>
            <h3 className="text-2xl font-bold text-[#2C2C2C] mb-4 tracking-widest">
              破劫飞升
            </h3>
            <p className="text-[#5C5C5C] leading-loose text-sm">
              体悟天地法则，历经九重天劫。从凡胎肉体至大罗金仙，步步惊心。
            </p>
          </div>

          {/* 特色卡片 3 */}
          <div className="group flex flex-col items-center text-center p-10 bg-[#F5F2E9] border border-[#E5E0D0] rounded-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative hover:-translate-y-2 transition-all duration-500 cursor-default">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#2C2C2C] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
            <svg
              className="w-14 h-14 mb-8 text-[#5C5C5C] group-hover:text-[#2C2C2C] transition-colors duration-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M9 7h6" strokeLinecap="round" />
              <path d="M9 11h8" strokeLinecap="round" />
            </svg>
            <h3 className="text-2xl font-bold text-[#2C2C2C] mb-4 tracking-widest">
              万卷归宗
            </h3>
            <p className="text-[#5C5C5C] leading-loose text-sm">
              博览上古残卷，融汇百家之长。不拘一格，自成一派，缔造你的专属功法。
            </p>
          </div>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}