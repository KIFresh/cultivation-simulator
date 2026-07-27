"use client";

import { useCallback, useEffect, useState } from "react";
import type { CultivatorData } from "@/app/dashboard/types";

export interface UseCultivatorResult {
  /** 当前修炼者数据（未加载或失败时为 null） */
  cultivator: CultivatorData | null;
  /** 是否正在请求 */
  loading: boolean;
  /** 错误信息（无则为 null） */
  error: string | null;
  /** 手动重新拉取 */
  reload: () => void;
}

interface CultivatorApiResponse {
  user?: { cultivator?: CultivatorData };
  cultivator?: CultivatorData;
}

/**
 * 拉取并持有当前修炼者数据。GET /api/cultivator?userId=... 返回
 * `{ user: { cultivator } }`，本 hook 同时兼容直接返回 `{ cultivator }` 的形态。
 */
export function useCultivator(userId?: string): UseCultivatorResult {
  const [cultivator, setCultivator] = useState<CultivatorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!userId) {
      setCultivator(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/cultivator?userId=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CultivatorApiResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const c = data.user?.cultivator ?? data.cultivator ?? null;
        setCultivator(c);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, nonce]);

  return { cultivator, loading, error, reload };
}
