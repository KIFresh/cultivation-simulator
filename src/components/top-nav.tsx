"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDevModeEnabled } from "@/hooks/use-dev-mode";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_TABS: { label: string; href: string }[] = [
  { label: "修炼", href: "/dashboard" },
  { label: "世界", href: "/world" },
  { label: "关系", href: "/relationships" },
  { label: "物品", href: "/items" },
  { label: "技能", href: "/skills" },
  { label: "资产", href: "/assets" },
  { label: "记忆", href: "/memory" },
  { label: "记录", href: "/history" },
  { label: "生活", href: "/life" },
];

export default function TopNav() {
  const path = usePathname();
  const { enabled, mounted } = useDevModeEnabled();
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    setDevMode(localStorage.getItem("devMode") === "true");
  }, []);

  const showDevTab = mounted && enabled && devMode;
  const allTabs = showDevTab ? [...NAV_TABS, { label: "调试", href: "/dev" }] : NAV_TABS;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <header className="sticky top-0 z-50 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
          {/* 品牌区 */}
          <Link href="/" className="flex items-center space-x-3 shrink-0 cursor-pointer">
            <div className="w-9 h-9 bg-[var(--destructive)] flex items-center justify-center rounded-lg shadow-md rotate-3">
              <span className="text-white calligraphy text-lg">仙</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-widest text-[var(--primary)] calligraphy leading-tight">
                无尽仙途
              </h1>
              <p className="text-[9px] text-[var(--muted-foreground)] tracking-[0.3em] uppercase leading-tight">
                Infinity Immortal Way
              </p>
            </div>
          </Link>

          {/* 胶囊标签导航 */}
          <nav className="flex overflow-x-auto space-x-2 py-1 no-scrollbar">
            {allTabs.map((t) => {
              const active = path === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`nav-tag px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--card)] border shadow-sm whitespace-nowrap transition-all duration-200 ${
                    active
                      ? "active !bg-[var(--destructive)] !text-white !border-[var(--destructive)] translate-y-[-2px] shadow-[0_4px_10px_rgba(184,50,39,0.25)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:border-[var(--border)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <style jsx>{`
        .nav-tag {
          transition: all 0.2s ease;
        }
        .nav-tag.active {
          background-color: var(--destructive) !important;
          color: #ffffff !important;
          border-color: var(--destructive) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(184, 50, 39, 0.25);
        }
        .calligraphy {
          font-family: "Ma Shan Zheng", "STKaiti", "KaiTi", "楷体", "华文行楷", cursive, serif;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
