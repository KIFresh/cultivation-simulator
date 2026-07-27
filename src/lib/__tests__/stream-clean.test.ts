import { describe, it, expect } from 'vitest';
import { cleanNarrativeStream } from '../stream-client';

/**
 * 验证流式叙事预览清洗：
 *   1) 剥离代码栅栏 / 函数标签 / 思考标签
 *   2) 从 JSON 对象中提取 narr / narrative 字段作为展示文本
 *
 * 重点覆盖「开头栅栏被分块切断」的真实场景——清洗必须作用于「整体累积值」，
 * 因此消费者在 onChunk 处对 (prev + chunk) 整体重洗即可正确去掉跨块栅栏。
 */
describe('cleanNarrativeStream', () => {
  it('剥离开头的 ```json 栅栏并提取 narr 字段', () => {
    expect(cleanNarrativeStream('```json\n{"type":"ACTION","narrative":"你好"}'))
      .toBe('你好');
  });

  it('剥离无语言的 ``` 栅栏（后跟换行）', () => {
    expect(cleanNarrativeStream('```\n正文内容'))
      .toBe('正文内容');
  });

  it('剥离结尾的闭合栅栏并提取 narrative', () => {
    expect(cleanNarrativeStream('{"narrative":"你好"}\n```'))
      .toBe('你好');
  });

  it('剥离开头的 <function> 标签并提取 narr', () => {
    expect(cleanNarrativeStream('<function>{"type":"ACTION","narr":"你好"}'))
      .toBe('你好');
  });

  it('剥离开头的 <function_call> 与结尾 </function_call>', () => {
    expect(cleanNarrativeStream('<function_call>\n{"narr":"你好"}\n</function_call>'))
      .toBe('你好');
  });

  it('剥离开头的 <thinking> 标签', () => {
    expect(cleanNarrativeStream('<thinking>{"narrative":"你好"}'))
      .toBe('你好');
  });

  it('标签后紧跟栅栏也能嵌套剥离 + JSON 提取', () => {
    expect(cleanNarrativeStream('<function>```json\n{"narr":"你好"}\n```'))
      .toBe('你好');
  });

  it('模拟跨块切断：首块为 ```json，次块补全后整串重洗', () => {
    const acc1 = cleanNarrativeStream('' + '```json');
    // 仅收到开头栅栏时尚未补全，保留（避免误删可能合法的前导反引号内容）
    expect(acc1).toBe('```json');
    const acc2 = cleanNarrativeStream('```json' + '\n{"narrative":"你好"}');
    // 栅栏补全 + JSON 可解析 → 提取 narrative
    expect(acc2).toBe('你好');
  });

  it('正文中间的同类字符不受影响', () => {
    expect(cleanNarrativeStream('他说：「```不是栅栏```」这是正文'))
      .toBe('他说：「```不是栅栏```」这是正文');
  });

  it('无标签的纯净文本原样返回', () => {
    expect(cleanNarrativeStream('你好世界')).toBe('你好世界');
    expect(cleanNarrativeStream('')).toBe('');
  });

  // ── JSON 对象提取（核心新增行为）──

  it('从完整 JSON 对象中提取 narr 字段', () => {
    const json = '{"type":"ACTION","title":"春日的漫步","narr":"春日风暖送城郭的街角。","mood":"静","hint":"继续探索"}';
    expect(cleanNarrativeStream(json)).toBe('春日风暖送城郭的街角。');
  });

  it('从完整 JSON 对象中提取 narrative 字段（优先级低于 narr）', () => {
    const json = '{"type":"ACTION","narrative":"叙事正文内容","mood":"悟"}';
    expect(cleanNarrativeStream(json)).toBe('叙事正文内容');
  });

  it('同时有 narr 和 narrative 时优先取 narr', () => {
    const json = '{"narr":"优先这条","narrative":"不取这条"}';
    expect(cleanNarrativeStream(json)).toBe('优先这条');
  });

  it('JSON 不完整时（缺少闭合括号）回退到已清洗文本', () => {
    const incomplete = '{"type":"ACTION","narr":" hello';
    // JSON.parse 会抛错 → 回退，返回去栅栏/标签后的原始文本
    const result = cleanNarrativeStream(incomplete);
    expect(result).toBe(incomplete);
  });

  it('JSON 可解析但无 narr/narrative 字段时回退', () => {
    const noNarrField = '{"type":"ACTION","title":"test","mood":"静"}';
    const result = cleanNarrativeStream(noNarrField);
    // 无可提取字段 → 返回原 JSON 文本
    expect(result).toBe(noNarrField);
  });

  it('narr 为空字符串时回退', () => {
    const emptyNarr = '{"narr":"","narrative":""}';
    const result = cleanNarrativeStream(emptyNarr);
    expect(result).toBe(emptyNarr);
  });

  it('非 JSON 对象（以 { 开头但实际不是 JSON）不崩溃', () => {
    const notJson = '{这不是JSON';
    const result = cleanNarrativeStream(notJson);
    expect(result).toBe(notJson);
  });

  it('不支持 JSON 数组（以 [ 开头），原样返回', () => {
    const arr = '[1,2,3]';
    expect(cleanNarrativeStream(arr)).toBe(arr);
  });

  it('长叙事文本完整提取', () => {
    const longNarr = '春日风暖送城郭的街角，带来了些许飘絮和泥土的芬芳。三岁的穿着轻便的蓑衣，在小区附近的公园里踏青自娱。他不懂什么大道理，只是单纯地被路边盛开的迎春花吸引，试着小脑袋凑近闻了闻那股淡淡的清香。墙里发出无意义的咿呀声。在这平凡的春日午后，没有灵气的波动，也没有超凡的迹象。只有孩童对世界最原始的探索与天真。';
    const json = `{"type":"ACTION","title":"春日的漫步","narr":"${longNarr}","mood":"静","hint":"继续在城市中寻找"}`;
    expect(cleanNarrativeStream(json)).toBe(longNarr);
  });
});
