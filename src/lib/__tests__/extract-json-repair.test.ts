import { describe, it, expect } from "vitest";
import { extractJson } from "../narrative";

// Agnes 实际生成的坏 JSON（narrative 值内含未转义 ASCII 引号）
const agnesOutput = `
\`\`\`json
{
  "type": "BIRTH",
  "title": "新生命降临",
  "narrative": "产房外的走廊里，陈书平来回踱着步子。护士推开门说："第一个出来了"声音不大。墙上的时钟指向凌晨三点十七分。",
  "mood": "静",
  "hint": "愿这孩子一生平安顺遂",
  "summary": "书香家庭迎来新生命",
  "suggestedName": "陈予安",
  "family": []
}
\`\`\`
`;

describe("extractJson 裸引号容错", () => {
  it("修复 Agnes 未转义引号并保留完整 narrative", () => {
    const result = extractJson(agnesOutput, { narrative: "" });
    expect(result.title).toBe("新生命降临");
    expect(result.narrative).toContain("第一个出来了");
    expect(result.suggestedName).toBe("陈予安");
  });

  it("正常 JSON 不受影响", () => {
    const ok = '{"a":"正常值","b":1}';
    const result = extractJson(ok, {});
    expect(result.a).toBe("正常值");
    expect(result.b).toBe(1);
  });
});
