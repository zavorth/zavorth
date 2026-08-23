import { TypingHeartbeat } from '../../src/channels/presence/TypingHeartbeat.js';

function createDeferredActionLog() {
  const calls: number[] = [];
  return {
    calls,
    sendAction: async () => {
      calls.push(Date.now());
    },
  };
}

describe('TypingHeartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends an action immediately and renews on the interval', async () => {
    const action = createDeferredActionLog();
    const heartbeat = new TypingHeartbeat({ sendAction: action.sendAction, intervalMs: 1000, maxDurationMs: 10000 });
    heartbeat.start();

    await jest.advanceTimersByTimeAsync(0);
    expect(action.calls.length).toBe(1);

    await jest.advanceTimersByTimeAsync(3000);
    expect(action.calls.length).toBeGreaterThanOrEqual(3);

    heartbeat.stop();
  });

  it('stops itself after the maximum duration even without stop()', async () => {
    const action = createDeferredActionLog();
    const heartbeat = new TypingHeartbeat({ sendAction: action.sendAction, intervalMs: 500, maxDurationMs: 2000 });
    heartbeat.start();

    await jest.advanceTimersByTimeAsync(60000);
    const countAfterCap = action.calls.length;
    expect(countAfterCap).toBeGreaterThan(1);

    await jest.advanceTimersByTimeAsync(60000);
    expect(action.calls.length).toBe(countAfterCap);
  });

  it('ignores start while already running and swallows action failures', async () => {
    let attempts = 0;
    const heartbeat = new TypingHeartbeat({
      sendAction: async () => {
        attempts += 1;
        throw new Error('transport unavailable');
      },
      intervalMs: 500,
      maxDurationMs: 1200,
    });
    heartbeat.start();
    heartbeat.start();

    await jest.advanceTimersByTimeAsync(1300);
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThan(10);
  });

  it('stop() prevents further renewals immediately', async () => {
    const action = createDeferredActionLog();
    const heartbeat = new TypingHeartbeat({ sendAction: action.sendAction, intervalMs: 500, maxDurationMs: 60000 });
    heartbeat.start();
    await jest.advanceTimersByTimeAsync(0);
    heartbeat.stop();

    const countAtStop = action.calls.length;
    await jest.advanceTimersByTimeAsync(10000);
    expect(action.calls.length).toBe(countAtStop);
  });
});
