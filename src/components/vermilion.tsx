"use client";

import React from "react";

/**
 * 朱红纯色单栏卷 · 共享皮肤
 * 注入配色 CSS 变量与通用类（silk-card / font-calligraphy / seal-mark / main-container），
 * 并将页面包进宣纸底单栏容器。各主流程页（世界/关系/资产/记录/生活/调试）共用，保证视觉一致。
 */
export function VermilionShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.font.im" />
      <link
        href="https://fonts.font.im/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <style jsx global>{`
        :root {
          --vermilion-main: #B83227;
          --vermilion-dark: #7A1F18;
          --vermilion-light: #FDF2F0;
          --amber-gold: #D49B4B;
          --amber-light: #FAF4EB;
          --ink-dark: #2C1E1E;
          --paper-bg: #FAF7F3;
          --card-bg: #FFFFFF;
          --border-color: #EADCD0;
        }
        body {
          background-color: var(--paper-bg);
          color: var(--ink-dark);
        }
        .font-calligraphy {
          font-family: 'Ma Shan Zheng', 'STKaiti', 'KaiTi', '楷体', '华文行楷', cursive, serif;
        }
        .silk-card {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 20px -2px rgba(122, 31, 24, 0.05);
          transition: all 0.25s ease;
        }
        .silk-card:hover {
          box-shadow: 0 8px 25px -2px rgba(122, 31, 24, 0.08);
          border-color: rgba(184, 50, 39, 0.3);
        }
        .vermilion-progress-solid {
          background-color: var(--vermilion-main);
        }
        @keyframes sealDrop {
          0% { transform: scale(1.4) rotate(8deg); opacity: 0; }
          100% { transform: scale(1) rotate(-3deg); opacity: 0.95; }
        }
        .seal-mark {
          animation: sealDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--vermilion-light); border-radius: 10px; }
        .main-container {
          max-width: 860px;
          margin: 0 auto;
          padding: 1.5rem 1rem;
        }
      `}</style>
      <main className="min-h-screen" style={{ backgroundColor: "var(--paper-bg)", color: "var(--ink-dark)" }}>
        {children}
      </main>
    </>
  );
}
