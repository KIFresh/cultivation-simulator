import { describe, it, expect } from 'vitest';
import { calcTravelCostByMode, TRAVEL_MODES } from '../cultivation-data';

describe('travel', () => {
  describe('calcTravelCostByMode', () => {
    it('should return positive stamina and gold costs', () => {
      const cost = calcTravelCostByMode('home', 'school', 'walk');
      expect(cost.staminaCost).toBeGreaterThanOrEqual(1);
      expect(cost.goldCost).toBeGreaterThanOrEqual(0);
    });

    it('should return different costs for different modes', () => {
      const walkCost = calcTravelCostByMode('home', 'school', 'walk');
      const taxiCost = calcTravelCostByMode('home', 'school', 'taxi');
      expect(taxiCost.staminaCost).toBeLessThan(walkCost.staminaCost);
      expect(taxiCost.goldCost).toBeGreaterThan(walkCost.goldCost);
    });

    it('should return zero distance cost for same location', () => {
      const cost = calcTravelCostByMode('home', 'home', 'walk');
      expect(cost.staminaCost).toBeGreaterThanOrEqual(1);
      expect(cost.goldCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TRAVEL_MODES', () => {
    it('should have 4 travel modes', () => {
      expect(TRAVEL_MODES).toHaveLength(4);
    });

    it('should include walk, bus, taxi, car', () => {
      const ids = TRAVEL_MODES.map((m) => m.id);
      expect(ids).toContain('walk');
      expect(ids).toContain('bus');
      expect(ids).toContain('taxi');
      expect(ids).toContain('car');
    });
  });
});