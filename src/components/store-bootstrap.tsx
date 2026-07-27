"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store";

/**
 * 全局 store 引导：从 localStorage 读取 userId 并加载修炼者数据，
 * 使各面板（status-bar / action-panel / inventory-panel 等）能从
 * 全局 store 取到最新状态（dashboard 本身使用本地 state，此处补齐同步）。
 */
export function StoreBootstrap() {
  const bootstrap = useGameStore((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  return null;
}
