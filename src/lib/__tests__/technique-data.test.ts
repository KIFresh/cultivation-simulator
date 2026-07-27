import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TECHNIQUES,
  addProficiency,
  calculateTechniqueBonuses,
  calcTechniqueProficiency,
  getTechniqueById,
  triggerStudyEvent,
  getDefaultStudyNarrative,
  type Technique,
} from '../technique-data';

// ============================================================
// 功法数据验证
// ============================================================
describe('TECHNIQUES 常量数据', () => {
  it('功法列表不为空', () => {
    const ids = Object.keys(TECHNIQUES);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('所有功法有唯一id', () => {
    const ids = Object.values(TECHNIQUES).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('所有功法有合法品级', () => {
    const validGrades = ['凡', '黄', '玄', '地', '天'];
    for (const t of Object.values(TECHNIQUES)) {
      expect(validGrades).toContain(t.grade);
    }
  });

  it('所有功法有合法最低境界', () => {
    const validRealms = ['凡人', '炼气期', '筑基期', '结丹期', '元婴期', '化神期', '炼虚期', '合体期', '大乘期', '渡劫期'];
    for (const t of Object.values(TECHNIQUES)) {
      expect(validRealms).toContain(t.realm);
    }
  });

  it('功法熟练度升级数组长度 = maxLevel - 1', () => {
    for (const t of Object.values(TECHNIQUES)) {
      expect(t.upgradeProficiency.length).toBe(t.maxLevel - 1);
    }
  });

  it('高品级功法境界要求不应低于低品级', () => {
    const gradeOrder: Record<string, number> = { '凡': 0, '黄': 1, '玄': 2, '地': 3, '天': 4 };
    const realmOrder: Record<string, number> = { '凡人': 0, '炼气期': 1, '筑基期': 2, '结丹期': 3, '元婴期': 4, '化神期': 5 };
    for (const t of Object.values(TECHNIQUES)) {
      if (t.grade === '天' || t.grade === '地') {
        // 天地级功法不应是最低境界
        expect(realmOrder[t.realm] ?? -1).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('所有功法名称不为空', () => {
    for (const t of Object.values(TECHNIQUES)) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('所有功法至少有一个效果', () => {
    for (const t of Object.values(TECHNIQUES)) {
      expect(t.effects.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// addProficiency — 熟练度计算
// ============================================================
describe('addProficiency', () => {
  // 以吐纳术为例：升级需要 [100, 300]，maxLevel=3
  const upgradeProf = [100, 300];

  it('未满级时正常增加熟练度', () => {
    const result = addProficiency(1, 50, upgradeProf, 30);
    expect(result.newLevel).toBe(1);
    expect(result.newProficiency).toBe(80);
    expect(result.leveledUp).toBe(false);
  });

  it('熟练度达到升级阈值时升级', () => {
    const result = addProficiency(1, 90, upgradeProf, 30);
    expect(result.newLevel).toBe(2);
    expect(result.newProficiency).toBe(20); // 90+30=120, 120-100=20
    expect(result.leveledUp).toBe(true);
  });

  it('一次增加多级（大额跳跃）', () => {
    const result = addProficiency(1, 50, upgradeProf, 500);
    expect(result.newLevel).toBe(3); // max
    expect(result.newProficiency).toBe(0);
    expect(result.leveledUp).toBe(true);
  });

  it('满级后熟练度归零', () => {
    const result = addProficiency(3, 50, upgradeProf, 100);
    expect(result.newLevel).toBe(3);
    expect(result.newProficiency).toBe(0);
    expect(result.leveledUp).toBe(false);
  });

  it('差一点升级时不会跨级', () => {
    const result = addProficiency(1, 99, upgradeProf, 1);
    expect(result.newLevel).toBe(2);
    expect(result.newProficiency).toBe(0); // 99+1=100, 刚好够
    expect(result.leveledUp).toBe(true);
  });

  it('刚升级后继续积累', () => {
    const result = addProficiency(1, 100, upgradeProf, 50);
    expect(result.newLevel).toBe(2);
    expect(result.newProficiency).toBe(50); // 100+50=150, 减100=50
    expect(result.leveledUp).toBe(true);
  });

  it('大量熟练度直接跳满级', () => {
    const result = addProficiency(1, 0, upgradeProf, 9999);
    expect(result.newLevel).toBe(3);
    expect(result.newProficiency).toBe(0);
    expect(result.leveledUp).toBe(true);
  });

  it('不同功法的升级配置正常工作', () => {
    // 天道诀: [1000, 3000], maxLevel=3
    const result = addProficiency(1, 500, [1000, 3000], 2000);
    expect(result.newLevel).toBe(2);
    expect(result.newProficiency).toBe(1500); // 500+2000=2500, 2500-1000=1500
    expect(result.leveledUp).toBe(true);
  });
});

// ============================================================
// calculateTechniqueBonuses — 功法加成计算
// ============================================================
describe('calculateTechniqueBonuses', () => {
  it('无功法时所有加成为0', () => {
    const bonuses = calculateTechniqueBonuses([]);
    expect(bonuses).toEqual({
      cultivationSpeed: 0,
      breakthroughRate: 0,
      combat: 0,
      daily: 0,
    });
  });

  it('单个功法计算正确', () => {
    const technique = TECHNIQUES['basic_breathing'];
    // 吐纳术: cultivationSpeed value=5 perLevel=3, level=2 时 = 5 + 3*(2-1) = 8
    const bonuses = calculateTechniqueBonuses([{ technique, level: 2 }]);
    expect(bonuses.cultivationSpeed).toBe(8);
  });

  it('功法等级越高加成越多', () => {
    const technique = TECHNIQUES['basic_breathing'];
    // 吐纳术: level=1 时 cultivationSpeed = 5
    const lv1 = calculateTechniqueBonuses([{ technique, level: 1 }]);
    // level=3 时 cultivationSpeed = 5 + 3*(3-1) = 11
    const lv3 = calculateTechniqueBonuses([{ technique, level: 3 }]);
    expect(lv3.cultivationSpeed).toBeGreaterThan(lv1.cultivationSpeed);
  });

  it('多个功法加成叠加', () => {
    const t1 = TECHNIQUES['basic_breathing'];
    const t2 = TECHNIQUES['heart_protecting'];
    const bonuses = calculateTechniqueBonuses([
      { technique: t1, level: 2 }, // cultivationSpeed: 5+3*(2-1)=8
      { technique: t2, level: 1 }, // combat: 5, daily: 2
    ]);
    expect(bonuses.cultivationSpeed).toBe(8);
    expect(bonuses.combat).toBe(5);
    expect(bonuses.daily).toBe(2);
  });

  it('所有效果类型都正确聚合', () => {
    // 天道诀有3种效果
    const technique = TECHNIQUES['heavenly_dao'];
    const bonuses = calculateTechniqueBonuses([{ technique, level: 1 }]);
    // cultivationSpeed: 50, breakthroughRate: 10, combat: 30
    expect(bonuses.cultivationSpeed).toBe(50);
    expect(bonuses.breakthroughRate).toBe(10);
    expect(bonuses.combat).toBe(30);
  });
});

// ============================================================
// calcTechniqueProficiency — 熟练度增量计算
// ============================================================
describe('calcTechniqueProficiency', () => {
  it('凡人境界日常修炼得10点', () => {
    expect(calcTechniqueProficiency('action', '凡人')).toBe(10);
  });

  it('境界越高熟练度越高', () => {
    const mortal = calcTechniqueProficiency('action', '凡人');
    const qiRefining = calcTechniqueProficiency('action', '炼气期');
    expect(qiRefining).toBeGreaterThan(mortal);
  });

  it('战斗 > 修炼 > 动作', () => {
    const action = calcTechniqueProficiency('action', '筑基期');
    const combat = calcTechniqueProficiency('combat', '筑基期');
    const study = calcTechniqueProficiency('study', '筑基期');
    // combat(45) > study(30) > action(15)，再加境界偏移
    expect(combat).toBeGreaterThan(study);
    expect(study).toBeGreaterThan(action);
  });

  it('不认识的境界名按凡人处理', () => {
    expect(calcTechniqueProficiency('action', '未知境界')).toBe(10);
  });
});

// ============================================================
// getTechniqueById — 查找功法
// ============================================================
describe('getTechniqueById', () => {
  it('获取存在的功法', () => {
    expect(getTechniqueById('basic_breathing')).toBeDefined();
    expect(getTechniqueById('basic_breathing')?.name).toBe('吐纳术');
  });

  it('获取不存在的功法返回undefined', () => {
    expect(getTechniqueById('不存在')).toBeUndefined();
  });
});

// ============================================================
// getDefaultStudyNarrative — 默认研读叙事
// ============================================================
describe('getDefaultStudyNarrative', () => {
  it('包含功法名称', () => {
    const narrative = getDefaultStudyNarrative('吐纳术');
    expect(narrative).toContain('吐纳术');
  });

  it('返回标准叙事格式', () => {
    const narrative = getDefaultStudyNarrative('七星剑诀');
    expect(narrative).toContain('七星剑诀');
    expect(narrative.length).toBeGreaterThan(10);
  });
});

// ============================================================
// triggerStudyEvent — 研读随机事件
// ============================================================
describe('triggerStudyEvent', () => {
  const mockRandom = vi.fn();

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(mockRandom);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('高悟性时高概率触发', () => {
    // insight=38 → baseChance 0.2 + 0.76 = 0.96, 上限0.95
    // random < 0.95 时触发
    mockRandom.mockReturnValue(0.1);
    const result = triggerStudyEvent(38, '吐纳术');
    expect(result).not.toBeNull();
    expect(result!.event).toBeDefined();
    expect(result!.narrative).toContain('吐纳术');
  });

  it('低悟性时概率较低', () => {
    // insight=0 → baseChance 0.2, 不触发
    mockRandom.mockReturnValue(0.5);
    const result = triggerStudyEvent(0, '吐纳术');
    expect(result).toBeNull();
  });

  it('触发时返回有效事件的格式', () => {
    mockRandom.mockReturnValue(0.01);
    const result = triggerStudyEvent(10, '七星剑诀');
    expect(result).not.toBeNull();
    expect(result!.event.title).toBeTruthy();
    expect(result!.event.narrative).toBeTruthy();
    expect(result!.event.extraProf).toBeGreaterThan(0);
  });

  it('悟性极高时必触发（上限95%）', () => {
    // insight=40 → 0.2 + 0.8 = 1.0, 上限0.95
    mockRandom.mockReturnValue(0.94);
    const result = triggerStudyEvent(40, '吐纳术');
    expect(result).not.toBeNull();
  });

  it('悟性极高时随机大于0.95则不触发', () => {
    mockRandom.mockReturnValue(0.96);
    const result = triggerStudyEvent(40, '吐纳术');
    expect(result).toBeNull();
  });

  it('不同技术名称都正确嵌入', () => {
    mockRandom.mockReturnValue(0.01);
    const result = triggerStudyEvent(10, '天道诀');
    expect(result!.narrative).toContain('天道诀');
  });

  it('所有事件都有描述文本', () => {
    mockRandom.mockReturnValue(0.01);
    // 跑多次看看不同事件的效果
    for (let i = 0; i < 20; i++) {
      mockRandom.mockReturnValue(0.01);
      const result = triggerStudyEvent(10, '测试');
      expect(result!.event.title.length).toBeGreaterThan(0);
      expect(result!.event.extraProf).toBeGreaterThan(0);
    }
  });
});