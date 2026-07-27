import { describe, it, expect, vi } from 'vitest';
import {
  checkMindDemon,
  MIND_DEMON_EFFECTS,
  calcCombatMindDemon,
} from '../mind-demon';

describe('心魔检测', () => {
  it('心魔值低于阈值不触发', () => {
    const result = checkMindDemon(30);
    expect(result.triggered).toBe(false);
  });

  it('心魔值高于阈值可能触发', () => {
    // Mock Math.random to guarantee trigger
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01) // 触发判定 (0.01 * 100 = 1 < 50/2 = 25)
      .mockReturnValueOnce(0.1); // 类型判定 (体力消耗型)
    
    const result = checkMindDemon(80);
    expect(result.triggered).toBe(true);
    expect(result.staminaLoss).toBeGreaterThan(0);
    
    vi.restoreAllMocks();
  });

  it('心魔值高时不触发', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = checkMindDemon(80);
    expect(result.triggered).toBe(false);
    vi.restoreAllMocks();
  });

  it('体力消耗型心魔', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01) // 触发
      .mockReturnValueOnce(0.1); // 体力消耗型 (<0.4)
    
    const result = checkMindDemon(80);
    expect(result.triggered).toBe(true);
    expect(result.staminaLoss).toBeGreaterThanOrEqual(2);
    expect(result.staminaLoss).toBeLessThanOrEqual(5);
    expect(result.narrative).toContain('心魔反噬');
    
    vi.restoreAllMocks();
  });

  it('修为倒退型心魔', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01) // 触发
      .mockReturnValueOnce(0.5); // 修为倒退型 (0.4-0.8)
    
    const result = checkMindDemon(80);
    expect(result.triggered).toBe(true);
    expect(result.expLoss).toBeGreaterThanOrEqual(5);
    expect(result.expLoss).toBeLessThanOrEqual(20);
    expect(result.narrative).toContain('心魔扰动');
    
    vi.restoreAllMocks();
  });

  it('双重打击型心魔', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.01) // 触发
      .mockReturnValueOnce(0.9); // 双重打击型 (>=0.8)
    
    const result = checkMindDemon(80);
    expect(result.triggered).toBe(true);
    expect(result.staminaLoss).toBeGreaterThan(0);
    expect(result.expLoss).toBeGreaterThan(0);
    expect(result.narrative).toContain('心魔爆发');
    
    vi.restoreAllMocks();
  });
});

describe('心魔效果值', () => {
  it('突破失败增加心魔', () => {
    expect(MIND_DEMON_EFFECTS.breakthroughFail).toBe(15);
  });

  it('道心受损增加心魔', () => {
    expect(MIND_DEMON_EFFECTS.comedyDefeat).toBe(10);
  });

  it('愈灵符减少心魔', () => {
    expect(MIND_DEMON_EFFECTS.healTalisman).toBe(-20);
  });

  it('突破成功减少心魔', () => {
    expect(MIND_DEMON_EFFECTS.breakthroughSuccess).toBe(-30);
  });
});

describe('战斗连胜心魔', () => {
  it('2连胜不增加心魔', () => {
    expect(calcCombatMindDemon(2)).toBe(0);
  });

  it('3连胜增加5点心魔', () => {
    // (3-2)*5 = 5
    expect(calcCombatMindDemon(3)).toBe(5);
  });

  it('4连胜增加10点心魔', () => {
    // (4-2)*5 = 10
    expect(calcCombatMindDemon(4)).toBe(10);
  });

  it('5连胜增加15点心魔', () => {
    // (5-2)*5 = 15
    expect(calcCombatMindDemon(5)).toBe(15);
  });
});
