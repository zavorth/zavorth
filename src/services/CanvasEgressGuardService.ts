import { logger } from '../logger.js';
import { randomUUID } from 'node:crypto';
import type { CanvasEgressEvent } from '../contracts/ExecutionEngineContract';

export type CanvasEgressDecision = {
  allowed: boolean;
  reason: string;
  event: CanvasEgressEvent | null;
};

export type CanvasEgressPolicy = {
  allowedDomains?: string[];
  allowLocalhost?: boolean;
};

export class CanvasEgressGuardService {
  public evaluateRequest(url: string, policy: CanvasEgressPolicy = {}): CanvasEgressDecision {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('#')) {
      return { allowed: true, reason: 'Local canvas asset.', event: null };
    }
    if (/^(data|blob|about):/i.test(trimmed)) {
      return { allowed: true, reason: 'Browser-local asset.', event: null };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch (error: unknown) {logger.warn('[Canvas Egress Guard] parsing failed', error);
    return { allowed: true, reason: 'Relative canvas asset.', event: null };
  }

    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (policy.allowLocalhost !== false && isLocalhost) {
      return { allowed: true, reason: 'Localhost preview asset.', event: null };
    }

    const allowedDomains = (policy.allowedDomains || []).map((domain) => domain.toLowerCase());
    if (allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return { allowed: true, reason: 'Domain allowed by canvas policy.', event: null };
    }

    return {
      allowed: false,
      reason: 'External network egress is blocked by default in Z-Canvas.',
      event: {
        id: `egress:${randomUUID()}`,
        url: trimmed,
        reason: 'External network egress is blocked by default in Z-Canvas.',
        blockedAt: new Date().toISOString(),
      },
    };
  }

  public guardScript(sessionId: string): string {
    const payload = JSON.stringify({ sessionId });
    return `
      (() => {
        const canvasMeta = ${payload};
        const notify = (url, reason) => {
          window.parent?.postMessage({ type: 'zavorth.canvas.egress_blocked', sessionId: canvasMeta.sessionId, url, reason }, '*');
          logger.warn('[Z-Canvas] blocked external request:', url, reason);
        };
        const shouldBlock = (value) => {
          try {
            const url = typeof value === 'string' ? value : value?.url;
            if (!url || url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || url.startsWith('#')) return false;
            if (/^(data|blob|about):/i.test(url)) return false;
            const parsed = new URL(url, window.location.href);
            return !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
          } catch (error: unknown) {logger.warn('[Canvas Egress Guard] parsing failed', error); return false; }
        };
        const originalFetch = window.fetch?.bind(window);
        if (originalFetch) {
          window.fetch = (input, init) => {
            if (shouldBlock(input)) {
              const url = typeof input === 'string' ? input : input.url;
              notify(url, 'External fetch blocked by Z-Canvas.');
              return Promise.reject(new Error('Z-Canvas blocked external fetch.'));
            }
            return originalFetch(input, init);
          };
        }
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          if (shouldBlock(String(url))) {
            notify(String(url), 'External XMLHttpRequest blocked by Z-Canvas.');
            throw new Error('Z-Canvas blocked external XMLHttpRequest.');
          }
          return originalOpen.call(this, method, url, ...rest);
        };
        const OriginalWebSocket = window.WebSocket;
        if (OriginalWebSocket) {
          window.WebSocket = function(url, protocols) {
            if (shouldBlock(url)) {
              notify(String(url), 'External WebSocket blocked by Z-Canvas.');
              throw new Error('Z-Canvas blocked external WebSocket.');
            }
            return new OriginalWebSocket(url, protocols);
          };
        }
        const OriginalEventSource = window.EventSource;
        if (OriginalEventSource) {
          window.EventSource = function(url, config) {
            if (shouldBlock(url)) {
              notify(String(url), 'External EventSource blocked by Z-Canvas.');
              throw new Error('Z-Canvas blocked external EventSource.');
            }
            return new OriginalEventSource(url, config);
          };
        }
        const originalBeacon = navigator.sendBeacon?.bind(navigator);
        if (originalBeacon) {
          navigator.sendBeacon = (url, data) => {
            if (shouldBlock(String(url))) {
              notify(String(url), 'External beacon blocked by Z-Canvas.');
              return false;
            }
            return originalBeacon(url, data);
          };
        }
        const originalOpenWindow = window.open?.bind(window);
        if (originalOpenWindow) {
          window.open = (url, target, features) => {
            if (url && shouldBlock(String(url))) {
              notify(String(url), 'External window navigation blocked by Z-Canvas.');
              return null;
            }
            return originalOpenWindow(url, target, features);
          };
        }
      })();
    `;
  }
}
