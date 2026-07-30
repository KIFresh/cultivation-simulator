import { describe, it, expect } from "vitest";
import { cn, sanitizeAttributes } from "../utils";

describe("cn 合并类名", () => {
  it("合并多个类名", () => {
    const result = cn("class1", "class2");
    expect(result).toContain("class1");
    expect(result).toContain("class2");
  });

  it("处理条件类名", () => {
    const result = cn("base", false && "hidden", "extra");
    expect(result).toContain("base");
    expect(result).toContain("extra");
    expect(result).not.toContain("hidden");
  });

  it("处理空输入", () => {
    expect(cn()).toBe("");
  });
});

describe("属性验证", () => {
  it("验证有效属性", () => {
    const result = sanitizeAttributes({ root: 10, spirit: 5.5 });
    expect(result).not.toBeNull();
    expect(result!.root).toBe(10);
    expect(result!.spirit).toBe(5.5);
  });

  it("忽略未知属性", () => {
    const result = sanitizeAttributes({ root: 10, hack: 999 });
    expect(result).not.toBeNull();
    expect(result!.hack).toBeUndefined();
  });

  it("拒绝负数", () => {
    expect(sanitizeAttributes({ root: -1 })).toBeNull();
  });

  it("拒绝超过上限", () => {
    expect(sanitizeAttributes({ root: 51 })).toBeNull();
  });

  it("拒绝非数字", () => {
    expect(sanitizeAttributes({ root: "abc" })).toBeNull();
  });

  it("拒绝Infinity", () => {
    expect(sanitizeAttributes({ root: Infinity })).toBeNull();
  });

  it("拒绝NaN", () => {
    expect(sanitizeAttributes({ root: NaN })).toBeNull();
  });

  it("接受null返回null", () => {
    expect(sanitizeAttributes(null)).toBeNull();
  });

  it("接受undefined返回null", () => {
    expect(sanitizeAttributes(undefined)).toBeNull();
  });

  it("空对象返回空对象", () => {
    const result = sanitizeAttributes({});
    expect(result).not.toBeNull();
    expect(Object.keys(result!).length).toBe(0);
  });

  it("保留一位小数", () => {
    const result = sanitizeAttributes({ root: 10.56 });
    expect(result!.root).toBe(10.6);
  });
});
