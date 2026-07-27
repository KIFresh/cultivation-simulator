import { describe, it, expect } from 'vitest';
import {
  getCultivationTierMult,
  canConsumeStone,
  consumeStoneForCultivation,
  calcCultivationWithStone,
  SPIRIT_STONE_TIER_MULT,
} from '../spirit-stone';

describe('spirit-stone', () => {
  describe('getCultivationTierMult', () => {
    it('should return correct multipliers for each tier', () => {
      expect(getCultivationTierMult('none')).toBe(1);
      expect(getCultivationTierMult('low')).toBe(1.2);
      expect(getCultivationTierMult('mid')).toBe(1.6);
      expect(getCultivationTierMult('high')).toBe(2.2);
    });
  });

  describe('canConsumeStone', () => {
    it('should return true for none tier', () => {
      expect(canConsumeStone('none', { low: 0, mid: 0, high: 0 })).toBe(true);
    });

    it('should return true when inventory has enough', () => {
      expect(canConsumeStone('low', { low: 5, mid: 0, high: 0 })).toBe(true);
    });

    it('should return false when inventory is empty', () => {
      expect(canConsumeStone('mid', { low: 0, mid: 0, high: 0 })).toBe(false);
    });
  });

  describe('consumeStoneForCultivation', () => {
    it('should return applied=false for none tier', () => {
      const inv = { low: 0, mid: 0, high: 0 };
      const result = consumeStoneForCultivation('none', inv);
      expect(result.applied).toBe(false);
      expect(result.mult).toBe(1);
    });

    it('should consume one stone and return multiplier', () => {
      const inv = { low: 3, mid: 0, high: 0 };
      const result = consumeStoneForCultivation('low', inv);
      expect(result.applied).toBe(true);
      expect(result.mult).toBe(1.2);
      expect(result.remaining.low).toBe(2);
    });

    it('should not consume when inventory is insufficient', () => {
      const inv = { low: 0, mid: 0, high: 0 };
      const result = consumeStoneForCultivation('high', inv);
      expect(result.applied).toBe(false);
      expect(result.mult).toBe(1);
    });
  });

  describe('calcCultivationWithStone', () => {
    it('should calculate gain with multiplier', () => {
      const inv = { low: 1, mid: 0, high: 0 };
      const result = calcCultivationWithStone(100, 'low', inv);
      expect(result.gain).toBe(120); // 100 * 1.2
      expect(result.applied).toBe(true);
      expect(result.remaining.low).toBe(0);
    });

    it('should return base gain when no stone applied', () => {
      const inv = { low: 0, mid: 0, high: 0 };
      const result = calcCultivationWithStone(100, 'mid', inv);
      expect(result.gain).toBe(100);
      expect(result.applied).toBe(false);
    });
  });
});