"use client";

import { useEffect, useState } from "react";

export interface DevModeState {
  /** 全局开发者功能是否可用（仅开发环境启用） */
  enabled: boolean;
  /** 是否已挂载（用于避免 SSR 水合不一致） */
  mounted: boolean;
}

/**
 * 全局开发者功能开关 + 挂载守卫。
 *
 * - `enabled`：开发者功能（如首页 DEV MODE 横幅、底部「调试」入口）是否可用。
 *   仅 `next dev` 开发环境为 true，生产构建为 false。
 * - 用户个人的 `devMode` 开关由调用方自行从 localStorage 读取，本 hook 只负责
 *   「功能是否可用」这一全局标志，与用户是否打开个人开关无关。
 * - `mounted`：客户端挂载后才置 true，避免在服务端/首屏渲染时产生水合警告。
 */
export function useDevModeEnabled(): DevModeState {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnabled(process.env.NODE_ENV === "development");
  }, []);

  return { enabled, mounted };
}
