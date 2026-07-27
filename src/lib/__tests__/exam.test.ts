import { describe, it, expect } from "vitest";
import {
  EXAM_EVENTS,
  pickExamEvent,
  MORTAL_EVENTS,
  DINNER_EVENTS,
  FESTIVAL_EVENTS,
} from "../mortal-events";

const ATTR_KEYS = ["root", "spirit", "insight", "luck", "charm", "mind", "health"];

describe("pickExamEvent 年龄分层", () => {
  it("学龄前（<7）返回 null", () => {
    expect(pickExamEvent(6)).toBeNull();
  });
  it("小学段（7-12）返回 7-12 池事件", () => {
    for (const age of [7, 9, 11, 12]) {
      const e = pickExamEvent(age);
      expect(e).not.toBeNull();
      expect(e!.ageBand).toBe("7-12");
    }
  });
  it("初中段（13-15）返回 13-15 池事件", () => {
    for (const age of [13, 14, 15]) {
      const e = pickExamEvent(age);
      expect(e).not.toBeNull();
      expect(e!.ageBand).toBe("13-15");
    }
  });
  it("学龄后（>=16）返回 null", () => {
    expect(pickExamEvent(16)).toBeNull();
    expect(pickExamEvent(20)).toBeNull();
  });
  it("exclude 排除同池全部后回退到全池（仍返回其一）", () => {
    const all = EXAM_EVENTS.filter((e) => e.ageBand === "7-12").map((e) => e.id);
    const e = pickExamEvent(10, all);
    expect(e).not.toBeNull();
    expect(e!.ageBand).toBe("7-12");
  });
});

describe("EXAM_EVENTS 结构合法", () => {
  it("每个事件至少 2 个选项", () => {
    for (const e of EXAM_EVENTS) {
      expect(e.options.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("每个选项 effects 键在白名单内", () => {
    for (const e of EXAM_EVENTS) {
      for (const o of e.options) {
        for (const k of Object.keys(o.effects)) {
          expect(ATTR_KEYS).toContain(k);
        }
      }
    }
  });
  it("familyEffects.parentIntimacy 若存在则为 number", () => {
    for (const e of EXAM_EVENTS) {
      for (const o of e.options) {
        if (o.familyEffects?.parentIntimacy !== undefined) {
          expect(typeof o.familyEffects.parentIntimacy).toBe("number");
        }
      }
    }
  });
  it("id 全局唯一（不与日常/饭桌/节日池撞车，避免 resolve-event 误匹配）", () => {
    const total =
      MORTAL_EVENTS.length +
      DINNER_EVENTS.length +
      FESTIVAL_EVENTS.length +
      EXAM_EVENTS.length;
    const allIds = new Set(
      [...MORTAL_EVENTS, ...DINNER_EVENTS, ...FESTIVAL_EVENTS, ...EXAM_EVENTS].map(
        (e) => e.id,
      ),
    );
    expect(allIds.size).toBe(total);
  });
  it("考试/家长会事件覆盖小学与初中两段", () => {
    const bands = new Set(EXAM_EVENTS.map((e) => e.ageBand));
    expect(bands.has("7-12")).toBe(true);
    expect(bands.has("13-15")).toBe(true);
  });
});
