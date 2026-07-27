import { describe, it, expect } from 'vitest';
import {
  parseMilestones,
  getMilestoneForAge,
  shouldTriggerMilestone,
  MILESTONES_BY_AGE,
} from '../milestones';

describe('MILESTONES_BY_AGE', () => {
  it('应包含 1、3、6、8、10、12、14、15 岁里程碑', () => {
    const ages = [1, 3, 6, 8, 10, 12, 14, 15];
    for (const age of ages) {
      expect(MILESTONES_BY_AGE[age]).toBeDefined();
      expect(MILESTONES_BY_AGE[age].id).toBeTruthy();
    }
  });

  it('每个里程碑应有 id、age、title、icon、narrative', () => {
    for (const ms of Object.values(MILESTONES_BY_AGE)) {
      expect(ms.id).toBeTruthy();
      expect(typeof ms.age).toBe('number');
      expect(typeof ms.title).toBe('string');
      expect(typeof ms.icon).toBe('string');
      expect(typeof ms.narrative).toBe('string');
    }
  });
});

describe('parseMilestones', () => {
  it('应解析合法 JSON 字符串数组', () => {
    expect(parseMilestones('["ms_birthday_1","ms_nursery"]')).toEqual(['ms_birthday_1', 'ms_nursery']);
  });

  it('null/空输入应返回空数组', () => {
    expect(parseMilestones(null)).toEqual([]);
    expect(parseMilestones('')).toEqual([]);
  });

  it('非法 JSON 应返回空数组', () => {
    expect(parseMilestones('{bad}')).toEqual([]);
  });

  it('应过滤非字符串元素', () => {
    expect(parseMilestones('[1, true, "valid"]')).toEqual(['valid']);
  });
});

describe('getMilestoneForAge', () => {
  it('有里程碑的年龄应返回对应里程碑', () => {
    const ms = getMilestoneForAge(1);
    expect(ms).not.toBeNull();
    expect(ms!.id).toBe('ms_birthday_1');
  });

  it('无里程碑的年龄应返回 null', () => {
    expect(getMilestoneForAge(2)).toBeNull();
    expect(getMilestoneForAge(4)).toBeNull();
  });

  it('已触发的里程碑应返回 null', () => {
    expect(getMilestoneForAge(1, ['ms_birthday_1'])).toBeNull();
  });
});

describe('shouldTriggerMilestone', () => {
  it('未触发的里程碑应返回 true', () => {
    expect(shouldTriggerMilestone(6)).toBe(true);
  });

  it('已触发的里程碑应返回 false', () => {
    expect(shouldTriggerMilestone(6, ['ms_primary'])).toBe(false);
  });

  it('无里程碑的年龄应返回 false', () => {
    expect(shouldTriggerMilestone(2)).toBe(false);
  });
});