import { describe, it, expect } from 'vitest';
import {
  getClassEnrollOptions,
  parseClassEnroll,
  enrollClass,
  CLASS_ENROLL_OPTIONS,
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
});