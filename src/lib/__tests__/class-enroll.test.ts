import { describe, it, expect } from 'vitest';
import {
  getClassEnrollOptions,
  parseClassEnroll,
  enrollClass,
  CLASS_ENROLL_OPTIONS,
  applyClassBenefits,
  canEnrollClass,
  CLASS_ATTR_BONUS,
} from '../class-enroll';

describe('class-enroll', () => {
  describe('getClassEnrollOptions', () => {
    it('should return all class enroll options', () => {
      const options = getClassEnrollOptions();
      expect(options).toEqual(CLASS_ENROLL_OPTIONS);
      expect(options).toHaveLength(5);
    });
  });

  describe('parseClassEnroll', () => {
    it('should return empty array for null/undefined', () => {
      expect(parseClassEnroll(null)).toEqual([]);
      expect(parseClassEnroll(undefined)).toEqual([]);
    });

    it('should parse valid JSON array', () => {
      const raw = JSON.stringify([{ optionId: 'calligraphy', terms: 2 }]);
      const result = parseClassEnroll(raw);
      expect(result).toHaveLength(1);
      expect(result[0].optionId).toBe('calligraphy');
      expect(result[0].terms).toBe(2);
    });

    it('should filter out invalid entries', () => {
      const raw = JSON.stringify([
        { optionId: 'calligraphy', terms: 2 },
        { optionId: 123, terms: 'invalid' },
        null,
      ]);
      const result = parseClassEnroll(raw);
      expect(result).toHaveLength(1);
    });
  });

  describe('enrollClass', () => {
    it('should add a new enrollment', () => {
      const result = enrollClass([], 'martial');
      expect(result).toHaveLength(1);
      expect(result[0].optionId).toBe('martial');
      expect(result[0].terms).toBe(1);
    });

    it('should increment terms for existing enrollment', () => {
      const current = [{ optionId: 'math', terms: 2 }];
      const result = enrollClass(current, 'math');
      expect(result).toHaveLength(1);
      expect(result[0].terms).toBe(3);
    });
  });

  describe('applyClassBenefits', () => {
    it('空记录不变', () => {
      const r = applyClassBenefits([], { root: 5, mind: 3 });
      expect(r.attributes).toEqual({ root: 5, mind: 3 });
      expect(r.totalCost).toBe(0);
    });

    it('单班累计属性 and 费用', () => {
      const r = applyClassBenefits(
        [{ optionId: 'calligraphy', terms: 2 }],
        { mind: 3 },
      );
      expect(r.attributes.mind).toBe(3 + CLASS_ATTR_BONUS * 2); // 5
      expect(r.totalCost).toBe(100);
    });

    it('多班叠加', () => {
      const r = applyClassBenefits(
        [
          { optionId: 'calligraphy', terms: 1 },
          { optionId: 'martial', terms: 1 },
        ],
        { mind: 0, root: 0 },
      );
      expect(r.attributes.mind).toBe(CLASS_ATTR_BONUS);
      expect(r.attributes.root).toBe(CLASS_ATTR_BONUS);
      expect(r.totalCost).toBe(100 + 150);
    });

    it('未知 optionId 跳过', () => {
      const r = applyClassBenefits(
        [{ optionId: 'unknown', terms: 1 }],
        { root: 5 },
      );
      expect(r.attributes).toEqual({ root: 5 });
      expect(r.totalCost).toBe(0);
    });
  });

  describe('canEnrollClass', () => {
    it('年龄 < 6 不能报', () => {
      expect(canEnrollClass(5, 'math', [])).toBe(false);
    });

    it('年龄 > 18 不能报', () => {
      expect(canEnrollClass(19, 'math', [])).toBe(false);
    });

    it('6-18 岁可报', () => {
      expect(canEnrollClass(8, 'math', [])).toBe(true);
    });

    it('已报名不可重复报', () => {
      expect(canEnrollClass(8, 'math', [{ optionId: 'math', terms: 1 }])).toBe(false);
    });

    it('不存在 optionId 不可报', () => {
      expect(canEnrollClass(8, 'bogus', [])).toBe(false);
    });
  });
});