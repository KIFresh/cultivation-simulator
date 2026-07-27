import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSSEResponse } from '../stream-helper';
import { createStreamState } from '../stream-client';

// ============================================================
// createSSEResponse — SSE 流式响应工具
// ============================================================
describe('createSSEResponse', () => {
  it('返回 Response 对象且 Content-Type 正确', () => {
    async function* gen() {
      yield 'hello';
    }
    const response = createSSEResponse(gen());
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('逐块发送数据', async () => {
    async function* gen() {
      yield '块1';
      yield '块2';
      yield '块3';
    }
    const response = createSSEResponse(gen());
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const results: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(decoder.decode(value));
    }

    // 3个数据块 + 1个done事件
    expect(results.length).toBe(4);
    expect(results[0]).toContain('块1');
    expect(results[1]).toContain('块2');
    expect(results[2]).toContain('块3');
    expect(results[3]).toContain('"done":true');
    expect(results[3]).toContain('"fullText":"块1块2块3"');
  });

  it('onComplete 回调的结果作为 done 事件的数据', async () => {
    async function* gen() {
      yield '数据';
    }
    const response = createSSEResponse(gen(), async (fullText) => ({
      saved: true,
      text: fullText,
    }));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let lastEvent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastEvent = decoder.decode(value);
    }

    expect(lastEvent).toContain('"done":true');
    expect(lastEvent).toContain('"saved":true');
    const parsed = JSON.parse(lastEvent.replace('data: ', ''));
    expect(parsed.result.saved).toBe(true);
    expect(parsed.result.text).toBe('数据');
  });

  it('生成器报错时发送 error 事件', async () => {
    async function* gen() {
      yield '开始';
      throw new Error('模拟错误');
    }
    const response = createSSEResponse(gen());
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const events: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      events.push(decoder.decode(value));
    }

    // 至少应该有一个 error 事件
    const errorEvent = events.find((e) => e.includes('"error"'));
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toContain('模拟错误');
  });

  it('空生成器发送 done 事件后关闭', async () => {
    async function* gen() {
      // 什么都不 yield
    }
    const response = createSSEResponse(gen());
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
    }

    expect(result).toContain('"done":true');
    expect(result).toContain('"fullText":"');
  });

  it('committed 事件在首个 chunk 前发出', async () => {
    async function* gen() {
      yield '块1';
      yield '块2';
    }
    const response = createSSEResponse(gen(), undefined, { gameEventId: 'evt-1' });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      events.push(decoder.decode(value));
    }
    // 第一个事件必须是 committed（提交优先的乐观载荷）
    expect(events[0]).toContain('"committed"');
    expect(events[0]).toContain('evt-1');
  });

  it('onError 回调将 error 升级为结构化 narrativeError', async () => {
    async function* gen() {
      yield '开始';
      throw new Error('模拟错误');
    }
    const response = createSSEResponse(
      gen(),
      undefined,
      undefined,
      (err) => ({ code: 'TEST', message: (err as Error).message, type: 'ACTION', gameEventId: 'evt-x' }),
    );
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      events.push(decoder.decode(value));
    }
    const errorEvent = events.find((e) => e.includes('"error"'));
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toContain('"narrativeError"');
    expect(errorEvent).toContain('evt-x');
  });
});

// ============================================================
// createStreamState — 流式状态管理
// ============================================================
describe('createStreamState', () => {
  it('初始文本为空', () => {
    const state = createStreamState();
    expect(state.text).toBe('');
  });

  it('append 增加内容', () => {
    const state = createStreamState();
    state.append('你好');
    expect(state.text).toBe('你好');
    state.append('世界');
    expect(state.text).toBe('你好世界');
  });

  it('reset 清空内容', () => {
    const state = createStreamState();
    state.append('内容');
    state.reset();
    expect(state.text).toBe('');
  });

  it('subscribe 接收更新通知', () => {
    const state = createStreamState();
    const cb = vi.fn();
    state.subscribe(cb);

    state.append('新内容');
    expect(cb).toHaveBeenCalledWith('新内容');
  });

  it('subscribe 返回取消订阅函数', () => {
    const state = createStreamState();
    const cb = vi.fn();
    const unsubscribe = state.subscribe(cb);

    unsubscribe();
    state.append('新内容');
    expect(cb).not.toHaveBeenCalled();
  });

  it('多次 append 多次通知', () => {
    const state = createStreamState();
    const cb = vi.fn();
    state.subscribe(cb);

    state.append('第1段');
    state.append('第2段');
    state.append('第3段');

    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb).toHaveBeenLastCalledWith('第1段第2段第3段');
  });

  it('多个订阅者都收到通知', () => {
    const state = createStreamState();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    state.subscribe(cb1);
    state.subscribe(cb2);

    state.append('测试');

    expect(cb1).toHaveBeenCalledWith('测试');
    expect(cb2).toHaveBeenCalledWith('测试');
  });

  it('reset 后通知订阅者', () => {
    const state = createStreamState();
    const cb = vi.fn();
    state.subscribe(cb);

    state.append('旧内容');
    state.reset();

    // reset 时触发一次通知
    expect(cb).toHaveBeenLastCalledWith('');
  });
});