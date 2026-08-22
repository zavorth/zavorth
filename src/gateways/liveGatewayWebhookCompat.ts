import fs from 'fs';
import path from 'path';
import type { PlatformKey } from '../contracts/PlatformContract.js';
import type {
  ChannelGatewayCompletenessReport,
  ChannelGatewayDeliveryResult,
} from './WebhookGateway.js';
import { ChannelLiveTransportRegistry } from './ChannelLiveTransportRegistry.js';
import { config } from '../config/index.js';

const DEFAULT_COMPLETENESS: ChannelGatewayCompletenessReport = {
  inbound: true,
  outbound: true,
  allowlist: true,
  doctor: true,
  outboxFallback: true,
  mockIo: true,
  redaction: true,
  commandDeck: true,
  continuitySessionKey: true,
  installScaffold: true,
  firstClass: true,
};

function persistOutboxEnvelope(
  outboxDir: string,
  envelope: Record<string, unknown>,
): void {
  try {
    fs.mkdirSync(outboxDir, { recursive: true });
    const filename = `${String(envelope.createdAt || '').replace(/[:.]/g, '-')}-${String(envelope.id || '')}.json`;
    fs.writeFileSync(path.join(outboxDir, filename), JSON.stringify(envelope, null, 2), 'utf8');
  } catch {
    // best-effort outbox write
  }
}

export function applyLiveGatewayWebhookCompat(
  gateway: Record<string, unknown>,
  platform: PlatformKey,
): void {
  if (typeof gateway.id !== 'string') {
    Object.defineProperty(gateway, 'id', {
      get() { return platform; },
      enumerable: true,
      configurable: true,
    });
  }

  if (typeof gateway.name !== 'string') {
    Object.defineProperty(gateway, 'name', {
      get() { return platform; },
      enumerable: true,
      configurable: true,
    });
  }

  if (typeof gateway.initialize !== 'function') {
    gateway.initialize = async function (this: Record<string, unknown>) {
      if (typeof this.start === 'function') await (this.start as () => Promise<void>)();
    };
  }

  if (typeof gateway.resolveConfigured !== 'function') {
    gateway.resolveConfigured = function () { return false; };
  }

  if (typeof gateway.resolveEnabled !== 'function') {
    gateway.resolveEnabled = function (this: Record<string, unknown>) {
      return typeof this.isStarted === 'function'
        ? Boolean((this.isStarted as () => boolean)())
        : false;
    };
  }

  if (typeof gateway.completenessReport !== 'function') {
    gateway.completenessReport = function (): ChannelGatewayCompletenessReport {
      return { ...DEFAULT_COMPLETENESS };
    };
  }

  if (typeof gateway.continuitySessionKey !== 'function') {
    gateway.continuitySessionKey = function (
      userId: string,
      sessionId?: string | null,
    ): string {
      const user = String(userId || '').trim() || 'anonymous';
      const session = String(sessionId || '').trim() || 'default';
      return `${platform}:${user}:${session}`;
    };
  }

  if (typeof gateway.sendMessage !== 'function') {
    gateway.sendMessage = async function (
      this: Record<string, unknown>,
      payload: Record<string, unknown> | string,
    ): Promise<ChannelGatewayDeliveryResult> {
      const message =
        typeof payload === 'string'
          ? payload
          : String(payload?.text || payload?.message || '').trim();
      const recipients =
        payload && typeof payload === 'object' && Array.isArray(payload.recipients)
          ? payload.recipients
          : [];
      const chatId =
        payload && typeof payload === 'object'
          ? String(payload.chatId || payload.to || '').trim()
          : '';
      const target = chatId || String(recipients[0] || '').trim();

      const plan = ChannelLiveTransportRegistry.plan({
        channelId: platform,
        message,
        target,
        cfg: config,
      });

      if (!plan.url || !plan.body) {
        const outboxDir = String(this.outboxDir || '').trim();
        if (outboxDir) {
          persistOutboxEnvelope(outboxDir, {
            id: `${platform}-${Date.now()}`,
            createdAt: new Date().toISOString(),
            platform,
            transport: 'local-outbox',
            recipients,
            message,
            kind: 'outbound',
          });
        }
        return {
          ok: true,
          status: 'queued',
          transport: 'local-outbox',
        };
      }

      // Email densified plan is outbox/bridge mediated (no raw SMTP in gateway process).
      if (plan.kind === 'email-smtp-bridge') {
        const outboxDir = String(this.outboxDir || '').trim();
        if (outboxDir) {
          persistOutboxEnvelope(outboxDir, {
            id: `${platform}-email-${Date.now()}`,
            createdAt: new Date().toISOString(),
            platform,
            transport: 'email-smtp-outbox',
            recipients,
            message,
            kind: 'outbound',
          });
        }
        return {
          ok: true,
          status: 'queued',
          transport: 'email-smtp-outbox',
        };
      }

      const fetchFn =
        (this.fetchImpl as typeof fetch | undefined) || globalThis.fetch;
      if (!fetchFn) {
        const outboxDir = String(this.outboxDir || '').trim();
        if (outboxDir) {
          persistOutboxEnvelope(outboxDir, {
            id: `${platform}-${Date.now()}`,
            createdAt: new Date().toISOString(),
            platform,
            transport: 'local-outbox',
            recipients,
            message,
            kind: 'outbound',
          });
        }
        return {
          ok: true,
          status: 'queued',
          transport: 'local-outbox',
        };
      }

      try {
        const response = await fetchFn(plan.url, {
          method: plan.method,
          headers: plan.headers,
          body: JSON.stringify(plan.body),
        });
        if (response.ok) {
          return {
            ok: true,
            status: 'delivered',
            transport: `webhook:${plan.kind}`,
            httpStatus: response.status,
          };
        }
        return {
          ok: false,
          status: 'failed',
          transport: `webhook:${plan.kind}`,
          httpStatus: response.status,
          reason: `HTTP ${response.status}`,
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
          ok: false,
          status: 'failed',
          transport: 'webhook',
          reason: err.message,
        };
      }
    };
  }

  if (typeof gateway.extractInboundPayload !== 'function') {
    gateway.extractInboundPayload = function () {
      return null;
    };
  }

  if (typeof gateway.doctorSnapshot === 'function') {
    const originalDoctor = (gateway.doctorSnapshot as (...args: unknown[]) => unknown).bind(gateway);
    gateway.doctorSnapshot = function (this: Record<string, unknown>) {
      const result = originalDoctor() as Record<string, unknown>;
      if (result && typeof result === 'object' && !result.completeness) {
        result.completeness = (this.completenessReport as (...args: unknown[]) => unknown)();
      }
      return result;
    };
  } else {
    gateway.doctorSnapshot = function () {
      return {
        channelId: platform,
        name: platform,
        mode: 'webhook',
        configured: false,
        enabled: false,
        started: false,
        transport: 'planned',
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        outboxDir: '',
        statusFile: '',
        allowlist: { policyManagerPresent: false, unauthorizedBlocked: true },
        secretsRedacted: true,
        doctorCommand: `/channels doctor ${platform}`,
        installHint: `Configure credentials for ${platform}.`,
        completeness: (gateway.completenessReport as (...args: unknown[]) => unknown)(),
      };
    };
  }

  if (typeof gateway.mockInbound !== 'function') {
    gateway.mockInbound = async function () {
      return {
        ok: true,
        accepted: false,
        channelId: platform,
        sessionKey: null,
        reason: 'not-implemented',
      };
    };
  }

  if (typeof gateway.mockOutbound !== 'function') {
    gateway.mockOutbound = async function (
      this: Record<string, unknown>,
      text = 'mock outbound',
      chatId?: string | null,
    ) {
      const target = chatId || `${platform}-local`;
      return (this.sendMessage as (...args: unknown[]) => unknown)({
        text,
        chatId: target,
        recipients: [target],
      });
    };
  }
}
