import { describe, it, expect } from "vitest";
import { getPropertyDef, getFurnitureItem, PROPERTY_DEFS, FURNITURE_ITEMS } from "../property-data";

describe("PROPERTY_DEFS", () => {
  it("has 5 property types", () => {
    expect(PROPERTY_DEFS).toHaveLength(5);
  });

  it("each property has required fields", () => {
    for (const p of PROPERTY_DEFS) {
      expect(p.type).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(typeof p.rentPrice).toBe("number");
    }
  });
});

describe("getPropertyDef", () => {
  it("finds property by type", () => {
    const result = getPropertyDef("apartment");
    expect(result).toBeDefined();
    expect(result?.name).toBe("蜗居小公寓");
  });

  it("returns undefined for unknown type", () => {
    expect(getPropertyDef("unknown")).toBeUndefined();
  });
});

describe("FURNITURE_ITEMS", () => {
  it("has 5 furniture items", () => {
    expect(FURNITURE_ITEMS).toHaveLength(5);
  });

  it("each item has required fields", () => {
    for (const f of FURNITURE_ITEMS) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(typeof f.price).toBe("number");
      expect(typeof f.comfort).toBe("number");
    }
  });
});

describe("getFurnitureItem", () => {
  it("finds furniture by id", () => {
    const result = getFurnitureItem("furniture_desk");
    expect(result).toBeDefined();
    expect(result?.name).toBe("书桌");
  });

  it("returns undefined for unknown id", () => {
    expect(getFurnitureItem("unknown")).toBeUndefined();
  });
});