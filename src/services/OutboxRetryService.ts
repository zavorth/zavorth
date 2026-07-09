import fs from 'fs';
import path from 'path';
import type { ChannelGatewayRegistry } from '../gateways/ChannelGatewayRegistry.js';
import type { WebhookGateway } from '../gateways/WebhookGateway.js';
import type { CanonicalChannelOutboundEnvelope } from '../channels/contracts/ChannelMessageContract.js';
import { logger } from '../logger.js';

export class OutboxRetryService {
  private static instance: OutboxRetryService | null = null;

  public static getInstance(registry?: ChannelGatewayRegistry): OutboxRetryService {
    if (!OutboxRetryService.instance) {
      if (!registry) {
        throw new Error('Registry is required to initialize OutboxRetryService');
      }
      OutboxRetryService.instance = new OutboxRetryService(registry);
    }
    return OutboxRetryService.instance;
  }

  private readonly registry: ChannelGatewayRegistry;
  private readonly maxAttempts = 5;
  private readonly baseDelaySeconds = 30;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(registry: ChannelGatewayRegistry) {
    this.registry = registry;
  }

  public start(intervalMs = 15000): void {
    if (this.running) return;
    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      try {
        await this.processOutbox();
      } catch (error: unknown) {// Skip error logging in production daemon
      logger.warn('[Outbox Retry] lifecycle operation failed', error);
    }
      if (this.running) {
        this.timer = setTimeout(tick, intervalMs);
        if (this.timer && typeof this.timer.unref === 'function') {
          this.timer.unref();
        }
      }
    };
    this.timer = setTimeout(tick, intervalMs);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async processOutbox(): Promise<void> {
    const gateways = this.registry.listGateways();
    for (const gateway of gateways) {
      if (!gateway.resolveConfigured()) {
        continue;
      }
      const outboxDir = gateway.outboxDirectory;
      if (!fs.existsSync(outboxDir)) {
        continue;
      }

      let files: string[];
      try {
        files = fs.readdirSync(outboxDir).filter(f => f.endsWith('.json'));
      } catch (error: unknown) {continue;
      }

      for (const file of files) {
        const filePath = path.join(outboxDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const envelope = JSON.parse(content) as CanonicalChannelOutboundEnvelope & {
            attempts?: number;
            nextAttemptAt?: string;
          };

          // Skip if nextAttemptAt is in the future
          if (envelope.nextAttemptAt && new Date(envelope.nextAttemptAt) > new Date()) {
            continue;
          }

          const attempts = envelope.attempts || 0;
          const result = await gateway.retrySendLive(
            envelope.message,
            envelope.recipients || [],
            envelope.payload || envelope.message
          );

          if (result.ok) {
            // Success: delete file
            fs.unlinkSync(filePath);
          } else {
            // Failure
            const newAttempts = attempts + 1;
            if (newAttempts >= this.maxAttempts) {
              // Exceeded max attempts: move to rejected/
              const rejectedDir = path.join(outboxDir, 'rejected');
              fs.mkdirSync(rejectedDir, { recursive: true });
              const rejectedPath = path.join(rejectedDir, file);
              fs.writeFileSync(rejectedPath, JSON.stringify({
                ...envelope,
                attempts: newAttempts,
                lastError: result.reason,
                status: 'rejected',
                rejectedAt: new Date().toISOString()
              }, null, 2), 'utf8');
              fs.unlinkSync(filePath);
            } else {
              // Update outbox file with next attempt timestamp
              const jitter = Math.random() * 15;
              const delaySeconds = this.baseDelaySeconds * Math.pow(2, newAttempts) + jitter;
              const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

              fs.writeFileSync(filePath, JSON.stringify({
                ...envelope,
                attempts: newAttempts,
                lastError: result.reason,
                nextAttemptAt,
                lastAttemptAt: new Date().toISOString()
              }, null, 2), 'utf8');
            }
          }
        } catch (error: unknown) {// ignore parsing/reading errors for individual files
      logger.warn('[Outbox Retry] filesystem operation failed', error);
    }
      }
    }
  }
}
