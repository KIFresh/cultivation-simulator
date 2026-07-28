import { describe, it, expect, vi } from 'vitest';
import {
  appendToSummary,
  shouldCompress,
  buildStateContext,
  stateFromCultivator,
  buildSummaryFromEntries,
  createEntry,
  fallbackBirthName,
  validateBirthConsistency,
} from '../narrative';
import { getFateFirstMeetOffset } from '../encounter-data';

// 模拟依赖
vi.mock('../cultivation-data', () => ({
  formatRealmLevel: vi.fn((realm: string, level: number) => {
    if (realm === '炼气期') return '第一层';
    if (level === 1) return '初期';
    return '';
  }),
  LOCATIONS: [
    { id: 'home', name: '家', icon: '🏠', description: '温馨的家', unlockAge: 0, distanceFromHome: 0 },
    { id: 'wild', name: '野外', icon: '🌲', description: '野外', unlockAge: 16, distanceFromHome: 8 },
  ],
  SpiritualRoot: {} as any,
  getNPCsAtLocation: vi.fn(() => []),
}));

vi.mock('../worlds-data', () => ({
  getWorldAIPrompt: vi.fn(() => ''),
}));

describe('narrative', () => {
  describe('getFateFirstMeetOffset', () => {
    it('should return 0 for null/undefined', () => {
      expect(getFateFirstMeetOffset(null)).toBe(0);
      expect(getFateFirstMeetOffset(undefined)).toBe(0);
    });

    it('should return a deterministic offset for a given fate', () => {
      const offset1 = getFateFirstMeetOffset('test_fate');
      const offset2 = getFateFirstMeetOffset('test_fate');
      expect(offset1).toBe(offset2);
    });

    it('should return value in range -3 to +6', () => {
      for (const fate of ['a', 'b', 'c', 'hello', 'world', '天选之人', '命运之子']) {
        const offset = getFateFirstMeetOffset(fate);
        expect(offset).toBeGreaterThanOrEqual(-3);
        expect(offset).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('appendToSummary', () => {
    it('should create first line when summary is null', () => {
      const result = appendToSummary(null, { title: '测试', narrative: '这是一段叙事内容' });
      expect(result).toBe('【测试】这是一段叙事内容');
    });

    it('should append to existing summary', () => {
      const result = appendToSummary('【之前】之前内容', { title: '新事件', narrative: '新叙事内容' });
      expect(result).toBe('【之前】之前内容\n【新事件】新叙事内容');
    });

    it('should truncate narrative to 60 chars', () => {
      const longNarrative = '这是一段很长的叙事内容，目的是测试截断功能是否正常工作，超过六十个字符后应该被截断并加上省略号，这是额外加长以确保超过六十字符限制';
      const result = appendToSummary(null, { title: '测试', narrative: longNarrative });
      expect(result.length).toBeLessThanOrEqual(70); // 标题 + 60 + …
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('shouldCompress', () => {
    it('should return false for short summary', () => {
      expect(shouldCompress('短文本')).toBe(false);
    });

    it('should return true for long summary > 1000 chars', () => {
      const long = 'x'.repeat(1001);
      expect(shouldCompress(long)).toBe(true);
    });

    it('should ignore newlines in length calculation', () => {
      const text = 'x'.repeat(1000) + '\n';
      // 去掉换行后长度 1000，不应压缩
      expect(shouldCompress(text)).toBe(false);
    });
  });

  describe('buildStateContext', () => {
    it('should return empty string for undefined', () => {
      expect(buildStateContext()).toBe('');
    });

    it('should include name and age', () => {
      const ctx = buildStateContext({ name: '张三', age: 20 });
      expect(ctx).toContain('张三');
      expect(ctx).toContain('20岁');
    });

    it('should include realm info when not 凡人', () => {
      const ctx = buildStateContext({ name: '李四', age: 25, realm: '炼气期', realmLevel: 1 });
      expect(ctx).toContain('炼气期');
    });

    it('should include gold when provided', () => {
      const ctx = buildStateContext({ name: '王五', age: 30, gold: 500 });
      expect(ctx).toContain('金币500');
    });

    it('should include location when provided', () => {
      const ctx = buildStateContext({ name: '赵六', age: 20, locationId: 'home' });
      expect(ctx).toContain('身处家');
    });

    it('should include location description when available', () => {
      const ctx = buildStateContext({ name: '赵六', age: 20, locationId: 'home' });
      expect(ctx).toContain('氛围');
    });
  });

  describe('stateFromCultivator', () => {
    it('should map cultivator fields to state', () => {
      const state = stateFromCultivator({
        name: '测试者', age: 20, realm: '炼气期', realmLevel: 1,
        gold: 100, stamina: 50, quarter: 2, location: 'wild',
      });
      expect(state.name).toBe('测试者');
      expect(state.age).toBe(20);
      expect(state.realm).toBe('炼气期');
      expect(state.gold).toBe(100);
      expect(state.stamina).toBe(50);
      expect(state.locationId).toBe('wild');
    });

    it('should default location to home', () => {
      const state = stateFromCultivator({ name: 'test', age: 10, realm: '凡人' });
      expect(state.locationId).toBe('home');
    });
  });

  describe('buildSummaryFromEntries', () => {
    it('should return empty string for empty array', () => {
      expect(buildSummaryFromEntries([])).toBe('');
    });

    it('should format entries with title and summary', () => {
      const entries = [
        { id: '1', title: '事件一', summary: '描述一', important: false, createdAt: '' },
        { id: '2', title: '事件二', summary: '描述二', important: true, createdAt: '' },
      ];
      const result = buildSummaryFromEntries(entries);
      expect(result).toContain('【事件一】描述一');
      expect(result).toContain('⭐');
      expect(result).toContain('【事件二】描述二');
    });
  });

  describe('createEntry', () => {
    it('should create a StoryEntry with id and title', () => {
      const entry = createEntry('测试标题', '测试摘要');
      expect(entry.title).toBe('测试标题');
      expect(entry.summary).toBe('测试摘要');
      expect(entry.id).toBeTruthy();
      expect(typeof entry.important).toBe('boolean');
    });

    it('should truncate summary to 60 chars by default', () => {
      const longSummary = 'a'.repeat(100);
      const entry = createEntry('测试', longSummary);
      expect(entry.summary.length).toBeLessThanOrEqual(61); // 60 + '…'
    });

    it('should not truncate when truncate=false', () => {
      const longSummary = 'a'.repeat(100);
      const entry = createEntry('测试', longSummary, false);
      expect(entry.summary.length).toBe(100);
    });
  });

  describe('fallbackBirthName', () => {
    it('should return a 2-4 character Chinese name', () => {
      const name = fallbackBirthName();
      expect(name).toMatch(/^[\u4e00-\u9fff]{2,4}$/);
    });
  });

  describe('validateBirthConsistency', () => {
    it('should return empty array for valid consistency', () => {
      const narrative = '父亲李建国抱着刚出生的婴儿，母亲王芳在一旁微笑。';
      const family = [
        { relation: '父亲', name: '李建国', age: 38, alive: true },
        { relation: '母亲', name: '王芳', age: 36, alive: true },
      ];
      const errors = validateBirthConsistency(narrative, '婴儿', family);
      expect(errors).toEqual([]);
    });

    it('should detect missing family member mentioned in narrative', () => {
      const narrative = '父亲李建国走了过来。';
      const errors = validateBirthConsistency(narrative, '小明', []);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid age', () => {
      const narrative = '父亲李建国抱着孩子。';
      const family = [
        { relation: '父亲', name: '李建国', age: -1, alive: true },
      ];
      const errors = validateBirthConsistency(narrative, '小明', family);
      expect(errors.some(e => e.includes('年龄'))).toBe(true);
    });

    it('should detect non-boolean alive', () => {
      const narrative = '父亲李建国。';
      const family = [
        { relation: '父亲', name: '李建国', age: 30, alive: 1 as any },
      ];
      const errors = validateBirthConsistency(narrative, '小明', family);
      expect(errors.some(e => e.includes('alive'))).toBe(true);
    });

    it('should detect duplicate core relations', () => {
      const narrative = '父亲李建国和父亲张伟。';
      const family = [
        { relation: '父亲', name: '李建国', age: 38, alive: true },
        { relation: '父亲', name: '张伟', age: 40, alive: true },
      ];
      const errors = validateBirthConsistency(narrative, '小明', family);
      expect(errors.some(e => e.includes('重复'))).toBe(true);
    });
  });
});