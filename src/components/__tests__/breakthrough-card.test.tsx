import { describe, it, expect } from 'vitest';
import { hasBreakthroughCard } from '../breakthrough-card';

describe('BreakthroughCard', () => {
  describe('hasBreakthroughCard', () => {
    it('筑基期有卡片素材', () => {
      expect(hasBreakthroughCard('筑基期')).toBe(true);
    });
    it('结丹期有卡片素材', () => {
      expect(hasBreakthroughCard('结丹期')).toBe(true);
    });
    it('元婴期有卡片素材', () => {
      expect(hasBreakthroughCard('元婴期')).toBe(true);
    });
    it('凡人境界没有卡片素材', () => {
      expect(hasBreakthroughCard('凡人')).toBe(false);
    });
    it('炼气期没有卡片素材', () => {
      expect(hasBreakthroughCard('炼气期')).toBe(false);
    });
    it('化神期没有卡片素材', () => {
      expect(hasBreakthroughCard('化神期')).toBe(false);
    });
    it('大乘期没有卡片素材', () => {
      expect(hasBreakthroughCard('大乘期')).toBe(false);
    });
    it('空字符串返回false', () => {
      expect(hasBreakthroughCard('')).toBe(false);
    });
  });
});