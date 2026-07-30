import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGameStore } from "../game-store";

// Mock dependencies
vi.mock("@/lib", () => ({
  getAvailableActions: vi.fn(() => []),
  canBreakthrough: vi.fn(() => false),
}));

vi.mock("@/lib/json-helper", () => ({
  safeJsonParse: vi.fn((raw: string | null | undefined, fallback: any) => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }),
}));

vi.mock("@/lib/sse-client", () => ({
  consumeNarrativeStream: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
if (typeof window === "undefined") {
  // @ts-ignore
  global.window = { localStorage: mockLocalStorage };
}

const mockCultivatorData = {
  id: "c1",
  name: "测试修行者",
  spiritualRoot: "gold",
  realm: "凡人",
  realmLevel: 0,
  cultivationExp: 0,
  totalExp: 0,
  stamina: 20,
  age: 10,
  worldId: "earth",
  title: null,
  breakthroughCount: 0,
  location: "home",
  gold: 100,
  maxAge: null,
  bonusAge: 0,
  reincarnationCount: 0,
  talents: null,
  injuryDebuff: 0,
  health: 100,
  mindDemon: 0,
  attributes: null,
  attributeExp: null,
  subjectExp: null,
  storyEntries: null,
  inventory: null,
  npcRelations: null,
  unlockedLocations: null,
  occupation: null,
  gender: null,
  schoolRank: 0,
  clique: null,
  examResults: null,
  milestones: null,
  pet: null,
  classEnroll: null,
  savings: null,
  arcadeStats: null,
  readingLog: null,
  breakthroughBuff: 0,
};

describe("game-store", () => {
  beforeEach(() => {
    useGameStore.setState({
      userId: null,
      cultivator: null,
      availableActions: [],
      actionLoading: false,
      canBreakthrough: false,
      inventory: [],
      gold: 0,
      narrative: null,
      streamingText: null,
      narrativeError: null,
      narrativeRetrying: false,
      location: null,
      unlockedLocations: null,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial values", () => {
      const state = useGameStore.getState();
      expect(state.userId).toBeNull();
      expect(state.cultivator).toBeNull();
      expect(state.actionLoading).toBe(false);
      expect(state.gold).toBe(0);
      expect(state.inventory).toEqual([]);
      expect(state.narrative).toBeNull();
      expect(state.streamingText).toBeNull();
      expect(state.narrativeError).toBeNull();
      expect(state.narrativeRetrying).toBe(false);
      expect(state.location).toBeNull();
    });
  });

  describe("setUserId", () => {
    it("should set userId", () => {
      useGameStore.getState().setUserId("user-abc");
      expect(useGameStore.getState().userId).toBe("user-abc");
    });

    it("should set userId to null", () => {
      useGameStore.getState().setUserId("user-abc");
      useGameStore.getState().setUserId(null);
      expect(useGameStore.getState().userId).toBeNull();
    });
  });

  describe("setCultivator", () => {
    it("should reset all derived fields when data is null", () => {
      useGameStore.setState({
        gold: 500,
        location: "school",
        inventory: [{ itemId: "herb_qi", quantity: 1, equipped: false }],
      });
      useGameStore.getState().setCultivator(null);
      const state = useGameStore.getState();
      expect(state.cultivator).toBeNull();
      expect(state.gold).toBe(0);
      expect(state.inventory).toEqual([]);
      expect(state.location).toBeNull();
    });

    it("should merge partial data into existing cultivator", () => {
      useGameStore.setState({ cultivator: { ...mockCultivatorData } as any });
      useGameStore.getState().setCultivator({ gold: 999, stamina: 50 });
      expect(useGameStore.getState().gold).toBe(999);
    });
  });

  describe("loadCultivator", () => {
    it("should not fetch for empty userId", async () => {
      await useGameStore.getState().loadCultivator("");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch cultivator data and update state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cultivator: {
            id: "c1",
            name: "测试",
            realm: "凡人",
            age: 10,
            gold: 200,
            stamina: 30,
            location: "school",
          },
        }),
      });

      await useGameStore.getState().loadCultivator("user-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/cultivator?userId=user-1")
      );
    });

    it("should silently fail on fetch error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      useGameStore.setState({ cultivator: mockCultivatorData as any });
      await useGameStore.getState().loadCultivator("user-1");
      // State should remain unchanged
      expect(useGameStore.getState().cultivator).toBeTruthy();
    });
  });

  describe("bootstrap", () => {
    it("should do nothing when window is undefined", () => {
      // @ts-ignore
      const origWindow = global.window;
      // @ts-ignore
      delete global.window;
      useGameStore.getState().bootstrap();
      expect(useGameStore.getState().userId).toBeNull();
      // @ts-ignore
      global.window = origWindow;
    });
  });

  describe("performAction", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().performAction("meditate")).rejects.toThrow("未找到用户");
    });

    it("should set loading state, fetch, and clear loading", async () => {
      useGameStore.getState().setUserId("user-1");
      useGameStore.setState({ cultivator: mockCultivatorData as any });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          narrative: { title: "修炼", narrative: "你静心修炼", mood: "专注" },
          cultivator: mockCultivatorData,
        }),
      });

      await useGameStore.getState().performAction("meditate");
      expect(useGameStore.getState().actionLoading).toBe(false);
    });

    it("should handle fetch error", async () => {
      useGameStore.getState().setUserId("user-1");
      useGameStore.setState({ cultivator: mockCultivatorData as any });

      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      await useGameStore.getState().performAction("meditate");
      expect(useGameStore.getState().actionLoading).toBe(false);
      expect(useGameStore.getState().narrativeError).toBeTruthy();
    });
  });

  describe("breakthrough", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().breakthrough()).rejects.toThrow("未找到用户");
    });

    it("should call breakthrough API", async () => {
      useGameStore.getState().setUserId("user-1");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          canBreakthrough: true,
          cultivator: { ...mockCultivatorData, realm: "炼气期" },
        }),
      });

      await useGameStore.getState().breakthrough();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/breakthrough"),
        expect.any(Object)
      );
    });
  });

  describe("advanceQuarter", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().advanceQuarter()).rejects.toThrow("未找到用户");
    });

    it("should handle 409 conflict response", async () => {
      useGameStore.getState().setUserId("user-1");
      mockFetch.mockResolvedValueOnce({ status: 409, ok: false });

      await useGameStore.getState().advanceQuarter();
      expect(useGameStore.getState().narrativeError).toBeTruthy();
    });

    it("should handle daoXiao response", async () => {
      useGameStore.getState().setUserId("user-1");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ daoXiao: true, summary: { age: 99 } }),
      });

      await useGameStore.getState().advanceQuarter();
      expect(useGameStore.getState().narrativeError).toBeTruthy();
    });
  });

  describe("useItem", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().useItem("herb_qi")).rejects.toThrow("未找到用户");
    });

    it("should call use-item API", async () => {
      useGameStore.getState().setUserId("user-1");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cultivator: { ...mockCultivatorData, gold: 90 } }),
      });

      await useGameStore.getState().useItem("herb_qi", 1);
      expect(useGameStore.getState().actionLoading).toBe(false);
    });
  });

  describe("retryNarrative", () => {
    it("should do nothing when lastRequest is null", async () => {
      await useGameStore.getState().retryNarrative();
      expect(useGameStore.getState().narrativeRetrying).toBe(false);
    });

    it("should retry the last request", async () => {
      useGameStore.getState().setUserId("user-1");
      // First perform an action to set lastRequest
      useGameStore.setState({ cultivator: mockCultivatorData as any });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ narrative: { title: "test", narrative: "text", mood: "calm" } }),
      });
      await useGameStore.getState().performAction("meditate");

      // Now retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          narrative: { title: "retry", narrative: "retry text", mood: "calm" },
        }),
      });

      await useGameStore.getState().retryNarrative();
      expect(useGameStore.getState().narrativeRetrying).toBe(false);
    });
  });

  describe("setLocation", () => {
    it("should update location locally", () => {
      useGameStore.setState({ cultivator: mockCultivatorData as any });
      useGameStore.getState().setLocation("school");
      expect(useGameStore.getState().location).toBe("school");
    });

    it("should call PATCH API when userId is set", async () => {
      useGameStore.getState().setUserId("user-1");
      useGameStore.setState({ cultivator: mockCultivatorData as any });
      mockFetch.mockResolvedValueOnce({ ok: true });

      await useGameStore.getState().setLocation("school");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/cultivator"),
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });
  });
});
