import type { WhatsAppGateway } from '../gateways/channels/whatsapp/WhatsAppGateway.js';
import { config } from '../config/index.js';

export type WhatsAppBridgeInboundPollerSnapshot = {
  contractVersion: 'zavorth-whatsapp-bridge-inbound-poller/1';
  generatedAt: string;
  experimental: true;
  tier: 'T2';
  running: boolean;
  bridgeUrl: string;
  pollTimeoutMs: number;
  stats: {
    polls: number;
    messages: number;
    accepted: number;
    rejected: number;
    errors: number;
    lastPollAt: string | null;
    lastMessageAt: string | null;
    lastError: string | null;
  };
};

type PollerDeps = {
  bridgeUrl?: string | null;
  pollTimeoutMs?: number;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  gateway?: Pick<WhatsAppGateway, 'onMessageReceived' | 'handleWebhookEvent'> | null;
  onMessage?: ((message: Record<string, unknown>) => Promise<boolean> | boolean) | null;
  sleepImpl?: (ms: number) => Promise<void>;
};

const DEFAULT_PORT = 3910;

export class WhatsAppBridgeInboundPollerService {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch;
  private readonly pollTimeoutMs: number;
  private readonly bridgeUrl: string;
  private readonly gateway: PollerDeps['gateway'];
  private readonly onMessage: PollerDeps['onMessage'];
  private readonly sleepImpl: (ms: number) => Promise<void>;

  private running = false;
  private loopPromise: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private polls = 0;
  private messages = 0;
  private accepted = 0;
  private rejected = 0;
  private errors = 0;
  private lastPollAt: string | null = null;
  private lastMessageAt: string | null = null;
  private lastError: string | null = null;

  public constructor(deps: PollerDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.fetchImpl = deps.fetchImpl || fetch;
    this.pollTimeoutMs = Math.min(Math.max(Number(deps.pollTimeoutMs || 25_000), 1_000), 60_000);
    this.bridgeUrl = this.resolveBridgeUrl(deps.bridgeUrl);
    this.gateway = deps.gateway || null;
    this.onMessage = deps.onMessage || null;
    this.sleepImpl = deps.sleepImpl || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  public start(): WhatsAppBridgeInboundPollerSnapshot {
    if (this.running) return this.snapshot();
    this.running = true;
    this.abort = new AbortController();
    this.loopPromise = this.loop().catch((error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.errors += 1;
      this.running = false;
    });
    return this.snapshot();
  }

  public async stop(): Promise<WhatsAppBridgeInboundPollerSnapshot> {
    this.running = false;
    this.abort?.abort();
    this.abort = null;
    if (this.loopPromise) {
      try {
        await Promise.race([
          this.loopPromise,
          this.sleepImpl(50),
        ]);
      } catch {
        // drain
      }
      this.loopPromise = null;
    }
    return this.snapshot();
  }

  public snapshot(): WhatsAppBridgeInboundPollerSnapshot {
    return {
      contractVersion: 'zavorth-whatsapp-bridge-inbound-poller/1',
      generatedAt: this.now().toISOString(),
      experimental: true,
      tier: 'T2',
      running: this.running,
      bridgeUrl: this.bridgeUrl,
      pollTimeoutMs: this.pollTimeoutMs,
      stats: {
        polls: this.polls,
        messages: this.messages,
        accepted: this.accepted,
        rejected: this.rejected,
        errors: this.errors,
        lastPollAt: this.lastPollAt,
        lastMessageAt: this.lastMessageAt,
        lastError: this.lastError,
      },
    };
  }

  public async pollOnce(): Promise<{ messages: number; accepted: number }> {
    const batch = await this.fetchMessages();
    let accepted = 0;
    for (const message of batch) {
      this.messages += 1;
      this.lastMessageAt = this.now().toISOString();
      const ok = await this.deliver(message);
      if (ok) accepted += 1;
      else this.rejected += 1;
    }
    this.accepted += accepted;
    return { messages: batch.length, accepted };
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce();
        if (!this.running) break;
        this.lastError = null;
      } catch (error: unknown) {
        if (!this.running) break;
        const message = error instanceof Error ? error.message : String(error);
        if (/abort/i.test(message)) break;
        this.errors += 1;
        this.lastError = message;
        await this.sleepImpl(1_500);
      }
    }
    this.running = false;
  }

  private async fetchMessages(): Promise<Record<string, unknown>[]> {
    this.polls += 1;
    this.lastPollAt = this.now().toISOString();
    const url = `${this.bridgeUrl}/messages...timeout=${this.pollTimeoutMs}`;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      signal: this.abort?.signal || AbortSignal.timeout(this.pollTimeoutMs + 5_000),
    });
    if (!response.ok) {
      throw new Error(`bridge /messages HTTP ${response.status}`);
    }
    const body = await response.json().catch(() => ({})) as {
      messages?: unknown;
      ok?: boolean;
    };
    const list = Array.isArray(body.messages) ? body.messages : [];
    return list.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
  }

  private async deliver(message: Record<string, unknown>): Promise<boolean> {
    const payload = this.normalizeInbound(message);
    if (this.onMessage) {
      return Boolean(await this.onMessage(payload));
    }
    if (this.gateway?.handleWebhookEvent) {
      const result = await this.gateway.handleWebhookEvent({ body: payload });
      return result.statusCode >= 200 && result.statusCode < 300;
    }
    if (this.gateway?.onMessageReceived) {
      return Boolean(await this.gateway.onMessageReceived(payload));
    }
    return false;
  }

  private normalizeInbound(message: Record<string, unknown>): Record<string, unknown> {
    const text = String(message.text || message.body || '').trim();
    const from = String(message.from || message.sender || message.wa_id || '').trim();
    const chatId = String(message.chatId || message.to || from || 'whatsapp').trim();
    return {
      ...message,
      text,
      body: text,
      from,
      sender: from,
      chatId,
      to: chatId,
      provider: 'baileys',
      tier: 'T2',
    };
  }

  private resolveBridgeUrl(explicit?: string | null): string {
    const configured = String(explicit || config.whatsappBridgeUrl || '').trim();
    if (configured) return configured.replace(/\/$/, '');
    return `http://127.0.0.1:${DEFAULT_PORT}`;
  }
}
