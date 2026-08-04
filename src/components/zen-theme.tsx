"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 「无尽仙途」中式视觉语言 —— 单一可信源。
 * 登录页 / 出生选择页 / 其他叙事页共用，避免出现多套各写各的皮肤。
 */

// 全局样式：字体、宣纸肌理、光晕、太极、云纹、金角、朱砂印、毛笔字
export function ZenStyle() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@300;400;600;900&display=swap"
        rel="stylesheet"
      />
      <style jsx global>{`
        .calligraphy {
          font-family: "Ma Shan Zheng", cursive;
        }
        .paper-grain {
          position: absolute;
          inset: 0;
          opacity: 0.02;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          z-index: 40;
        }
        .zen-halo {
          background: radial-gradient(
            circle,
            rgba(244, 239, 230, 0.85) 0%,
            rgba(250, 248, 245, 0) 75%
          );
          transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .vermilion-underline {
          position: relative;
        }
        .vermilion-underline::after {
          content: "";
          position: absolute;
          left: 5%;
          bottom: -2px;
          width: 90%;
          height: 3px;
          background-color: #8c2d19;
          border-radius: 2px;
          transform: scaleX(1);
          transition: transform 0.4s ease;
        }
        @keyframes floatCloud {
          0% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.15;
          }
          50% {
            transform: translateY(-12px) translateX(15px);
            opacity: 0.3;
          }
          100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.15;
          }
        }
        .cloud-float-1 {
          animation: floatCloud 28s ease-in-out infinite;
          transition: transform 0.3s ease-out;
        }
        .cloud-float-2 {
          animation: floatCloud 36s ease-in-out infinite 4s;
          transition: transform 0.3s ease-out;
        }
        @keyframes rotateArray {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
        .zen-bagua-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 600px;
          height: 600px;
          transform: translate(-50%, -50%);
          opacity: 0.025;
          pointer-events: none;
          animation: rotateArray 180s linear infinite;
          z-index: -5;
        }
        @keyframes seal-drop {
          0% {
            transform: scale(1.8) rotate(18deg);
            opacity: 0;
            filter: blur(3px);
          }
          100% {
            transform: scale(1) rotate(-4deg);
            opacity: 0.9;
            filter: blur(0px);
          }
        }
        .seal-animation {
          animation: seal-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
        }
        .fret-corner-tl {
          top: 12px;
          left: 12px;
          border-top: 1px solid rgba(217, 161, 60, 0.25);
          border-left: 1px solid rgba(217, 161, 60, 0.25);
        }
        .fret-corner-tr {
          top: 12px;
          right: 12px;
          border-top: 1px solid rgba(217, 161, 60, 0.25);
          border-right: 1px solid rgba(217, 161, 60, 0.25);
        }
        .fret-corner-bl {
          bottom: 12px;
          left: 12px;
          border-bottom: 1px solid rgba(217, 161, 60, 0.25);
          border-left: 1px solid rgba(217, 161, 60, 0.25);
        }
        .fret-corner-br {
          bottom: 12px;
          right: 12px;
          border-bottom: 1px solid rgba(217, 161, 60, 0.25);
          border-right: 1px solid rgba(217, 161, 60, 0.25);
        }
      `}</style>
    </>
  );
}

// 背景层：宣纸肌理 + 乳白光晕 + 自转太极 + 浮云（带鼠标视差）
export function ZenBackground() {
  const halo1 = useRef<HTMLDivElement>(null);
  const halo2 = useRef<HTMLDivElement>(null);
  const cloud1 = useRef<SVGSVGElement>(null);
  const cloud2 = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let targetX = 0,
      targetY = 0,
      currentX = 0,
      currentY = 0,
      raf = 0;
    const onMove = (e: MouseEvent) => {
      targetX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };
    const loop = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      if (halo1.current)
        halo1.current.style.transform = `translate(${currentX * 45}px, ${currentY * 45}px)`;
      if (halo2.current)
        halo2.current.style.transform = `translate(${currentX * -45}px, ${currentY * -45}px)`;
      if (cloud1.current)
        cloud1.current.style.transform = `translate(${currentX * -15}px, ${currentY * -10}px)`;
      if (cloud2.current)
        cloud2.current.style.transform = `translate(${currentX * 20}px, ${currentY * 15}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="paper-grain" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          ref={halo1}
          className="absolute -top-[20%] left-[10%] w-[800px] h-[800px] rounded-full zen-halo opacity-70"
        />
        <div
          ref={halo2}
          className="absolute -bottom-[20%] right-[10%] w-[900px] h-[900px] rounded-full zen-halo opacity-60"
        />
        <svg
          className="zen-bagua-bg text-[#D9A13C]/10"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth={0.3}
        >
          <circle cx="100" cy="100" r="95" strokeDasharray="2,2" />
          <circle cx="100" cy="100" r="85" />
          <path d="M100,5 L100,15 M100,185 L100,195 M5,100 L15,100 M185,100 L195,100" />
          <path
            d="M100,15 C53.6,15 15,53.6 15,100 C15,123 24.3,143.8 39.3,158.8 C54.3,173.8 75,185 100,185 C146.4,185 185,146.4 185,100 C185,53.6 146.4,15 100,15 Z"
            strokeDasharray="1,1"
          />
          <path d="M100,15 C123.5,15 142.5,34 142.5,57.5 C142.5,81 123.5,100 100,100 C76.5,100 57.5,119 57.5,142.5 C57.5,166 76.5,185 100,185" />
          <circle cx="100" cy="57.5" r="8" fill="currentColor" opacity="0.1" />
          <circle cx="100" cy="142.5" r="8" fill="none" stroke="currentColor" strokeWidth={0.5} />
        </svg>
        <svg
          ref={cloud1}
          className="absolute left-12 top-1/3 w-36 h-auto text-gray-200/40 cloud-float-1"
          viewBox="0 0 100 50"
          fill="currentColor"
        >
          <path d="M20,30 C20,20 35,15 45,22 C55,12 75,15 80,25 C88,25 95,32 90,40 C85,45 15,45 10,40 C5,35 12,30 20,30 Z" />
        </svg>
        <svg
          ref={cloud2}
          className="absolute right-16 top-24 w-44 h-auto text-gray-200/40 cloud-float-2"
          viewBox="0 0 100 50"
          fill="currentColor"
        >
          <path d="M15,25 C15,15 30,12 40,18 C50,8 70,10 75,20 C82,20 88,26 85,32 C80,38 10,38 8,32 C5,28 10,25 15,25 Z" />
        </svg>
      </div>
    </>
  );
}

// 顶部品牌栏
export function ZenBrand({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.push("/"));
  return (
    <header className="w-full px-6 md:px-12 py-6 flex justify-between items-center z-10">
      <a href="/" className="flex items-center space-x-3.5 group">
        <div className="w-9 h-9 bg-[#8C2D19] rounded flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
          <span className="text-white text-[11px] font-semibold tracking-wider calligraphy p-1 leading-none text-center">
            无尽
          </span>
        </div>
        <span className="text-lg font-bold tracking-[0.25em] text-[#1A1A1A] calligraphy transition-colors group-hover:text-[#8C2D19]">
          无尽仙途
        </span>
      </a>
      <button
        type="button"
        onClick={handleBack}
        className="group flex items-center space-x-2 text-xs tracking-widest text-gray-400 hover:text-[#8C2D19] transition-colors duration-300"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        <span>返回尘世</span>
      </button>
    </header>
  );
}

// 朱砂印章标签（如「契约已立」）
export function ZenSeal({ children }: { children: ReactNode }) {
  return (
    <span className="border border-dashed border-[#8C2D19]/70 text-[#8C2D19] text-[10px] px-2 py-0.5 font-bold calligraphy inline-block bg-[var(--card)]/90 seal-animation shadow-sm">
      {children}
    </span>
  );
}

// 宣纸卡片：金角包边 + 双线内框 + 选中朱砂高亮
export function ZenCard({
  selected,
  disabled,
  onClick,
  className = "",
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "relative rounded-2xl border bg-[var(--card)]/95 backdrop-blur-md shadow-sm transition-all duration-300 overflow-hidden";
  const state = selected
    ? "border-[#8C2D19]/60 bg-[#8C2D19]/[0.03] shadow-md"
    : disabled
      ? "border-gray-200/50 opacity-50"
      : "border-gray-200/50 hover:border-gray-300/60 hover:shadow-md cursor-pointer";
  return (
    <div onClick={disabled ? undefined : onClick} className={`${base} ${state} ${className}`}>
      <div className="absolute w-3 h-3 fret-corner-tl" />
      <div className="absolute w-3 h-3 fret-corner-tr" />
      <div className="absolute w-3 h-3 fret-corner-bl" />
      <div className="absolute w-3 h-3 fret-corner-br" />
      <div className="absolute inset-0 pointer-events-none border-[6px] border-double border-[#D2C6B2]/15 rounded-2xl m-2" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// 按钮：朱砂实心（主）+ 水墨描边（次）
export function ZenButton({
  variant = "primary",
  disabled,
  onClick,
  className = "",
  children,
}: {
  variant?: "primary" | "outline";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "outline") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full py-2.5 border border-[#1A1A1A] bg-[#FAF8F5] hover:bg-[var(--card)] hover:border-[#8C2D19] transition-all duration-300 rounded text-xs font-semibold tracking-[0.3em] text-[#1A1A1A] hover:text-[#8C2D19] shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full py-2.5 border border-[#1A1A1A] bg-[#8C2D19] hover:bg-[#732116] transition-all duration-300 rounded text-xs font-semibold tracking-[0.3em] text-white shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
