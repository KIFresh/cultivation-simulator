import { describe, it, expect } from "vitest";
import { getSecretRealmById, rollSecretRealm, SECRET_REALMS } from "../secret-realm-data";

describe("secret-realm-data", () => {
  describe("getSecretRealmById", () => {
    it("should return the matching secret realm", () => {
      const realm = getSecretRealmById("realm_mist");
      expect(realm).not.toBeUndefined();
      expect(realm!.name).toBe("雾隐谷");
    });

    it("should return undefined for unknown id", () => {
      expect(getSecretRealmById("unknown")).toBeUndefined();
    });
  });

  describe("rollSecretRealm", () => {
    it("should return null if age is too low for all realms", () => {
      const realm = rollSecretRealm(5, "seed");
      expect(realm).toBeNull();
    });

    it("should return a reachable realm for sufficient age", () => {
      const realm = rollSecretRealm(14, "test-seed");
      expect(realm).not.toBeNull();
      expect(realm!.minAge).toBeLessThanOrEqual(14);
    });

    it("should be deterministic for same age and seed", () => {
      const r1 = rollSecretRealm(10, "deterministic");
      const r2 = rollSecretRealm(10, "deterministic");
      expect(r1!.id).toBe(r2!.id);
    });
  });
});
