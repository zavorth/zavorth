import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';

export type MessageType = 'task' | 'result' | 'error' | 'heartbeat' | 'status' | 'custom';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export type MessageStatus = 'pending' | 'delivered' | 'acknowledged' | 'failed' | 'expired';

export type Message = {
  id: string;
  topic: string;
  type: MessageType;
  sender: string;
  recipient?: string;
  payload: unknown;
  priority: MessagePriority;
  timestamp: string;
  ackRequired: boolean;
  ttlMs: number;
  status: MessageStatus;
};

export type Subscription = {
  id: string;
  agentId: string;
  topic: string;
  filter?: MessageFilter;
  callback: (message: Message) => void | Promise<void>;
  active: boolean;
};

export type MessageAck = {
  messageId: string;
  agentId: string;
  timestamp: string;
  success: boolean;
  error?: string;
};

export type DeadLetter = {
  message: Message;
  reason: string;
  timestamp: string;
  retryCount: number;
};

export type BusStats = {
  totalPublished: number;
  totalDelivered: number;
  totalAcknowledged: number;
  totalFailed: number;
  totalExpired: number;
  deadLetterCount: number;
};

export type MessageFilter = {
  type?: MessageType | MessageType[];
  priority?: MessagePriority | MessagePriority[];
  sender?: string | string[];
};

export type MessageBusConfig = {
  defaultTtlMs?: number;
  maxMessages?: number;
  maxDeadLetters?: number;
  ackTimeoutMs?: number;
  cleanupIntervalMs?: number;
};

export type MessageBusRuntime = {
  now?: () => Date;
  config?: MessageBusConfig;
  logger?: typeof logger;
};

type BusLifecycleEvent =
  | 'message:published'
  | 'message:delivered'
  | 'message:acknowledged'
  | 'message:failed'
  | 'message:expired'
  | 'message:dead-lettered'
  | 'message:retried'
  | 'subscription:added'
  | 'subscription:removed';

const PRIORITY_ORDER: Record<MessagePriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const DEFAULT_CONFIG: Required<MessageBusConfig> = {
  defaultTtlMs: 60_000,
  maxMessages: 10_000,
  maxDeadLetters: 1_000,
  ackTimeoutMs: 30_000,
  cleanupIntervalMs: 5_000,
};

export class MessageBus extends EventEmitter {
  private readonly now: () => Date;
  private readonly config: Required<MessageBusConfig>;
  private readonly log: typeof logger;

  private readonly messages: Message[] = [];
  private readonly pendingAcks: Map<string, NodeJS.Timeout> = new Map();
  private readonly subscriptions: Map<string, Subscription> = new Map();
  private readonly deadLetters: DeadLetter[] = [];
  private readonly stats: BusStats = {
    totalPublished: 0,
    totalDelivered: 0,
    totalAcknowledged: 0,
    totalFailed: 0,
    totalExpired: 0,
    deadLetterCount: 0,
  };

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(runtime: MessageBusRuntime = {}) {
    super();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.log = runtime.logger || logger;
    this.startCleanup();
  }

  publish(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const full: Message = {
      ...message,
      id: uuidv4(),
      timestamp: this.now().toISOString(),
      status: 'pending',
    };

    this.messages.push(full);
    this.trimMessages();
    this.stats.totalPublished++;

    this.log.info(`[MessageBus] Published message ${full.id} to topic "${full.topic}" from "${full.sender}"`);

    if (full.ackRequired) {
      this.scheduleAckTimeout(full);
    }

    const matching = this.findMatchingSubscriptions(full);
    for (const sub of matching) {
      if (!sub.active) continue;

      if (full.recipient && sub.agentId !== full.recipient) continue;

      this.stats.totalDelivered++;
      full.status = 'delivered';
      this.emit('message:delivered', full);
      this.safeCallback(sub.callback, full);
    }

    this.emit('message:published', full);
    return full;
  }

  subscribe(agentId: string, topic: string, callback: Subscription['callback'], filter?: MessageFilter): Subscription {
    const sub: Subscription = {
      id: uuidv4(),
      agentId,
      topic,
      filter,
      callback,
      active: true,
    };

    this.subscriptions.set(sub.id, sub);
    this.log.info(`[MessageBus] Agent "${agentId}" subscribed to topic "${topic}" (sub=${sub.id})`);
    this.emit('subscription:added', sub);
    return sub;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    this.subscriptions.delete(subscriptionId);
    this.log.info(`[MessageBus] Unsubscribed ${subscriptionId}`);
    this.emit('subscription:removed', sub);
    return true;
  }

  acknowledge(messageId: string, agentId: string, success: boolean, error?: string): MessageAck {
    const ack: MessageAck = {
      messageId,
      agentId,
      timestamp: this.now().toISOString(),
      success,
      error,
    };

    const timer = this.pendingAcks.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.pendingAcks.delete(messageId);
    }

    const msg = this.messages.find(m => m.id === messageId);
    if (msg) {
      if (success) {
        msg.status = 'acknowledged';
        this.stats.totalAcknowledged++;
        this.emit('message:acknowledged', ack);
        this.log.info(`[MessageBus] Message ${messageId} acknowledged by "${agentId}"`);
      } else {
        msg.status = 'failed';
        this.stats.totalFailed++;
        this.addToDeadLetter(msg, error || 'Acknowledgment failed');
        this.emit('message:failed', ack);
        this.log.warn(`[MessageBus] Message ${messageId} failed ack from "${agentId}": ${error}`);
      }
    }

    return ack;
  }

  getDeadLetters(): DeadLetter[] {
    return Array.from(this.deadLetters);
  }

  retryDeadLetter(messageId: string): Message | null {
    const index = this.deadLetters.findIndex(dl => dl.message.id === messageId);
    if (index === -1) return null;

    const dl = this.deadLetters[index];
    dl.retryCount++;

    if (dl.retryCount > 3) {
      this.log.warn(`[MessageBus] Dead letter ${messageId} exceeded max retries (${dl.retryCount})`);
      return null;
    }

    this.deadLetters.splice(index, 1);
    this.stats.deadLetterCount--;

    const msg = dl.message;
    msg.status = 'pending';
    this.emit('message:retried', msg);

    this.log.info(`[MessageBus] Retrying dead letter ${messageId} (attempt ${dl.retryCount})`);

    const republished: Message = {
      ...msg,
      id: uuidv4(),
      timestamp: this.now().toISOString(),
    };

    this.messages.push(republished);
    this.trimMessages();
    this.stats.totalPublished++;

    if (republished.ackRequired) {
      this.scheduleAckTimeout(republished);
    }

    const matching = this.findMatchingSubscriptions(republished);
    for (const sub of matching) {
      if (!sub.active) continue;
      if (republished.recipient && sub.agentId !== republished.recipient) continue;

      this.stats.totalDelivered++;
      republished.status = 'delivered';
      this.safeCallback(sub.callback, republished);
    }

    return republished;
  }

  getStats(): BusStats {
    return { ...this.stats };
  }

  getMessages(topic?: string, limit: number = 50): Message[] {
    let result = this.messages;
    if (topic) {
      result = result.filter(m => m.topic === topic);
    }
    return result.slice(-limit);
  }

  clearMessages(): void {
    this.messages.length = 0;
    this.log.info('[MessageBus] Message history cleared');
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const timer of this.pendingAcks.values()) {
      clearTimeout(timer);
    }
    this.pendingAcks.clear();
    this.removeAllListeners();
  }

  private findMatchingSubscriptions(message: Message): Subscription[] {
    const results: Subscription[] = [];

    Array.from(this.subscriptions.values()).forEach(sub => {
      if (!sub.active) return;
      if (sub.topic !== '*' && sub.topic !== message.topic) return;
      if (sub.filter && !this.matchesFilter(message, sub.filter)) return;
      results.push(sub);
    });

    results.sort((a, b) => {
      const aIdx = PRIORITY_ORDER[message.priority] ?? 2;
      const bIdx = PRIORITY_ORDER[message.priority] ?? 2;
      return aIdx - bIdx;
    });

    return results;
  }

  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(message.type)) return false;
    }

    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      if (!priorities.includes(message.priority)) return false;
    }

    if (filter.sender) {
      const senders = Array.isArray(filter.sender) ? filter.sender : [filter.sender];
      if (!senders.includes(message.sender)) return false;
    }

    return true;
  }

  private scheduleAckTimeout(message: Message): void {
    const timer = setTimeout(() => {
      this.pendingAcks.delete(message.id);
      if (message.status === 'pending' || message.status === 'delivered') {
        message.status = 'expired';
        this.stats.totalExpired++;
        this.addToDeadLetter(message, 'Acknowledgment timeout');
        this.emit('message:expired', message);
        this.log.warn(`[MessageBus] Message ${message.id} expired (no ack within ${this.config.ackTimeoutMs}ms)`);
      }
    }, this.config.ackTimeoutMs);

    this.pendingAcks.set(message.id, timer);
  }

  private addToDeadLetter(message: Message, reason: string): void {
    const existing = this.deadLetters.find(dl => dl.message.id === message.id);
    if (existing) return;

    this.deadLetters.push({
      message,
      reason,
      timestamp: this.now().toISOString(),
      retryCount: 0,
    });

    if (this.deadLetters.length > this.config.maxDeadLetters) {
      this.deadLetters.shift();
    }

    this.stats.deadLetterCount++;
    this.emit('message:dead-lettered', { message, reason });
  }

  private trimMessages(): void {
    while (this.messages.length > this.config.maxMessages) {
      this.messages.shift();
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = this.now().getTime();
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const msg = this.messages[i];
        const age = now - new Date(msg.timestamp).getTime();
        if (age > msg.ttlMs) {
          if (msg.status !== 'acknowledged') {
            msg.status = 'expired';
            this.stats.totalExpired++;
            this.addToDeadLetter(msg, 'TTL expired');
          }
          this.messages.splice(i, 1);
        }
      }
    }, this.config.cleanupIntervalMs);
  }

  private safeCallback(callback: Subscription['callback'], message: Message): void {
    try {
      const result = callback(message);
      if (result instanceof Promise) {
        result.catch(err => {
          this.log.error(`[MessageBus] Callback error for message ${message.id}: ${err}`);
        });
      }
    } catch (err: any) { const error = err; const e = err;
      this.log.error(`[MessageBus] Callback error for message ${message.id}: ${err}`);
    }
  }
}
