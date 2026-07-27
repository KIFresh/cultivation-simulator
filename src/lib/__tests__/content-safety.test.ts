import {
  scanText,
  guardUserPrompt,
  checkNarrativeSafe,
  safeReturn,
  ContentBlockedError,
} from "../content-safety";
import { describe, it, expect } from "vitest";

describe("scanText — 基础扫描", () => {
  it("正常修仙叙事不命中", () => {
    const r = scanText("他盘膝而坐，灵力在经脉中缓缓流转，周身泛起淡淡光芒。");
    expect(r.blocked).toBe(false);
  });

  it("空文本 / 纯空白不命中且不抛错", () => {
    expect(scanText("").blocked).toBe(false);
    expect(scanText("   \n ").blocked).toBe(false);
    expect(scanText(null as unknown as string).blocked).toBe(false);
  });

  it("大小写不敏感", () => {
    const r = scanText("聊聊 PORN 内容");
    expect(r.blocked).toBe(true);
    expect(r.category).toBe("porn");
  });
});

describe("scanText — 各档命中", () => {
  it("辱骂档 medium 命中", () => {
    const r = scanText("你就是个傻逼");
    expect(r.blocked).toBe(true);
    expect(r.level).toBe("medium");
    expect(r.category).toBe("insult");
  });

  it("暴力档 high 命中", () => {
    const r = scanText("我要杀光你们所有人");
    expect(r.blocked).toBe(true);
    expect(r.level).toBe("high");
    expect(r.category).toBe("violence");
  });

  it("自残档 high 命中", () => {
    const r = scanText("我想自残");
    expect(r.blocked).toBe(true);
    expect(r.level).toBe("high");
    expect(r.category).toBe("selfharm");
  });

  it("赌博档 high 命中", () => {
    const r = scanText("一起玩网络赌博吧");
    expect(r.blocked).toBe(true);
    expect(r.level).toBe("high");
  });

  it("色情档 critical 命中", () => {
    const r = scanText("我们裸聊吧");
    expect(r.blocked).toBe(true);
    expect(r.level).toBe("critical");
    expect(r.category).toBe("porn");
  });

  it("政治档留空不命中（由运营补充）", () => {
    const r = scanText("某个政治人物的传闻");
    expect(r.blocked).toBe(false);
  });
});

describe("scanText — minLevel 阈值", () => {
  it("minLevel=critical 时辱骂不拦截", () => {
    const r = scanText("你就是个傻逼", { minLevel: "critical" });
    expect(r.blocked).toBe(false);
  });

  it("minLevel=critical 时色情仍拦截", () => {
    const r = scanText("裸聊", { minLevel: "critical" });
    expect(r.blocked).toBe(true);
  });
});

describe("guardUserPrompt — 输入护栏", () => {
  it("清洁文本不抛错", () => {
    expect(() => guardUserPrompt("今日于后山采得灵草三株")).not.toThrow();
  });

  it("敏感输入抛 ContentBlockedError", () => {
    expect(() => guardUserPrompt("去死吧")).toThrow(ContentBlockedError);
  });

  it("错误携带 scan 信息（不向外暴露 matched 词本身即可读）", () => {
    try {
      guardUserPrompt("杀光");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ContentBlockedError);
      expect((e as ContentBlockedError).scan.category).toBe("violence");
    }
  });
});

describe("checkNarrativeSafe — 输出兜底", () => {
  it("普通剧情安全返回 true", () => {
    expect(checkNarrativeSafe('{"narrative":"他挥剑斩退来犯之敌，护住了山门。"}')).toBe(true);
  });

  it("含色情硬词返回 false（需丢弃重生成）", () => {
    expect(checkNarrativeSafe('{"narrative":"此处描述裸聊情节"}')).toBe(false);
  });

  it("含暴力描写（high 档）不误伤，返回 true", () => {
    // 输出校验只挡 critical，修仙战斗描写不应被拦
    expect(checkNarrativeSafe('{"narrative":"他一剑斩落，妖兽应声倒地。"}')).toBe(true);
  });
});

describe("safeReturn — 返回守卫", () => {
  it("安全文本原样返回", () => {
    expect(safeReturn('{"narrative":"灵气复苏，天地变色。"}')).toContain("灵气复苏");
  });

  it("违规文本抛 GENERATED_CONTENT_BLOCKED", () => {
    expect(() => safeReturn('{"narrative":"色情内容"}')).toThrow("GENERATED_CONTENT_BLOCKED");
  });
});
