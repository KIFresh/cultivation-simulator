import { describe, it, expect } from 'vitest';
import {
  getEnemiesForLocation,
  getRealmIndex,
  getRealmMultiplier,
  pickEnemy,
  ENEMIES,
} from '../enemy-data';

describe('enemy-data', () => {
  describe('getRealmIndex', () => {
    it('should return correct index for known realms', () => {
      expect(getRealmIndex('凡人')).toBe(0);
      expect(getRealmIndex('炼气期')).toBe(1);
      expect(getRealmIndex('筑基期')).toBe(2);
      expect(getRealmIndex('渡劫期')).toBe(9);
    });

    it('should return 0 for unknown realm', () => {
      expect(getRealmIndex('unknown')).toBe(0);
    });
  });

  describe('getRealmMultiplier', () => {
    it('should return 1.5^index', () => {
      expect(getRealmMultiplier('凡人')).toBe(1);
      expect(getRealmMultiplier('炼气期')).toBe(1.5);
    });
  });

  describe('getEnemiesForLocation', () => {
    it('should return empty array for safe locations', () => {
      expect(getEnemiesForLocation('home', '凡人')).toEqual([]);
      expect(getEnemiesForLocation('school', '炼气期')).toEqual([]);
    });

    it('should return enemies filtered by realm difference', () => {
      const enemies = getEnemiesForLocation('wild', '炼气期');
      expect(enemies.length).toBeGreaterThan(0);
      enemies.forEach((e) => {
        expect(e.locationIds).toContain('wild');
      });
    });
  });

  describe('pickEnemy', () => {
    it('should return null for empty array', () => {
      expect(pickEnemy([])).toBeNull();
    });

    it('should return an enemy from the pool', () => {
      const enemy = pickEnemy(ENEMIES);
      expect(enemy).not.toBeNull();
      expect(enemy!.id).toBeTruthy();
    });
  });
});