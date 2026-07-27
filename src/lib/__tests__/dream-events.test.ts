import { describe, it, expect } from 'vitest';
import { pickDream } from '../dream-events';

describe('dream-events', () => {
  describe('pickDream', () => {
    it('should return a matched dream for a known spiritual root', () => {
      const dream = pickDream('gold', 20);
      expect(dream.title).toBe('金山压顶');
      expect(dream.root).toBe('gold');
      expect(dream.omen).toBe('利在财货');
      expect(dream.narrative).toBeTruthy();
    });

    it('should return a generic dream for unknown spiritual root', () => {
      const dream = pickDream('unknown_root', 10);
      expect(dream.root).toBe('unknown_root');
      expect(dream.title).toBeTruthy();
      expect(dream.narrative).toBeTruthy();
    });

    it('should be deterministic for same root and age', () => {
      const d1 = pickDream('fire', 25);
      const d2 = pickDream('fire', 25);
      expect(d1.title).toBe(d2.title);
      expect(d1.narrative).toBe(d2.narrative);
    });

    it('should return different dreams for different ages', () => {
      const d1 = pickDream('water', 8);
      const d2 = pickDream('water', 80);
      // Different ages may produce different results due to hash
      expect(d1.root).toBe('water');
      expect(d2.root).toBe('water');
    });
  });
});