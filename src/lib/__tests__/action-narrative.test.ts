import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateActionNarrative } from '../narrative';

vi.mock('../narrative/provider', () => ({
  callAI: vi.fn(),
  buildSystemPrompt: vi.fn(() => ''),
}));

const mockCallAI = vi.mocked(await import('../narrative/provider')).callAI as jest.Mocked<any>;

const BASE_PARAMS = {
  cultivatorName: '赵晓安',
  spiritualRoot: '杂灵根',
  realm: '凡人',
  realmLevel: 1,
  age: 10,
  actionName: '与人交谈',
  actionDescription: '与身边的人交谈',
  expGained: 5,
  isAwakened: false,
  awakenEvent: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateActionNarrative - freeInput 保 Intent', () => {
  it('AI 返回空 narrative 且有 freeInput 时，fallback 保留具体意图', async () => {
    mockCallAI.mockResolvedValueOnce('{"type":"ACTION","title":"","narrative":"","mood":"静","hint":"","summary":""}');
    const result = await generateActionNarrative({ ...BASE_PARAMS, freeInput: '向爸爸要钱' });
    expect(result.narrative).toBe('赵晓安向爸爸要钱。');
    expect(result.summary).toBe('赵晓安向爸爸要钱。');
    expect(result.title).toBe('向爸爸要钱');
    expect(result.narrative).not.toContain('与人交谈，有所感悟');
  });

  it('AI 抛错且有 freeInput 时，fallback 保留具体意图', async () => {
    mockCallAI.mockRejectedValueOnce(new Error('AI 服务暂不可用'));
    const result = await generateActionNarrative({ ...BASE_PARAMS, freeInput: '叫妈妈' });
    expect(result.narrative).toBe('赵晓安叫妈妈。');
    expect(result.summary).toBe('赵晓安叫妈妈。');
    expect(result.title).toBe('叫妈妈');
  });

  it('无 freeInput 时保持通用行动 fallback', async () => {
    mockCallAI.mockRejectedValueOnce(new Error('AI 服务暂不可用'));
    const result = await generateActionNarrative(BASE_PARAMS);
    expect(result.narrative).toBe('赵晓安与人交谈，顺手把事做完了。');
    expect(result.summary).toBe('赵晓安与人交谈。');
  });

  it('AI 正常返回时优先使用 AI 结果', async () => {
    mockCallAI.mockResolvedValueOnce('{"type":"ACTION","title":"要零花钱","narrative":"赵晓安拽了拽爸爸的袖子，开口说今天想买文具。","mood":"静","hint":"看看爸爸的反应","summary":"向爸爸要钱。"}');
    const result = await generateActionNarrative({ ...BASE_PARAMS, freeInput: '向爸爸要钱' });
    expect(result.title).toBe('要零花钱');
    expect(result.summary).toBe('向爸爸要钱。');
    expect(result.narrative).toContain('爸爸');
  });
});

describe('generateActionNarrative - 选中角色约束', () => {
  it('传入 npcNames 时 prompt 包含选中角色必须出现的约束', async () => {
    mockCallAI.mockResolvedValueOnce('{"type":"ACTION","title":"回应","narrative":"赵晓安走到母亲面前，伸手要抱抱。","mood":"静","hint":"看看母亲的反应","summary":"向母亲撒娇。"}');
    await generateActionNarrative({ ...BASE_PARAMS, npcNames: ['赵母'], freeInput: '向妈妈要钱' });
    const promptArg = mockCallAI.mock.calls[0]?.[0]?.userPrompt ?? '';
    expect(promptArg).toContain('赵母');
    expect(promptArg).toContain('不得无依据将其替换为其他未选中角色');
  });

  it('传入 npcNames 且 AI 正常返回时，使用 AI 结果', async () => {
    mockCallAI.mockResolvedValueOnce('{"type":"ACTION","title":"要零花钱","narrative":"赵晓安拽着妈妈的衣角，仰头说要买新文具。","mood":"悟","hint":"妈妈会答应吗","summary":"向妈妈要零花钱。"}');
    const result = await generateActionNarrative({ ...BASE_PARAMS, npcNames: ['赵母'], freeInput: '向妈妈要钱' });
    expect(result.narrative).toContain('妈妈');
    expect(result.narrative).toContain('赵晓安');
    expect(result.narrative).not.toContain('爸爸');
  });

  it('选中 NPC 时，即使输入未点名也将其作为默认目标', async () => {
    mockCallAI.mockResolvedValueOnce('{"type":"ACTION","title":"送茶","narrative":"赵晓安把热茶递给赵母。","mood":"静","hint":"等候回应","summary":"为赵母递茶。"}');
    await generateActionNarrative({ ...BASE_PARAMS, npcNames: ['赵母'], freeInput: '递上一杯热茶' });
    const promptArg = mockCallAI.mock.calls[0]?.[0]?.userPrompt ?? '';
    expect(promptArg).toContain('【本次行动目标】赵母');
    expect(promptArg).toContain('即使玩家描述未出现其姓名或称谓');
  });

  it('选中 NPC 且 AI 返回错误时，fallback 保留目标与主动行为', async () => {
    mockCallAI.mockRejectedValueOnce(new Error('AI 服务暂不可用'));
    const result = await generateActionNarrative({ ...BASE_PARAMS, npcNames: ['赵母'], freeInput: '递上一杯热茶' });
    expect(result.narrative).toBe('赵晓安主动走到赵母面前，递上一杯热茶。');
    expect(result.summary).toContain('赵母');
  });

  it('选中 NPC 且没有输入时，fallback 仍保留目标', async () => {
    mockCallAI.mockRejectedValueOnce(new Error('AI 服务暂不可用'));
    const result = await generateActionNarrative({ ...BASE_PARAMS, npcNames: ['赵母'] });
    expect(result.narrative).toBe('赵晓安主动走到赵母面前，进行与人交谈。');
  });
});
