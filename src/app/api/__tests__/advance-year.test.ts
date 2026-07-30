import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../api/advance-year/route";

function makeRequest(): NextRequest {
  return {
    json: () => Promise.resolve({}),
    headers: new Map(),
  } as unknown as NextRequest;
}

describe("POST /api/advance-year (deprecated)", () => {
  it("应返回 410 Gone", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("GONE_ADVANCE_YEAR");
  });

  it("应提示使用 advance-quarter 替代", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.error).toContain("/api/advance-quarter");
  });
});
