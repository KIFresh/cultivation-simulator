import { describe, it, expect } from 'vitest';
import {
  pickExamEvent,
  MORTAL_EVENTS,
  DINNER_EVENTS,
  FESTIVAL_EVENTS,
  EXAM_EVENTS,
  type MortalEvent,
} from '../mortal-events';

describe('MORTAL_EVENTS', () => {
  it('应包含日常随机事件', () => {
    expect(MORTAL_EVENTS.length).toBeGreaterThan(0);
  });

  it('每个事件应有 id、text、options 数组', () => {
    for (const ev of MORTAL_EVENTS) {
      expect(ev.id).toBeTruthy();
      expect(typeof ev.text).toBe('string');
      expect(ev.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('每个选项应有 narrative 和 effects', () => {
    for (const ev of MORTAL_EVENTS) {
      for (const opt of ev.options) {
        expect(typeof opt.narrative).toBe('string');
        expect(opt.effects).toBeDefined();
      }
    }
  });
});

describe('DINNER_EVENTS', () => {
  it('应包含饭桌事件', () => {
    expect(DINNER_EVENTS.length).toBeGreaterThan(0);
    expect(DINNER_EVENTS[0].id).toMatch(/^d_/);
  });
});

describe('FESTIVAL_EVENTS', () => {
  it('应包含节日事件', () => {
    expect(FESTIVAL_EVENTS.length).toBeGreaterThan(0);
    expect(FESTIVAL_EVENTS[0].id).toMatch(/^f_/);
  });
});

describe('EXAM_EVENTS', () => {
  it('应包含考试事件，每个有 ageBand', () => {
    expect(EXAM_EVENTS.length).toBeGreaterThan(0);
    for (const ev of EXAM_EVENTS) {
      expect(ev.ageBand).toMatch(/^7-12$|^13-15$/);
    }
  });
});

describe('pickExamEvent', () => {
  it('age 7-12 应返回 7-12 年龄段的考试事件', () => {
    const ev = pickExamEvent(8);
    expect(ev).not.toBeNull();
    expect(ev!.ageBand).toBe('7-12');
  });

  it('age 13-15 应返回 13-15 年龄段的考试事件', () => {
    const ev = pickExamEvent(14);
    expect(ev).not.toBeNull();
    expect(ev!.ageBand).toBe('13-15');
  });

  it('age < 7 应返回 null', () => {
    expect(pickExamEvent(6)).toBeNull();
  });

  it('age >= 16 应返回 null', () => {
    expect(pickExamEvent(16)).toBeNull();
  });

  it('排除所有事件后应回退到全池', () => {
    // 排除所有 7-12 事件，应回退到全池所以仍返回一个有效事件
    const allIds = EXAM_EVENTS.filter((e) => e.ageBand === '7-12').map((e) => e.id);
    const ev = pickExamEvent(8, allIds);
    expect(ev).not.toBeNull();
    expect(ev!.ageBand).toBe('7-12');
  });
});