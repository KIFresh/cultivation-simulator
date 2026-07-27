import { describe, it, expect } from 'vitest';
import { generateEarthFamily, parseFamily, type EarthFamily } from '../family';

describe('generateEarthFamily', () => {
  it('应为 scholar 身份生成包含父母、祖父和弟弟的家庭', () => {
    const family = generateEarthFamily(1, 'scholar');
    expect(family.members.length).toBeGreaterThanOrEqual(4);
    const roles = family.members.map((m) => m.relation);
    expect(roles).toContain('父亲');
    expect(roles).toContain('母亲');
    expect(roles).toContain('祖父');
    expect(roles).toContain('弟弟');
  });

  it('相同的 seed 应生成相同的家庭结构', () => {
    const a = generateEarthFamily(42, 'merchant');
    const b = generateEarthFamily(42, 'merchant');
    expect(a.members).toEqual(b.members);
  });

  it('orphan 身份应只有父母（无祖父无弟弟）', () => {
    const family = generateEarthFamily(5, 'orphan');
    expect(family.members.length).toBe(2);
    expect(family.members[0].relation).toBe('父亲');
    expect(family.members[1].relation).toBe('母亲');
  });

  it('亲密度应在 0-100 范围内', () => {
    const family = generateEarthFamily(999, 'general');
    for (const m of family.members) {
      expect(m.intimacy).toBeGreaterThanOrEqual(0);
      expect(m.intimacy).toBeLessThanOrEqual(100);
    }
  });
});

describe('parseFamily', () => {
  it('应解析合法的 JSON 字符串', () => {
    const raw = JSON.stringify({ members: [{ name: '测试', relation: '父亲', alive: true }] });
    const result = parseFamily(raw);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].name).toBe('测试');
  });

  it('null/空输入应返回空家庭', () => {
    expect(parseFamily(null)).toEqual({ members: [] });
    expect(parseFamily('')).toEqual({ members: [] });
  });

  it('非法 JSON 应返回空家庭', () => {
    expect(parseFamily('{not json}')).toEqual({ members: [] });
  });
});