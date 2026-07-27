// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusBar from "@/components/status-bar";
import type { CultivatorData } from "@/app/dashboard/types";

const mockUseGameStore = vi.fn();

vi.mock("@/store", () => ({
  useGameStore: (selector: (s: unknown) => unknown) => mockUseGameStore(selector),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

const mockCultivator: CultivatorData = {
  id: "c1",
  name: "玄明",
  spiritualRoot: "天灵根",
  realm: "筑基期",
  realmLevel: 3,
  cultivationExp: 250,
  totalExp: 500,
  stamina: 80,
  age: 45,
  worldId: null,
  title: null,
  breakthroughCount: 2,
  location: "青云山",
  gold: 1000,
  maxAge: 100,
  bonusAge: 0,
  reincarnationCount: 0,
  talents: null,
  injuryDebuff: 0,
  health: 85,
  mindDemon: 12,
  attributes: {},
  unlockedLocations: null,
  occupation: null,
  gender: null,
  schoolRank: 0,
};

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染修炼者状态信息", () => {
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        cultivator: mockCultivator,
        gold: 1000,
        location: "青云山",
        canBreakthrough: false,
        breakthrough: vi.fn(),
        actionLoading: false,
      };
      return selector ? selector(state) : state;
    });
    render(<StatusBar />);
    expect(screen.getByText("筑基期")).toBeDefined();
    expect(screen.getByText("Lv.3")).toBeDefined();
    expect(screen.getByText("1000")).toBeDefined();
    expect(screen.getByText("青云山")).toBeDefined();
    expect(screen.getByText(/气血 85/)).toBeDefined();
    expect(screen.getByText(/心魔 12/)).toBeDefined();
    expect(screen.getByText(/45/)).toBeDefined();
  });

  it("cultivator 为 null 时显示默认值", () => {
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        cultivator: null,
        gold: 0,
        location: null,
        canBreakthrough: false,
        breakthrough: vi.fn(),
        actionLoading: false,
      };
      return selector ? selector(state) : state;
    });
    render(<StatusBar />);
    expect(screen.getByText("凡人")).toBeDefined();
    expect(screen.getByText("Lv.0")).toBeDefined();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1); // gold/health/mindDemon/age all 0
    expect(screen.getByText("未知")).toBeDefined(); // location
    expect(screen.getByText(/气血 0/)).toBeDefined();
    expect(screen.getByText(/心魔 0/)).toBeDefined();
  });

  it("canBreakthrough 为 true 时显示突破按钮", () => {
    const mockBreakthrough = vi.fn();
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        cultivator: mockCultivator,
        gold: 1000,
        location: "青云山",
        canBreakthrough: true,
        breakthrough: mockBreakthrough,
        actionLoading: false,
      };
      return selector ? selector(state) : state;
    });
    render(<StatusBar />);
    const btn = screen.getByText("突破");
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(mockBreakthrough).toHaveBeenCalledTimes(1);
  });
});