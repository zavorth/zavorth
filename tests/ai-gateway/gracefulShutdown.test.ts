import {
  initGracefulShutdown,
  isDraining,
  trackRequest,
  getActiveRequestCount,
} from '../../src/ai-gateway/lib/gracefulShutdown.js';

describe('gracefulShutdown', () => {
  beforeEach(() => {
    // Clear global state
    delete (globalThis as Record<string, unknown>).__ZavorthGatewayShutdown;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as Record<string, unknown>).__ZavorthGatewayShutdown;
  });

  it('should initialize with 0 active requests and not draining', () => {
    expect(isDraining()).toBe(false);
    expect(getActiveRequestCount()).toBe(0);
  });

  it('should track and untrack requests', () => {
    const done1 = trackRequest();
    expect(getActiveRequestCount()).toBe(1);

    const done2 = trackRequest();
    expect(getActiveRequestCount()).toBe(2);

    done1();
    expect(getActiveRequestCount()).toBe(1);

    // Calling done again should not double decrement
    done1();
    expect(getActiveRequestCount()).toBe(1);

    done2();
    expect(getActiveRequestCount()).toBe(0);
  });

  it('should register process signal listeners on init', () => {
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((_event: string | symbol, _listener: (...args: unknown[]) => void) => process) as unknown as typeof process.on);
    
    initGracefulShutdown();
    
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    
    processOnSpy.mockRestore();
  });

  it('should not register listeners twice if already initialized', () => {
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((_event: string | symbol, _listener: (...args: unknown[]) => void) => process) as unknown as typeof process.on);
    
    initGracefulShutdown();
    const calls = processOnSpy.mock.calls.length;
    
    initGracefulShutdown();
    expect(processOnSpy.mock.calls.length).toBe(calls);
    
    processOnSpy.mockRestore();
  });
});
