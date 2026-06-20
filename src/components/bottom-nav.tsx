"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sword, ClipboardList, ScrollText } from "lucide-react";

const items = [
  { href: "/",          icon: Home,          label: "首页" },
  { href: "/dashboard", icon: Sword,         label: "修炼" },
  { href: "/tasks",     icon: ClipboardList, label: "任务" },
  { href: "/history",   icon: ScrollText,    label: "记录" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900/95 backdrop-blur border-t border-white/10 safe-area-bottom">
      <div className="flex max-w-lg mx-auto">
        {items.map(({ href, icon: Icon, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs transition-colors ${
                active ? "text-amber-400" : "text-stone-500 hover:text-stone-300"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={active ? "font-medium" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
