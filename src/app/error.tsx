"use client";

/**
 * 根级错误边界 - App Router 自动捕获的同级段渲染错误。
 * 生产环境只显示通用提示；开发环境保留诊断信息。
 */

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-[#FAF7F3] p-4"
      style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}
    >
      <div className="max-w-md text-center space-y-4">
        <div className="text-4xl mb-2">🌿</div>
        <h1 className="text-xl font-bold text-[#2C1E1E]">出了点小问题</h1>
        <p className="text-sm text-[#8B7355]">
          页面加载过程中遇到异常，请尝试刷新或返回首页。
        </p>
        {isDev && error.message && (
          <p className="text-xs text-red-600 bg-red-50 rounded p-2 break-words">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors"
          >
            重试
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-xl border border-[#EADCD0] bg-white text-[#2C1E1E] text-sm font-medium hover:border-[#B83227] transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    </main>
  );
}