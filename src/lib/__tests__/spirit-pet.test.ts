import { describe, it, expect } from 'vitest';
import {
  parseSpiritPets,
  hatchPet,
  upgradeCost,
  upkeepCost,
  MAX_PET_LEVEL,
  HATCH_COST_STONE,
} from '../spirit-pet';

describe('spirit-pet', () => {
  describe('parseSpiritPets', () => {
    it('should return empty array for null/undefined', () => {
      expect(parseSpiritPets(null)).toEqual([]);
      expect(parseSpiritPets(undefined)).toEqual([]);
    });

    it('should parse valid JSON array', () => {
      const raw = JSON.stringify([{ id: 'pet_1', name: '小火龙', level: 2, skipQuarters: 0, state: 'active' }]);
      const pets = parseSpiritPets(raw);
      expect(pets).toHaveLength(1);
      expect(pets[0].name).toBe('小火龙');
      expect(pets[0].level).toBe(2);
    });

    it('should normalize invalid pets', () => {
      const raw = JSON.stringify([{ id: 'pet_1' }]);
      const pets = parseSpiritPets(raw);
      expect(pets).toHaveLength(1);
      expect(pets[0].level).toBe(1);
      expect(pets[0].state).toBe('active');
    });
  });

  describe('hatchPet', () => {
    it('should create a new pet with default name', () => {
      const pet = hatchPet();
      expect(pet.level).toBe(1);
      expect(pet.state).toBe('active');
      expect(pet.name).toBe('无名灵宠');
      expect(pet.id).toContain('pet_');
    });

    it('should use provided name', () => {
      const pet = hatchPet('火龙');
      expect(pet.name).toBe('火龙');
    });
  });

  describe('upgradeCost', () => {
    it('should return costs based on level', () => {
      const cost = upgradeCost(1);
      expect(cost.mid).toBe(15);  // 10 + 1*5
      expect(cost.grass).toBe(5); // 3 + 1*2
    });
  });

  describe('upkeepCost', () => {
    it('should return costs based on level', () => {
      const cost = upkeepCost(3);
      expect(cost.low).toBe(3);
      expect(cost.grass).toBe(2); // Math.floor(3/2) + 1
    });
  });

  it('should have correct constants', () => {
    expect(MAX_PET_LEVEL).toBe(5);
    expect(HATCH_COST_STONE.amount).toBe(20);
  });
});