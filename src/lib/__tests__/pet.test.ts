import { describe, it, expect } from "vitest";
import { parsePet, rollPet, growPet, getPetAcquireInfo, PET_ACQUIRE_AGE } from "../pet";

describe("pet", () => {
  describe("parsePet", () => {
    it("should return null for null/undefined/empty", () => {
      expect(parsePet(null)).toBeNull();
      expect(parsePet(undefined)).toBeNull();
      expect(parsePet("")).toBeNull();
    });

    it("should parse valid pet JSON", () => {
      const raw = JSON.stringify({
        type: "cat",
        name: "橘灯",
        intimacy: 50,
        petAge: 2,
        acquiredAge: 6,
      });
      const pet = parsePet(raw);
      expect(pet).not.toBeNull();
      expect(pet!.type).toBe("cat");
      expect(pet!.name).toBe("橘灯");
      expect(pet!.intimacy).toBe(50);
    });

    it("should return null for invalid JSON", () => {
      expect(parsePet("not-json")).toBeNull();
    });
  });

  describe("rollPet", () => {
    it("should create a pet with default values", () => {
      const pet = rollPet("player-1", PET_ACQUIRE_AGE);
      expect(pet.intimacy).toBe(50);
      expect(pet.petAge).toBe(0);
      expect(pet.acquiredAge).toBe(PET_ACQUIRE_AGE);
      expect(["cat", "dog", "rabbit", "bird", "turtle"]).toContain(pet.type);
      expect(pet.name).toBeTruthy();
    });

    it("should be deterministic for same id and age", () => {
      const p1 = rollPet("test-id", 6);
      const p2 = rollPet("test-id", 6);
      expect(p1.type).toBe(p2.type);
      expect(p1.name).toBe(p2.name);
    });
  });

  describe("growPet", () => {
    it("should increase petAge and intimacy", () => {
      const pet = { type: "dog" as const, name: "旺财", intimacy: 50, petAge: 1, acquiredAge: 6 };
      const grown = growPet(pet);
      expect(grown.petAge).toBe(2);
      expect(grown.intimacy).toBe(52);
    });

    it("should clamp intimacy to 100", () => {
      const pet = { type: "cat" as const, name: "雪球", intimacy: 99, petAge: 5, acquiredAge: 6 };
      const grown = growPet(pet);
      expect(grown.intimacy).toBe(100);
    });
  });

  describe("getPetAcquireInfo", () => {
    it("should return info for known pet type", () => {
      const info = getPetAcquireInfo({
        type: "cat",
        name: "橘灯",
        intimacy: 50,
        petAge: 0,
        acquiredAge: 6,
      });
      expect(info.icon).toBe("🐱");
      expect(info.label).toBe("猫");
      expect(info.name).toBe("橘灯");
    });
  });
});
