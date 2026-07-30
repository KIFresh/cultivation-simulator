import { describe, it, expect } from "vitest";
import { hashPassword } from "../auth";

describe("hashPassword", () => {
  it("returns hash and salt", () => {
    const result = hashPassword("my-password");
    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("salt");
    expect(result.hash.length).toBe(128); // 64 bytes hex
    expect(result.salt.length).toBe(32); // 16 bytes hex
  });

  it("produces different hashes for different passwords", () => {
    const r1 = hashPassword("password1");
    const r2 = hashPassword("password2");
    expect(r1.hash).not.toBe(r2.hash);
  });

  it("uses provided salt if given", () => {
    const salt = "a".repeat(32);
    const result = hashPassword("password", salt);
    expect(result.salt).toBe(salt);
    expect(result.hash).toBeTruthy();
  });

  it("same password + salt always produces same hash", () => {
    const salt = "b".repeat(32);
    const r1 = hashPassword("test", salt);
    const r2 = hashPassword("test", salt);
    expect(r1.hash).toBe(r2.hash);
  });
});