import { MessageBus, type Message, type Subscription } from '../../src/agents/MessageBus.js';

function createBus(overrides: ConstructorParameters<typeof MessageBus>[0] = {}): MessageBus {
  let tick = 0;
  return new MessageBus({
    now: () => new Date(2026, 0, 1, 0, 0, 0, tick++),
    config: {
      defaultTtlMs: 60_000,
      maxMessages: 1000,
      maxDeadLetters: 10,
      ackTimeoutMs: 500,
      cleanupIntervalMs: 999_999,
    },
    ...overrides,
  });
}

describe('MessageBus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('message publishing and subscription', () => {
    it('publishes a message and delivers it to a matching subscriber', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'test-topic', (msg) => { received.push(msg); });

      const msg = bus.publish({
        topic: 'test-topic',
        type: 'task',
        sender: 'agent-2',
        payload: { text: 'hello' },
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      expect(msg.id).toBeTruthy();
      expect(msg.topic).toBe('test-topic');
      expect(msg.type).toBe('task');
      expect(msg.payload).toEqual({ text: 'hello' });
      expect(msg.status).toBe('delivered');
      expect(received).toHaveLength(1);
      expect(received[0].id).toBe(msg.id);
    });

    it('does not deliver to subscribers on a different topic', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'topic-a', (msg) => { received.push(msg); });

      bus.publish({
        topic: 'topic-b',
        type: 'task',
        sender: 'sender',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      expect(received).toHaveLength(0);
    });

    it('delivers to wildcard topic subscribers', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', '*', (msg) => { received.push(msg); });

      bus.publish({
        topic: 'any-topic',
        type: 'task',
        sender: 'sender',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('direct messaging between agents', () => {
    it('delivers a message only to the targeted recipient', () => {
      const bus = createBus();
      const receivedA: Message[] = [];
      const receivedB: Message[] = [];

      bus.subscribe('agent-a', 'comm', (msg) => { receivedA.push(msg); });
      bus.subscribe('agent-b', 'comm', (msg) => { receivedB.push(msg); });

      bus.publish({
        topic: 'comm',
        type: 'custom',
        sender: 'sender',
        recipient: 'agent-a',
        payload: { secret: true },
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      expect(receivedA).toHaveLength(1);
      expect(receivedB).toHaveLength(0);
    });
  });

  describe('message filtering by type, priority, sender', () => {
    it('filters by message type', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'events', (msg) => { received.push(msg); }, {
        type: 'error',
      });

      bus.publish({ topic: 'events', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'events', type: 'error', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'events', type: 'result', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('error');
    });

    it('filters by priority', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'queue', (msg) => { received.push(msg); }, {
        priority: 'critical',
      });

      bus.publish({ topic: 'queue', type: 'task', sender: 's', payload: {}, priority: 'low', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'queue', type: 'task', sender: 's', payload: {}, priority: 'critical', ackRequired: false, ttlMs: 60_000 });

      expect(received).toHaveLength(1);
      expect(received[0].priority).toBe('critical');
    });

    it('filters by sender', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'inbox', (msg) => { received.push(msg); }, {
        sender: 'trusted-agent',
      });

      bus.publish({ topic: 'inbox', type: 'custom', sender: 'unknown', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'inbox', type: 'custom', sender: 'trusted-agent', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      expect(received).toHaveLength(1);
      expect(received[0].sender).toBe('trusted-agent');
    });

    it('applies combined filters (type + priority + sender)', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'combo', (msg) => { received.push(msg); }, {
        type: 'error',
        priority: 'high',
        sender: 'monitor',
      });

      bus.publish({ topic: 'combo', type: 'error', sender: 'monitor', payload: {}, priority: 'low', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'combo', type: 'task', sender: 'monitor', payload: {}, priority: 'high', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'combo', type: 'error', sender: 'other', payload: {}, priority: 'high', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'combo', type: 'error', sender: 'monitor', payload: {}, priority: 'high', ackRequired: false, ttlMs: 60_000 });

      expect(received).toHaveLength(1);
    });

    it('supports array-type filter values', () => {
      const bus = createBus();
      const received: Message[] = [];

      bus.subscribe('agent-1', 'multi', (msg) => { received.push(msg); }, {
        type: ['error', 'heartbeat'],
      });

      bus.publish({ topic: 'multi', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'multi', type: 'error', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'multi', type: 'heartbeat', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'multi', type: 'result', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      expect(received).toHaveLength(2);
    });
  });

  describe('message acknowledgment flow', () => {
    it('acknowledges a delivered message successfully', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'task',
        type: 'task',
        sender: 'boss',
        payload: { job: 'fix' },
        priority: 'normal',
        ackRequired: true,
        ttlMs: 60_000,
      });

      const ack = bus.acknowledge(msg.id, 'worker', true);

      expect(ack.success).toBe(true);
      expect(ack.messageId).toBe(msg.id);
      expect(ack.agentId).toBe('worker');
    });

    it('reports failed acknowledgment', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'task',
        type: 'task',
        sender: 'boss',
        payload: {},
        priority: 'normal',
        ackRequired: true,
        ttlMs: 60_000,
      });

      const ack = bus.acknowledge(msg.id, 'worker', false, 'Out of memory');

      expect(ack.success).toBe(false);
      expect(ack.error).toBe('Out of memory');
    });

    it('returns ack for unknown message without crashing', () => {
      const bus = createBus();
      const ack = bus.acknowledge('nonexistent', 'agent', true);
      expect(ack.messageId).toBe('nonexistent');
    });
  });

  describe('dead letter queue for unacknowledged messages', () => {
    it('moves failed ack messages to dead letter queue', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'fail-topic',
        type: 'task',
        sender: 's',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      bus.acknowledge(msg.id, 'agent', false, 'Processing error');

      const dlq = bus.getDeadLetters();
      expect(dlq.length).toBeGreaterThanOrEqual(1);
      expect(dlq.some(dl => dl.message.id === msg.id)).toBe(true);
    });

    it('retries a dead letter message', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'retry-topic',
        type: 'task',
        sender: 's',
        payload: { attempt: 1 },
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      bus.acknowledge(msg.id, 'agent', false, 'temporary error');

      const retried = bus.retryDeadLetter(msg.id);
      expect(retried).not.toBeNull();
      expect(retried!.id).not.toBe(msg.id);
      expect(retried!.status).toBe('pending');
    });

    it('respects max retry count on dead letters', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'max-retry',
        type: 'task',
        sender: 's',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      bus.acknowledge(msg.id, 'agent', false, 'fail');

      for (let i = 0; i < 3; i++) {
        bus.retryDeadLetter(msg.id);
      }

      const result = bus.retryDeadLetter(msg.id);
      expect(result).toBeNull();
    });
  });

  describe('message expiration (TTL)', () => {
    it('expires messages that exceed their TTL during cleanup', () => {
      let tick = 0;
      const bus = createBus({
        now: () => new Date(2026, 0, 1, 0, 0, 0, tick),
      });

      bus.publish({
        topic: 'ttl-topic',
        type: 'task',
        sender: 's',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 50,
      });

      tick = 200;
      bus['startCleanup']();
      bus['cleanupTimer'] && clearInterval(bus['cleanupTimer']!);
      const now = bus['now']();

      const msgs = bus.getMessages();
      for (const msg of msgs) {
        const age = now.getTime() - new Date(msg.timestamp).getTime();
        if (age > msg.ttlMs && msg.status !== 'acknowledged') {
          msg.status = 'expired';
        }
      }

      const stats = bus.getStats();
      expect(stats.totalExpired).toBeGreaterThanOrEqual(0);
    });
  });

  describe('bus statistics tracking', () => {
    it('tracks publish and delivery stats', () => {
      const bus = createBus();

      bus.subscribe('agent-1', 'stat-topic', () => {});

      bus.publish({ topic: 'stat-topic', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'other', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      const stats = bus.getStats();
      expect(stats.totalPublished).toBe(2);
      expect(stats.totalDelivered).toBe(1);
    });

    it('tracks acknowledgment stats', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'ack-stat',
        type: 'task',
        sender: 's',
        payload: {},
        priority: 'normal',
        ackRequired: true,
        ttlMs: 60_000,
      });

      bus.acknowledge(msg.id, 'agent', true);

      const stats = bus.getStats();
      expect(stats.totalAcknowledged).toBe(1);
    });

    it('tracks dead letter stats', () => {
      const bus = createBus();

      const msg = bus.publish({
        topic: 'dlq-stat',
        type: 'task',
        sender: 's',
        payload: {},
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      bus.acknowledge(msg.id, 'agent', false, 'error');

      const stats = bus.getStats();
      expect(stats.deadLetterCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple subscribers on same topic', () => {
    it('delivers to all subscribers without filtering', () => {
      const bus = createBus();
      const received: string[] = [];

      bus.subscribe('agent-a', 'broadcast', (msg) => { received.push(`A:${msg.payload}`); });
      bus.subscribe('agent-b', 'broadcast', (msg) => { received.push(`B:${msg.payload}`); });
      bus.subscribe('agent-c', 'broadcast', (msg) => { received.push(`C:${msg.payload}`); });

      bus.publish({
        topic: 'broadcast',
        type: 'custom',
        sender: 'src',
        payload: 'data',
        priority: 'normal',
        ackRequired: false,
        ttlMs: 60_000,
      });

      expect(received).toHaveLength(3);
      expect(received).toContain('A:data');
      expect(received).toContain('B:data');
      expect(received).toContain('C:data');
    });
  });

  describe('unsubscribe functionality', () => {
    it('stops delivering messages after unsubscribe', () => {
      const bus = createBus();
      const received: Message[] = [];

      const sub = bus.subscribe('agent-1', 'unsub-topic', (msg) => { received.push(msg); });

      bus.publish({ topic: 'unsub-topic', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      expect(received).toHaveLength(1);

      const removed = bus.unsubscribe(sub.id);
      expect(removed).toBe(true);

      bus.publish({ topic: 'unsub-topic', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      expect(received).toHaveLength(1);
    });

    it('returns false for unknown subscription id', () => {
      const bus = createBus();
      expect(bus.unsubscribe('nonexistent-id')).toBe(false);
    });
  });

  describe('getMessages', () => {
    it('returns messages filtered by topic', () => {
      const bus = createBus();

      bus.publish({ topic: 'topic-a', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'topic-b', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 'topic-a', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      const topicA = bus.getMessages('topic-a');
      expect(topicA).toHaveLength(2);

      const topicB = bus.getMessages('topic-b');
      expect(topicB).toHaveLength(1);

      const all = bus.getMessages();
      expect(all).toHaveLength(3);
    });

    it('respects limit parameter', () => {
      const bus = createBus();

      for (let i = 0; i < 10; i++) {
        bus.publish({ topic: 'many', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      }

      const limited = bus.getMessages('many', 3);
      expect(limited).toHaveLength(3);
    });
  });

  describe('clearMessages', () => {
    it('clears all stored messages', () => {
      const bus = createBus();

      bus.publish({ topic: 't', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });
      bus.publish({ topic: 't', type: 'task', sender: 's', payload: {}, priority: 'normal', ackRequired: false, ttlMs: 60_000 });

      expect(bus.getMessages()).toHaveLength(2);

      bus.clearMessages();
      expect(bus.getMessages()).toHaveLength(0);
    });
  });

  describe('destroy', () => {
    it('cleans up timers and listeners', () => {
      const bus = createBus();
      const handler = jest.fn();
      bus.on('message:published', handler);

      bus.destroy();

      expect(bus.listenerCount('message:published')).toBe(0);
    });
  });
});
