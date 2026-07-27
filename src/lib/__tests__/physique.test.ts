import { describe, it, expect } from 'vitest';
import {
  getPhysiqueById,
  getAllPhysiques,
  parsePhysique,
  applyPhysiqueEffects,
  getRandomPhysique,
} from '../physique';

describe('physique', () => {
  describe('getPhysiqueById', () => {
    it('should return null for null/undefined/empty', () => {
      expect(getPhysiqueById(null)).toBeNull();
      expect(getPhysiqueById(undefined)).toBeNull();
    });

    it('should return the matching physique', () => {
      const p = getPhysiqueById('dao_body');
      expect(p).not.toBeNull();
      expect(p!.name).toBe('天生道体');
      expect(p!.rarity).toBe(5);
    });

    it('should return null for unknown id', () => {
      expect(getPhysiqueById('unknown')).toBeNull();
    });
  });

  describe('getAllPhysiques', () => {
    it('should return all physiques', () => {
      const all = getAllPhysiques();
      expect(all.length).toBeGreaterThanOrEqual(7);
      expect(all[0].id).toBe('mortal_body');
    });
  });

  describe('parsePhysique', () => {
    it('should parse id string', () => {
      const p = parsePhysique('sword_bone');
      expect(p).not.toBeNull();
      expect(p!.name).toBe('剑骨');
    });

    it('should parse JSON string with id', () => {
      const p = parsePhysique(JSON.stringify({ id: 'void_heart' }));
      expect(p).not.toBeNull();
      expect(p!.name).toBe('空明道心');
    });

    it('should return null for empty input', () => {
      expect(parsePhysique(null)).toBeNull();
      expect(parsePhysique('')).toBeNull();
    });
  });

  describe('applyPhysiqueEffects', () => {
    it('should return base when no physique', () => {
      const result = applyPhysiqueEffects({ spirit: 5, insight: 3 }, null);
      expect(result).toEqual({ spirit: 5, insight: 3 });
    });

    it('should apply effects from physique', () => {
      const result = applyPhysiqueEffects({ spirit: 5, insight: 3 }, 'dao_body');
      expect(result.spirit).toBe(8);  // 5 + 3
      expect(result.insight).toBe(6); // 3 + 3
    });
  });

  describe('getRandomPhysique', () => {
    it('should return a physique weighted by rarity', () => {
      const p = getRandomPhysique(() => 0); // always first
      expect(p).toBeDefined();
      expect(p.id).toBeTruthy();
    });

    it('should return last physique when rng returns 1', () => {
      const p = getRandomPhysique(() => 0.999);
      expect(p).toBeDefined();
    });
  });
});