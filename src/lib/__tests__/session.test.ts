import { describe, it, expect } from "vitest";
import { SESSION_COOKIE_NAME, signSession, verifySession } from "../session";

describe("SESSION_COOKIE_NAME", () => {
  it("is cs_session", () => {
    expect(SESSION_COOKIE_NAME).toBe("cs_session");
  });
});

describe("signSession", () => {
  it("returns a string with payload and signature separated by dot", () => {
    const token = signSession("user-1");
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(2);
  });
});

describe("verifySession", () => {
  it("verifies a valid token", () => {
    const token = signSession("user-1");
    const result = verifySession(token);
    expect(result).toBe("user-1");
  });

  it("verifies a valid token with complex userId", () => {
    const token = signSession("clx3abc123456789012345678");
    const result = verifySession(token);
    expect(result).toBe("clx3abc123456789012345678");
  });

  it("returns null for null token", () => {
    expect(verifySession(null)).toBeNull();
  });

  it("returns null for undefined token", () => {
    expect(verifySession(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(verifySession("")).toBeNull();
  });

  it("returns null for malformed token (no dot)", () => {
    expect(verifySession("no-dot-here")).toBeNull();
  });

  it("returns null for tampered payload", () => {
    const token = signSession("user-1");
    const parts = token.split(".");
    const tampered = `tampered.${parts[1]}`;
    expect(verifySession(tampered)).toBeNull();
  });

  it("returns null for tampered signature", () => {
    const token = signSession("user-1");
    const parts = token.split(".");
    const tampered = `${parts[0]}.tampered`;
    expect(verifySession(tampered)).toBeNull();
  });

  it("tokens for different users are distinct", () => {
    const t1 = signSession("user-1");
    const t2 = signSession("user-2");
    expect(t1).not.toBe(t2);
  });
});