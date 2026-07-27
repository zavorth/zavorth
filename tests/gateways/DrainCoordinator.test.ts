import { DrainCoordinator } from '../../src/gateways/DrainCoordinator.js';

describe('DrainCoordinator', () => {
  let coordinator: DrainCoordinator;

  beforeEach(() => {
    jest.useFakeTimers();
    coordinator = new DrainCoordinator();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default state', () => {
    expect(coordinator.isDraining()).toBe(false);
    expect(coordinator.getState()).toEqual({
      isDraining: false,
      activeRequests: 0,
      completedRequests: 0,
      targetGateways: [],
    });
    expect(coordinator.getEvents()).toHaveLength(0);
    expect(coordinator.getStats()).toEqual({
      active: 0,
      completed: 0,
      isDraining: false,
    });
  });

  it('should allow configuration overrides', () => {
    coordinator.configure({ timeoutMs: 5000, propagateToChannels: false });
    // We can verify this by checking if the timeout triggers at 5000ms
    coordinator.startDrain();
    expect(coordinator.isDraining()).toBe(true);

    jest.advanceTimersByTime(4999);
    expect(coordinator.isDraining()).toBe(true);

    jest.advanceTimersByTime(1);
    expect(coordinator.isDraining()).toBe(false);
    expect(coordinator.getEvents().map(e => e.type)).toContain('drain_timeout');
  });

  it('should start and stop drain correctly', async () => {
    coordinator.startDrain(['gw1', 'gw2']);
    expect(coordinator.isDraining()).toBe(true);
    expect(coordinator.getState().targetGateways).toEqual(['gw1', 'gw2']);
    expect(coordinator.getEvents()[0].type).toBe('drain_started');

    const drainPromise = coordinator.waitForDrain();
    coordinator.stopDrain();

    expect(coordinator.isDraining()).toBe(false);
    await expect(drainPromise).resolves.toBeUndefined();
  });

  it('should not start drain if already draining', () => {
    coordinator.startDrain();
    const eventsBefore = coordinator.getEvents().length;
    coordinator.startDrain();
    expect(coordinator.getEvents().length).toBe(eventsBefore);
  });

  it('should track active and completed requests', () => {
    coordinator.recordRequest();
    coordinator.recordRequest();
    expect(coordinator.getStats().active).toBe(2);

    coordinator.completeRequest();
    expect(coordinator.getStats().active).toBe(1);
    expect(coordinator.getStats().completed).toBe(1);
    expect(coordinator.getEvents().map(e => e.type)).toContain('request_completed');
  });

  it('should automatically complete drain when active requests drop to zero', async () => {
    coordinator.recordRequest();
    coordinator.startDrain();
    expect(coordinator.isDraining()).toBe(true);

    const drainPromise = coordinator.waitForDrain();
    coordinator.completeRequest();

    expect(coordinator.isDraining()).toBe(false);
    expect(coordinator.getEvents().map(e => e.type)).toContain('drain_complete');
    await expect(drainPromise).resolves.toBeUndefined();
  });

  it('should resolve waitForDrain immediately if not draining', async () => {
    await expect(coordinator.waitForDrain()).resolves.toBeUndefined();
  });
});
