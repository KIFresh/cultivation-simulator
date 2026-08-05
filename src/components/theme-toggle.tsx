"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes 官方 hydration 防闪烁模式
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-16 h-8" />;
  const dark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105"
      style={{
        background: dark ? "var(--primary)" : "transparent",
        color: dark ? "var(--primary-foreground)" : "var(--foreground)",
        borderColor: dark ? "var(--primary)" : "var(--border)",
      }}
      aria-label="切换主题"
    >
      {dark ? "🌙" : "☀️"}
    </button>
  );
}
