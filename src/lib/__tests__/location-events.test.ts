import { describe, it, expect } from "vitest";
import {
  rollLocationEvent,
  addAttrExp,
  makeLocationNpcStub,
  LOCATION_EVENT_POOL,
  type AttrExpMap,
} from "../location-events";

describe("LOCATION_EVENT_POOL", () => {
  it("应包含所有预期地点", () => {
    const locations = ["home", "market", "mountain", "school", "clinic"];
    for (const loc of locations) {
      expect(LOCATION_EVENT_POOL[loc]).toBeDefined();
      expect(LOCATION_EVENT_POOL[loc].length).toBeGreaterThan(0);
    }
  });

  it("每个事件应有 id, title, minAge, effects", () => {
    for (const events of Object.values(LOCATION_EVENT_POOL)) {
      for (const ev of events) {
        expect(ev.id).toBeTruthy();
        expect(typeof ev.title).toBe("string");
        expect(typeof ev.minAge).toBe("number");
        expect(ev.effects).toBeDefined();
      }
    }
  });
});

describe("rollLocationEvent", () => {
  it("同 cultivatorId + locationId + dayKey 应返回相同结果", () => {
    const a = rollLocationEvent("c1", "home", 10, "day1");
    const b = rollLocationEvent("c1", "home", 10, "day1");
    expect(a).toEqual(b);
  });

  it("不同 dayKey 可能返回不同事件", () => {
    const a = rollLocationEvent("c1", "home", 10, "day1");
    const b = rollLocationEvent("c1", "home", 10, "day2");
    // 至少有一个非 null
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it("年龄小于 minAge 时不应返回该事件", () => {
    // home 的事件 minAge 为 1 和 3，所以 age=0 也能匹配
    // 但 market 的事件 minAge 为 6 和 8，age=0 应返回 null
    const result = rollLocationEvent("x", "market", 0, "d1");
    expect(result).toBeNull();
  });

  it("不存在的地点应返回 null", () => {
    expect(rollLocationEvent("c1", "nonexistent", 10, "d1")).toBeNull();
  });
});

describe("addAttrExp", () => {
  it("应叠加经验并计算等级", () => {
    const current: AttrExpMap = { insight: { exp: 50, level: 0 } };
    const result = addAttrExp(current, { insight: 60 });
    expect(result.insight.exp).toBe(110);
    expect(result.insight.level).toBe(1);
  });

  it("新属性应自动初始化", () => {
    const result = addAttrExp({}, { luck: 30 });
    expect(result.luck.exp).toBe(30);
    expect(result.luck.level).toBe(0);
  });

  it("不应修改原对象", () => {
    const current: AttrExpMap = { mind: { exp: 10, level: 0 } };
    const copy = { ...current };
    addAttrExp(current, { mind: 5 });
    expect(current.mind.exp).toBe(10); // 原对象不变
  });
});

describe("makeLocationNpcStub", () => {
  it("应返回包含 npcId、locationId、metAtAge 的对象", () => {
    const stub = makeLocationNpcStub("hermit", "mountain", 8);
    expect(stub.npcId).toBe("hermit");
    expect(stub.locationId).toBe("mountain");
    expect(stub.metAtAge).toBe(8);
    expect(stub.affinity).toBe(0);
  });
});
