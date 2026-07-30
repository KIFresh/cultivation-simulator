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
if (typeof window === "undefined") {
  (global as any).window = { localStorage: { getItem: vi.fn(), setItem: vi.fn() } };
}

describe("game-store-stream", () => {
  beforeEach(() => {
    // Reset store state
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

  describe("setUserId", () => {
    it("should set userId", () => {
      useGameStore.getState().setUserId("test-user");
      expect(useGameStore.getState().userId).toBe("test-user");
    });
  });

  describe("setCultivator", () => {
    it("should reset state when data is null", () => {
      useGameStore.getState().setCultivator(null);
      const state = useGameStore.getState();
      expect(state.cultivator).toBeNull();
      expect(state.gold).toBe(0);
    });
  });

  describe("loadCultivator", () => {
    it("should not fetch when userId is empty", async () => {
      await useGameStore.getState().loadCultivator("");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch and update state on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cultivator: {
            id: "c1",
            name: "测试",
            realm: "凡人",
            age: 10,
            gold: 100,
            stamina: 20,
            location: "home",
          },
        }),
      });

      await useGameStore.getState().loadCultivator("user-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/cultivator"));
    });
  });

  describe("performAction", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().performAction("meditate")).rejects.toThrow("未找到用户");
    });

    it("should set loading state and call fetch", async () => {
      useGameStore.getState().setUserId("user-1");
      useGameStore.setState({
        cultivator: {
          id: "c1",
          name: "测试",
          realm: "凡人",
          age: 10,
          gold: 100,
          stamina: 20,
          location: "home",
          realmLevel: 0,
          cultivationExp: 0,
          totalExp: 0,
          health: 100,
          mindDemon: 0,
          spiritualRoot: "gold",
          worldId: "earth",
          title: null,
          breakthroughCount: 0,
          maxAge: null,
          bonusAge: 0,
          reincarnationCount: 0,
          talents: null,
          injuryDebuff: 0,
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
        } as any,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ narrative: { title: "test", narrative: "text", mood: "calm" } }),
      });

      const promise = useGameStore.getState().performAction("meditate");
      expect(useGameStore.getState().actionLoading).toBe(true);
      await promise;
      expect(useGameStore.getState().actionLoading).toBe(false);
    });
  });

  describe("advanceQuarter", () => {
    it("should throw when userId is not set", async () => {
      await expect(useGameStore.getState().advanceQuarter()).rejects.toThrow("未找到用户");
    });

    it("should handle 409 conflict", async () => {
      useGameStore.getState().setUserId("user-1");
      mockFetch.mockResolvedValueOnce({ status: 409, ok: false });

      await useGameStore.getState().advanceQuarter();
      expect(useGameStore.getState().narrativeError).toBeTruthy();
    });
  });

  describe("setLocation", () => {
    it("should update location locally", () => {
      useGameStore.getState().setLocation("school");
      expect(useGameStore.getState().location).toBe("school");
    });
  });
});
