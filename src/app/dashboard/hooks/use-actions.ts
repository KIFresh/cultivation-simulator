"use client";

import { useCallback, useState } from "react";
import { useGameStore } from "@/store";

export interface UseActionsResult {
  /** 执行某个修炼者行动 */
  performAction: (actionId: string, input?: string) => Promise<void>;
  /** 尝试突破境界 */
  breakthrough: () => Promise<void>;
  /** 推进一个季度 */
  advanceQuarter: () => Promise<void>;
  /** 全局行动加载态 */
  loading: boolean;
  /** 最近一次失败的错误信息（无则为 null） */
  error: string | null;
}

/**
 * 对全局 store 中的行动类动作做一层薄封装：
 * 统一错误捕获与 loading 暴露，供各面板按需调用。
 */
export function useActions(): UseActionsResult {
  const performAction = useGameStore((s) => s.performAction);
  const breakthrough = useGameStore((s) => s.breakthrough);
  const advanceQuarter = useGameStore((s) => s.advanceQuarter);
  const actionLoading = useGameStore((s) => s.actionLoading);

  const [error, setError] = useState<string | null>(null);

  const safe = useCallback(async (fn: () => void | Promise<void>): Promise<void> => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
      throw e;
    }
  }, []);

  const doPerformAction = useCallback(
    (actionId: string, input?: string) => safe(() => performAction(actionId, input)),
    [performAction, safe]
  );

  const doBreakthrough = useCallback(() => safe(() => breakthrough()), [breakthrough, safe]);

  const doAdvanceQuarter = useCallback(() => safe(() => advanceQuarter()), [advanceQuarter, safe]);

  return {
    performAction: doPerformAction,
    breakthrough: doBreakthrough,
    advanceQuarter: doAdvanceQuarter,
    loading: actionLoading,
    error,
  };
}
