import { deriveStoreFields } from "./game-helpers";

/** 统一回填：处理道消 / 叙事 / 修炼者派生 / 突破门控 */
export function applyNarrativeResult(set: (partial: any) => void, data: any): void {
  if (data?.daoXiao) {
    set((s: any) => ({
      ...s,
      ...(data.cultivator ? deriveStoreFields(data.cultivator) : {}),
      actionLoading: false,
      streamingText: null,
      lastActionResult: data,
      narrativeError: { message: "道消！修炼之路中断。", params: data.summary },
    }));
    return;
  }
  const derived = data.cultivator ? deriveStoreFields(data.cultivator) : {};
  set((s: any) => ({
    ...s,
    ...derived,
    narrative: data.narrative ?? s.narrative,
    streamingText: null,
    lastActionResult: data,
    actionLoading: false,
    canBreakthrough:
      typeof data.canBreakthrough === "boolean"
        ? data.canBreakthrough
        : (derived.canBreakthrough ?? s.canBreakthrough),
  }));
}