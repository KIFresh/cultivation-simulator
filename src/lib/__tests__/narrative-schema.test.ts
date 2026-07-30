import { describe, it, expect } from "vitest";
import {
  NARRATIVE_EFFECT_WHITELISTS,
  checkEffectWhitelist,
  parseNarrativeResponse,
  parseAndValidateEffects,
  DailyCultivationSchema,
  BreakthroughSchema,
  EncounterSchema,
  NPCDialogueSchema,
  FamilyDialogueSchema,
  ActionSchema,
  BirthNarrativeSchema,
  YearAdvanceSchema,
  NarrativeResponseSchema,
} from "../narrative-schema";

const validDailyCultivation = {
  type: "DAILY_CULTIVATION",
  title: "晨练",
  narrative: "你在山中打坐。",
  mood: "平静",
  summary: "完成晨练",
  effects: [{ kind: "gold", delta: 10 }],
};

const validBreakthrough = {
  type: "BREAKTHROUGH",
  title: "突破",
  narrative: "你突破了！",
  mood: "激动",
  summary: "突破成功",
};

const validEncounter = {
  type: "ENCOUNTER",
  title: "奇遇",
  narrative: "你遇到一个神秘人。",
  mood: "好奇",
  summary: "遇到神秘人",
  choices: [{ text: "上前搭话", risk: "low" }],
};

const validBirth = {
  type: "BIRTH",
  title: "出生",
  narrative: "你出生了。",
  mood: "喜悦",
  summary: "新生命",
  family: [{ relation: "母亲", name: "王母", age: 30, alive: true }],
};

describe("NARRATIVE_EFFECT_WHITELISTS", () => {
  it("BIRTH has empty whitelist", () => {
    expect(NARRATIVE_EFFECT_WHITELISTS.BIRTH).toEqual([]);
  });

  it("DAILY_CULTIVATION allows gold, stamina, attrExp, storyEntry, mood", () => {
    expect(NARRATIVE_EFFECT_WHITELISTS.DAILY_CULTIVATION).toEqual([
      "gold", "stamina", "attrExp", "storyEntry", "mood",
    ]);
  });

  it("NPC_DIALOGUE includes intimacy", () => {
    expect(NARRATIVE_EFFECT_WHITELISTS.NPC_DIALOGUE).toContain("intimacy");
  });
});

describe("checkEffectWhitelist", () => {
  it("returns empty array when all effects are whitelisted", () => {
    const result = checkEffectWhitelist(
      [{ kind: "gold", delta: 10 }],
      ["gold", "stamina"] as any
    );
    expect(result).toEqual([]);
  });

  it("returns denied kinds for non-whitelisted effects", () => {
    const result = checkEffectWhitelist(
      [{ kind: "health", delta: 5 }],
      ["gold", "stamina"] as any
    );
    expect(result).toEqual(["health"]);
  });

  it("returns multiple denied kinds", () => {
    const result = checkEffectWhitelist(
      [
        { kind: "gold", delta: 10 },
        { kind: "health", delta: 5 },
        { kind: "intimacy", delta: 3 },
      ],
      ["gold"] as any
    );
    expect(result).toEqual(["health", "intimacy"]);
  });

  it("returns empty array for empty effects", () => {
    const result = checkEffectWhitelist([], ["gold"] as any);
    expect(result).toEqual([]);
  });
});

describe("DailyCultivationSchema", () => {
  it("parses valid daily cultivation", () => {
    const result = DailyCultivationSchema.safeParse(validDailyCultivation);
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = DailyCultivationSchema.safeParse({ ...validDailyCultivation, title: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects long title", () => {
    const result = DailyCultivationSchema.safeParse({ ...validDailyCultivation, title: "x".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("rejects strict mode extra fields", () => {
    const result = DailyCultivationSchema.safeParse({ ...validDailyCultivation, extraField: true });
    expect(result.success).toBe(false);
  });
});

describe("BreakthroughSchema", () => {
  it("parses valid breakthrough", () => {
    const result = BreakthroughSchema.safeParse(validBreakthrough);
    expect(result.success).toBe(true);
  });
});

describe("EncounterSchema", () => {
  it("parses valid encounter with choices", () => {
    const result = EncounterSchema.safeParse(validEncounter);
    expect(result.success).toBe(true);
  });

  it("rejects encounter without choices", () => {
    const result = EncounterSchema.safeParse({ ...validEncounter, choices: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid risk level", () => {
    const result = EncounterSchema.safeParse({
      ...validEncounter,
      choices: [{ text: "test", risk: "extreme" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("BirthNarrativeSchema", () => {
  it("parses valid birth narrative with family", () => {
    const result = BirthNarrativeSchema.safeParse(validBirth);
    expect(result.success).toBe(true);
  });

  it("parses birth narrative without family", () => {
    const result = BirthNarrativeSchema.safeParse({
      ...validBirth,
      family: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid family member age", () => {
    const result = BirthNarrativeSchema.safeParse({
      ...validBirth,
      family: [{ relation: "母亲", name: "王母", age: 200, alive: true }],
    });
    expect(result.success).toBe(false);
  });
});

describe("NarrativeResponseSchema (discriminated union)", () => {
  it("parses daily cultivation", () => {
    const result = NarrativeResponseSchema.safeParse(validDailyCultivation);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("DAILY_CULTIVATION");
  });

  it("parses breakthrough", () => {
    const result = NarrativeResponseSchema.safeParse(validBreakthrough);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("BREAKTHROUGH");
  });

  it("parses encounter", () => {
    const result = NarrativeResponseSchema.safeParse(validEncounter);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("ENCOUNTER");
  });

  it("rejects unknown type", () => {
    const result = NarrativeResponseSchema.safeParse({
      ...validDailyCultivation,
      type: "UNKNOWN_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-object", () => {
    const result = NarrativeResponseSchema.safeParse("string");
    expect(result.success).toBe(false);
  });
});

describe("parseNarrativeResponse", () => {
  it("returns success for valid data", () => {
    const result = parseNarrativeResponse(validDailyCultivation);
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
  });

  it("returns errors for null", () => {
    const result = parseNarrativeResponse(null);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("returns errors for non-object", () => {
    const result = parseNarrativeResponse(42);
    expect(result.success).toBe(false);
    expect(result.errors).toContain("响应不是有效的 JSON 对象");
  });

  it("returns detailed errors for schema violation", () => {
    const result = parseNarrativeResponse({ type: "DAILY_CULTIVATION" });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("title");
  });
});

describe("parseAndValidateEffects", () => {
  it("returns success with no whitelist errors for valid data", () => {
    const result = parseAndValidateEffects(validDailyCultivation, "DAILY_CULTIVATION");
    expect(result.parseResult.success).toBe(true);
    expect(result.whitelistErrors).toEqual([]);
  });

  it("returns whitelist errors for BIRTH with effects", () => {
    const result = parseAndValidateEffects(
      { ...validBirth, effects: [{ kind: "gold", delta: 10 }] },
      "BIRTH"
    );
    expect(result.parseResult.success).toBe(true);
    expect(result.whitelistErrors).toHaveLength(1);
    expect(result.whitelistErrors[0]).toContain("gold");
    expect(result.whitelistErrors[0]).toContain("BIRTH");
  });

  it("returns empty whitelist errors for unknown narrative type", () => {
    const result = parseAndValidateEffects(validDailyCultivation, "UNKNOWN");
    expect(result.parseResult.success).toBe(true);
    expect(result.whitelistErrors).toEqual([]);
  });

  it("returns parse errors when data is invalid", () => {
    const result = parseAndValidateEffects(null, "DAILY_CULTIVATION");
    expect(result.parseResult.success).toBe(false);
    expect(result.whitelistErrors).toEqual([]);
  });
});