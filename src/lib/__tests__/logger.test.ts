import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('info logs with prefix', () => {
    logger.info('test info', 'extra');
    expect(console.log).toHaveBeenCalledWith('[info] test info extra');
  });

  it('warn logs with prefix', () => {
    logger.warn('test warn');
    expect(console.log).toHaveBeenCalledWith('[warn] test warn');
  });

  it('error logs with prefix', () => {
    logger.error('test error', { code: 1 });
    expect(console.log).toHaveBeenCalledWith('[error] test error [object Object]');
  });

  it('debug is suppressed by default minLevel info', () => {
    const prev = spy.mock.calls.length;
    logger.debug('debug msg');
    expect(spy.mock.calls.length).toBe(prev);
  });
});
