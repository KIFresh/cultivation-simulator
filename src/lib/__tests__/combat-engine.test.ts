import { describe, it, expect, vi } from 'vitest';
import {
  calculateCombatPower,
  resolveBattle,
  generateLoot,
  applyPenalty,
  getCombatNarrativeText,
  resolveCombat,
  type PlayerCombatData,
} from '../combat-engine';

// 模拟依赖模块
vi.mock('../cultivation-data', () => ({
  getItemById: vi.fn((id: string) => {
    const items: Record<string, { combatValue?: number }> = {
      wooden_sword: { combatValue: 5 },
      iron_sword: { combatValue: 8 },
    };
    return items[id] || undefined;
  }),
}));

vi.mock('../enemy-data', () => {
  const mockEnemies = [
    { id: 'wild_dog', name: '野狗', realm: '凡人', combatPower: 20, rarity: '普通', locationIds: ['wild'] },
    { id: 'bandit', name: '山贼', realm: '炼气期', combatPower: 80, rarity: '普通', locationIds: ['wild'] },
  ];
  return {
    ENEMIES: mockEnemies,
    getEnemiesForLocation: vi.fn(() => mockEnemies),
    getRealmMultiplier: vi.fn((realm: string) => {
      const map: Record<string, number> = { '凡人': 1, '炼气期': 1.5, '筑基期': 2.25 };
      return map[realm] ?? 1;
    }),
    pickEnemy: vi.fn((enemies: typeof mockEnemies) => enemies.length > 0 ? enemies[0] : null),
  };
});

vi.mock('../technique-data', () => ({
  calculateTechniqueBonuses: vi.fn(() => ({ combat: 0, cultivationSpeed: 0, breakthroughRate: 0, daily: 0 })),
  TECHNIQUES: {},
}));

vi.mock('../narrative', () => ({
  generateCombatNarrative: vi.fn(async () => ''),
}));

const makePlayer = (overrides: Partial<PlayerCombatData> = {}): PlayerCombatData => ({
  cultivator: { id: 'test', name: '测试者', realm: '炼气期', realmLevel: 1, gold: 100, reincarnationCount: 0, injuryDebuff: 0, mindDemon: 0 },
  attributes: { root: 10, spirit: 8, insight: 5, luck: 2 },
  equippedItems: [],
  techniqueRecords: [],
  ...overrides,
});

describe('combat-engine', () => {
  describe('calculateCombatPower', () => {
    it('should calculate base power from attributes', () => {
      const player = makePlayer();
      const power = calculateCombatPower(player);
      expect(power).toBeGreaterThan(0);
    });

    it('should include equipment bonus', () => {
      const player = makePlayer({ equippedItems: [{ itemId: 'wooden_sword' }] });
      const power = calculateCombatPower(player);
      expect(power).toBeGreaterThan(0);
    });
  });

  describe('resolveBattle', () => {
    it('should always win with overwhelm when ratio >= 5', () => {
      const result = resolveBattle(500, 100);
      expect(result.win).toBe(true);
      expect(result.style).toBe('overwhelm');
    });

    it('should resolve with win/lose based on ratio', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = resolveBattle(60, 100);
      // 50% 概率，随机种子 0.5，winRate = 60/160 = 0.375 < 0.5 所以输
      expect(result.win).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('generateLoot', () => {
    it('should generate gold and exp', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const enemy = { id: 'test', name: '测试', realm: '凡人', combatPower: 100, rarity: '普通' as const, locationIds: ['wild'], drops: ['spirit_stone'] };
      const loot = generateLoot(enemy, 0);
      expect(loot.gold).toBeGreaterThanOrEqual(0);
      expect(loot.exp).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(loot.items)).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe('applyPenalty', () => {
    it('should return tier 0 penalty for ratio < 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const penalty = applyPenalty(0.5, 100);
      expect(penalty.goldLoss).toBeGreaterThan(0);
      expect(penalty.injuryDebuff).toBe(0);
      expect(penalty.mindDemonDelta).toBe(10);
      expect(penalty.daoXiao).toBe(false);
      vi.restoreAllMocks();
    });

    it('should return daoXiao for ratio >= 5', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const penalty = applyPenalty(5, 100);
      expect(penalty.daoXiao).toBe(true);
      expect(penalty.goldLoss).toBe(80);
      vi.restoreAllMocks();
    });

    it('should return tier 1 penalty with itemLoss for ratio 1-2', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const inventory = [
        { itemId: 'spirit_stone', quantity: 5, equipped: false },
        { itemId: 'herb', quantity: 3, equipped: false },
        { itemId: 'sword', quantity: 1, equipped: true },
      ];
      const penalty = applyPenalty(1.5, 100, inventory);
      expect(penalty.goldLoss).toBeGreaterThan(0);
      expect(penalty.injuryDebuff).toBe(0);
      expect(penalty.itemLoss).toBeDefined();
      expect(penalty.itemLoss!.length).toBeGreaterThanOrEqual(1);
      expect(penalty.itemLoss!.length).toBeLessThanOrEqual(2);
      // 装备物品不应被扣
      expect(penalty.itemLoss).not.toContain('sword');
      vi.restoreAllMocks();
    });
  });

  describe('getCombatNarrativeText', () => {
    it('should return overwhelm win text', () => {
      const text = getCombatNarrativeText('overwhelm', true, '玩家', '敌人');
      expect(text).toContain('随手一挥');
      expect(text).toContain('敌人');
    });

    it('should return crushed lose text', () => {
      const text = getCombatNarrativeText('crushed', false, '玩家', '敌人');
      expect(text).toContain('衣角都没碰到');
    });
  });

  describe('resolveCombat', () => {
    it('should return peaceful result when no enemy', async () => {
      const result = await resolveCombat(makePlayer());
      expect(result.win).toBe(true);
      expect(result.narrative).toContain('并无敌人');
    });
  });
});