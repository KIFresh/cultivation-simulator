// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDevModeEnabled } from "@/hooks/use-dev-mode";

describe("useDevModeEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("初始状态返回 mounted=true, enabled=false", () => {
    const { result } = renderHook(() => useDevModeEnabled());
    // renderHook 已在 act 上下文执行，useEffect 已触发
    expect(result.current.mounted).toBe(true);
    expect(result.current.enabled).toBe(false);
  });

  it("mount 后 mounted 为 true，开发环境 enabled 为 true", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { result } = renderHook(() => useDevModeEnabled());
    act(() => {
      // useEffect 在 renderHook 中已自动执行
    });
    expect(result.current.mounted).toBe(true);
    expect(result.current.enabled).toBe(true);
  });

  it("生产环境 mount 后 enabled 为 false", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { result } = renderHook(() => useDevModeEnabled());
    act(() => {
      // useEffect 在 renderHook 中已自动执行
    });
    expect(result.current.mounted).toBe(true);
    expect(result.current.enabled).toBe(false);
  });
});
