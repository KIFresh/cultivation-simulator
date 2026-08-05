// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("lucide-react", () => ({
  X: () => <span>✕</span>,
  XIcon: () => <span>✕</span>,
  Loader2: () => <span>⏳</span>,
  BookOpen: () => <span>📖</span>,
  ChevronDown: () => <span>▼</span>,
  ChevronUp: () => <span>▲</span>,
  Sword: () => <span>⚔️</span>,
  Zap: () => <span>⚡</span>,
}));

vi.mock("@/lib", () => ({
  getTechniqueById: (id: string) => {
    const map: Record<string, any> = {
      basic_breathing: {
        id: "basic_breathing",
        name: "吐纳术",
        icon: "📖",
        description: "基础功法",
        maxLevel: 10,
      },
      sword_foundation: {
        id: "sword_foundation",
        name: "基础剑诀",
        icon: "⚔️",
        description: "剑术基础",
        maxLevel: 10,
      },
    };
    return map[id] || null;
  },
  TECHNIQUES: [
    {
      id: "basic_breathing",
      name: "吐纳术",
      icon: "📖",
      description: "基础功法",
      maxLevel: 10,
      minRealm: "凡人",
      baseProficiency: 1,
    },
    {
      id: "sword_foundation",
      name: "基础剑诀",
      icon: "⚔️",
      description: "剑术基础",
      maxLevel: 10,
      minRealm: "炼气期",
      baseProficiency: 1,
    },
  ],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockTechniques = [
  { id: "t1", techniqueId: "basic_breathing", equipSlot: 1, level: 3, proficiency: 50 },
  { id: "t2", techniqueId: "sword_foundation", equipSlot: null, level: 1, proficiency: 10 },
];

import TechniquePanel from "../technique-panel";

describe("TechniquePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/api/cultivator/techniques")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              techniques: mockTechniques,
              allTechniques: {
                basic_breathing: {
                  id: "basic_breathing",
                  name: "吐纳术",
                  icon: "📖",
                  description: "基础功法",
                  maxLevel: 10,
                  grade: "黄阶",
                  realm: "凡人",
                  upgradeProficiency: [100, 200, 300],
                  effects: [],
                },
                sword_foundation: {
                  id: "sword_foundation",
                  name: "基础剑诀",
                  icon: "⚔️",
                  description: "剑术基础",
                  maxLevel: 10,
                  grade: "黄阶",
                  realm: "炼气期",
                  upgradeProficiency: [100, 200, 300],
                  effects: [],
                },
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;
  });

  const baseProps = { cultivatorId: "c1", open: true, onOpenChange: vi.fn() };

  it("open=true时渲染", async () => {
    render(<TechniquePanel {...baseProps} />);
    expect(await screen.findByText("吐纳术", {}, { timeout: 3000 })).toBeDefined();
  });

  it("open=false时不渲染", () => {
    const { container } = render(<TechniquePanel {...baseProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("显示功法列表", async () => {
    render(<TechniquePanel {...baseProps} />);
    expect(await screen.findByText("吐纳术", {}, { timeout: 3000 })).toBeDefined();
    expect(await screen.findByText("基础剑诀", {}, { timeout: 3000 })).toBeDefined();
  });
});
