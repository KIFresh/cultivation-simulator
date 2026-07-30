import { describe, it, expect } from "vitest";
import { getShopItems, getShopItemsForLocation } from "../shop";

describe("shop", () => {
  describe("getShopItems", () => {
    it("should return all shop items", () => {
      const items = getShopItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].itemId).toBeTruthy();
      expect(items[0].price).toBeGreaterThan(0);
    });
  });

  describe("getShopItemsForLocation", () => {
    it("should return location-specific items when available", () => {
      const items = getShopItemsForLocation("market");
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        expect(item.location).toBe("market");
      });
    });

    it("should fall back to general items for unknown location", () => {
      const items = getShopItemsForLocation("unknown_location");
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        expect(item.location).toBe("general");
      });
    });

    it("should return general items for location with no specific items", () => {
      const items = getShopItemsForLocation("general");
      expect(items.length).toBeGreaterThan(0);
    });
  });
});
