import { describe, it, expect, vi } from "vitest";
import {
  isValidUserId,
  apiError,
  parseBody,
  requireFields,
  sanitizeString,
  clampInt,
  safeJsonParse,
} from "../auth-helpers";

describe("auth-helpers", () => {
  describe("isValidUserId", () => {
    it("should return true for valid CUID-like string", () => {
      expect(isValidUserId("clx3abc12345678901234567890")).toBe(true);
    });

    it("should return false for non-string or invalid format", () => {
      expect(isValidUserId(123)).toBe(false);
      expect(isValidUserId("")).toBe(false);
      expect(isValidUserId("short")).toBe(false);
    });
  });

  describe("apiError", () => {
    it("should return a NextResponse with correct status and error message", () => {
      const res = apiError("test error", 400);
      expect(res.status).toBe(400);
    });

    it("should include code when provided", () => {
      const res = apiError("not found", 404, "NOT_FOUND");
      expect(res.status).toBe(404);
    });
  });

  describe("parseBody", () => {
    it("should parse JSON body successfully", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
        headers: { "Content-Type": "application/json" },
      });
      const result = await parseBody(req);
      expect(result).toEqual({ key: "value" });
    });

    it("should return null for invalid JSON", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      });
      const result = await parseBody(req);
      expect(result).toBeNull();
    });

    it("should return null for array body", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      });
      const result = await parseBody(req);
      expect(result).toBeNull();
    });
  });

  describe("requireFields", () => {
    it("should return null when all fields present", () => {
      expect(requireFields({ a: 1, b: "x" }, ["a", "b"])).toBeNull();
    });

    it("should return error message for missing field", () => {
      const err = requireFields({ a: 1 }, ["a", "b"]);
      expect(err).toContain("缺少必填参数");
      expect(err).toContain("b");
    });

    it("should treat empty string as missing", () => {
      const err = requireFields({ a: "" }, ["a"]);
      expect(err).toContain("缺少必填参数");
    });
  });

  describe("sanitizeString", () => {
    it("should trim and return string", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("should return null for non-string", () => {
      expect(sanitizeString(123)).toBeNull();
    });

    it("should truncate to maxLength", () => {
      const long = "a".repeat(1000);
      const result = sanitizeString(long, 10);
      expect(result).toBe("a".repeat(10));
    });

    it("should return null for empty after trim", () => {
      expect(sanitizeString("   ")).toBeNull();
    });
  });

  describe("clampInt", () => {
    it("should clamp value within range", () => {
      expect(clampInt(50, 0, 100, 0)).toBe(50);
      expect(clampInt(-5, 0, 100, 0)).toBe(0);
      expect(clampInt(200, 0, 100, 0)).toBe(100);
    });

    it("should return fallback for invalid input", () => {
      expect(clampInt(NaN, 0, 100, 42)).toBe(42);
      expect(clampInt("abc", 0, 100, 10)).toBe(10);
    });
  });

  describe("safeJsonParse", () => {
    it("should parse valid JSON", () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it("should return fallback for invalid JSON", () => {
      expect(safeJsonParse("{invalid}", { fallback: true })).toEqual({ fallback: true });
    });

    it("should return fallback for null/undefined", () => {
      expect(safeJsonParse(null, 42)).toBe(42);
      expect(safeJsonParse(undefined, "default")).toBe("default");
    });
  });
});
