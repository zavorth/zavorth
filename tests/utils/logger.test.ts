/**
 * @jest-environment node
 */
import { createLogger, logger } from '../../src/logger';

describe('Zavorth logger', () => {
  const originalDebug = process.env.ZAVORTH_DEBUG;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebugConsole = console.debug;

  afterEach(() => {
    process.env.ZAVORTH_DEBUG = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebugConsole;
  });

  it('redacts sensitive tokens in info messages', () => {
    const calls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      calls.push(args);
    };

    logger.info('auth Bearer sk_test_abcdefghijklmnopqrstuvwxyz123456');
    expect(calls).toHaveLength(1);
    const message = String(calls[0][0]);
    expect(message).toContain('[redacted]');
    expect(message).not.toContain('sk_test_abcdefghijklmnopqrstuvwxyz123456');
  });

  it('gates debug unless ZAVORTH_DEBUG is enabled', () => {
    const calls: unknown[][] = [];
    console.debug = (...args: unknown[]) => {
      calls.push(args);
    };

    delete process.env.ZAVORTH_DEBUG;
    delete process.env.DEBUG;
    logger.debug('should stay quiet');
    expect(calls).toHaveLength(0);

    process.env.ZAVORTH_DEBUG = 'zavorth';
    logger.debug('visible now');
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toContain('visible now');
  });

  it('createLogger prefixes scoped messages once', () => {
    const calls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      calls.push(args);
    };

    const scoped = createLogger('gateway');
    scoped.info('started');
    scoped.info('[gateway] already tagged');

    expect(String(calls[0][0])).toBe('[gateway] started');
    expect(String(calls[1][0])).toBe('[gateway] already tagged');
  });

  it('child scopes nest without dropping messages', () => {
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };

    createLogger('runtime').child('sessions').warn('checkpoint failed');
    expect(String(calls[0][0])).toBe('[runtime:sessions] checkpoint failed');
  });
});
