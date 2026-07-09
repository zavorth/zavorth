import {
  ZavorthPersonalOpsGoogleAdapter,
  ZavorthPersonalOpsMicrosoftGraphAdapter,
} from '../../src/services/ZavorthPersonalOpsLiveAdapters.js';
import { ZavorthPersonalOpsRuntimeService } from '../../src/services/ZavorthPersonalOpsRuntimeService.js';

import { ZavorthRuntimeSecureIntegrationService } from '../../src/services/ZavorthRuntimeSecureIntegrationService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';

class MemorySecureStorage {
  public readonly secrets = new Map<string, string>();

  public writeSecret(name: string, value: string | null | undefined): boolean {
    if (!value) return false;
    this.secrets.set(name, String(value));
    return true;
  }

  public readSecret(name: string): string | null {
    return this.secrets.get(name) || null;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('ZavorthPersonalOps live adapters', () => {
  it('executes Gmail read through the runtime service with credential refs and approval', async () => {
    const storage = new MemorySecureStorage();
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const google = new ZavorthPersonalOpsGoogleAdapter({
      secureStorage: storage,
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          authorization: String((init?.headers as Record<string, string>)?.Authorization || ''),
        });
        return jsonResponse({ messages: [{ id: 'msg-1' }, { id: 'msg-2' }], nextPageToken: 'next' });
      },
    });
    const bus = new ZavorthRuntimeStateBusService({ now: () => new Date('2026-06-10T16:30:00.000Z') });
    const secureIntegration = new ZavorthRuntimeSecureIntegrationService({
      runtimeStateBus: bus,
      secureStorage: storage,
      now: () => new Date('2026-06-10T16:30:00.000Z'),
    });
    const service = new ZavorthPersonalOpsRuntimeService({
      runtimeStateBus: bus,
      secureIntegration,
      adapters: { google },
      now: () => new Date('2026-06-10T16:30:00.000Z'),
    });

    service.connectAccount({
      kind: 'email',
      provider: 'google',
      accountEmail: 'ana@example.com',
      accessToken: 'google-access-token',
      approved: true,
      profile: 'personal',
    });
    const approval = bus.dispatch({
      type: 'sync-command',
      approved: true,
      source: 'personal-ops-approval-test',
      payload: {
        metadata: {
          approvalScope: 'personal-ops',
          operation: 'email.read',
          connectorId: 'email:ana-example-com',
        },
      },
    });
    const result = await service.executeOperation({
      operation: 'email.read',
      connectorId: 'email:ana-example-com',
      approvalId: approval.receipt.id,
      approved: true,
      payload: { query: 'from:bob', maxResults: 2 },
      profile: 'personal',
    });

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({ messageIds: ['msg-1', 'msg-2'], count: 2 });
    expect(calls[0].url).toContain('gmail.googleapis.com/gmail/v1/users/me/messages');
    expect(calls[0].url).toContain('q=from%3Abob');
    expect(calls[0].authorization).toBe('Bearer google-access-token');
    expect(JSON.stringify(result.receipt)).not.toContain('google-access-token');
  });

  it('creates Gmail drafts without calling the send endpoint', async () => {
    const storage = new MemorySecureStorage();
    storage.writeSecret('personal.email.email-ana-example-com.accessToken', 'google-access-token');
    const calls: Array<{ url: string; body: string }> = [];
    const google = new ZavorthPersonalOpsGoogleAdapter({
      secureStorage: storage,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body || '') });
        return jsonResponse({ id: 'draft-123', message: { id: 'msg-draft-123' } });
      },
    });

    const result = await google.draftEmail({
      connector: { id: 'email:ana-example-com', kind: 'email', label: 'Gmail', status: 'configured', enabled: true, readAllowed: true, draftAllowed: true, sendRequiresApproval: true, writeRequiresApproval: true, lastReceiptId: null },
      connectorId: 'email:ana-example-com',
      provider: 'google',
      operation: 'email.draft',
      payload: { to: ['bob@example.com'], subject: 'Hello', body: 'private body' },
      approvalId: 'approval-draft',
      credentialRefs: ['personal.email.email-ana-example-com.accessToken'],
      requestedAt: '2026-06-10T16:30:00.000Z',
    });

    expect(result).toMatchObject({ draftId: 'draft-123', messageId: 'msg-draft-123' });
    expect(calls[0].url).toContain('/gmail/v1/users/me/drafts');
    expect(calls[0].url).not.toContain('/send');
    expect(calls[0].body).toContain('raw');
  });

  it('sanitizes Gmail MIME headers before encoding draft payloads', async () => {
    const storage = new MemorySecureStorage();
    storage.writeSecret('personal.email.email-ana-example-com.accessToken', 'google-access-token');
    const calls: Array<{ body: string }> = [];
    const google = new ZavorthPersonalOpsGoogleAdapter({
      secureStorage: storage,
      fetchImpl: async (_url, init) => {
        calls.push({ body: String(init?.body || '') });
        return jsonResponse({ id: 'draft-123', message: { id: 'msg-draft-123' } });
      },
    });

    await google.draftEmail({
      connector: { id: 'email:ana-example-com', kind: 'email', label: 'Gmail', status: 'configured', enabled: true, readAllowed: true, draftAllowed: true, sendRequiresApproval: true, writeRequiresApproval: true, lastReceiptId: null },
      connectorId: 'email:ana-example-com',
      provider: 'google',
      operation: 'email.draft',
      payload: {
        to: ['bob@example.com\r\nBcc: attacker@example.com'],
        subject: 'Hello\r\nX-Injected: yes',
        body: 'private body',
      },
      approvalId: 'approval-draft',
      credentialRefs: ['personal.email.email-ana-example-com.accessToken'],
      requestedAt: '2026-06-10T16:30:00.000Z',
    });

    const raw = JSON.parse(calls[0].body).message.raw;
    const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    expect(decoded).toContain('To: bob@example.com Bcc: attacker@example.com');
    expect(decoded).toContain('Subject: Hello X-Injected: yes');
    expect(decoded).not.toContain('\r\nBcc: attacker@example.com');
    expect(decoded).not.toContain('\r\nX-Injected: yes');
  });

  it('refreshes expired Google access tokens once and retries the request', async () => {
    const storage = new MemorySecureStorage();
    storage.writeSecret('personal.email.email-ana-example-com.accessToken', 'expired-access');
    storage.writeSecret('personal.email.email-ana-example-com.refreshToken', 'refresh-secret');
    const calls: string[] = [];
    const google = new ZavorthPersonalOpsGoogleAdapter({
      secureStorage: storage,
      oauthClientId: 'google-client-id',
      fetchImpl: async (url) => {
        calls.push(String(url));
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return jsonResponse({ access_token: 'fresh-access', expires_in: 3600, token_type: 'Bearer' });
        }
        return calls.filter((entry) => entry.includes('gmail.googleapis.com')).length === 1
          ? jsonResponse({ error: 'expired' }, 401)
          : jsonResponse({ messages: [{ id: 'msg-fresh' }] });
      },
    });

    const result = await google.readEmail({
      connector: { id: 'email:ana-example-com', kind: 'email', label: 'Gmail', status: 'configured', enabled: true, readAllowed: true, draftAllowed: true, sendRequiresApproval: true, writeRequiresApproval: true, lastReceiptId: null },
      connectorId: 'email:ana-example-com',
      provider: 'google',
      operation: 'email.read',
      payload: {},
      approvalId: 'approval-read',
      credentialRefs: [
        'personal.email.email-ana-example-com.accessToken',
        'personal.email.email-ana-example-com.refreshToken',
      ],
      requestedAt: '2026-06-10T16:30:00.000Z',
    });

    expect(result).toMatchObject({ messageIds: ['msg-fresh'], count: 1 });
    expect(storage.readSecret('personal.email.email-ana-example-com.accessToken')).toBe('fresh-access');
    expect(calls.filter((url) => url.includes('oauth2.googleapis.com/token'))).toHaveLength(1);
  });

  it('maps Microsoft Graph email, calendar and task operations to Graph endpoints', async () => {
    const storage = new MemorySecureStorage();
    storage.writeSecret('personal.task.task-ana-example-com.accessToken', 'graph-access-token');
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const microsoft = new ZavorthPersonalOpsMicrosoftGraphAdapter({
      secureStorage: storage,
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          method: String(init?.method || 'GET'),
          body: String(init?.body || ''),
        });
        return jsonResponse({ id: 'task-updated-1', status: 'completed' });
      },
    });

    const result = await microsoft.updateTask({
      connector: { id: 'task:ana-example-com', kind: 'task', label: 'Microsoft Tasks', status: 'configured', enabled: true, readAllowed: true, draftAllowed: true, sendRequiresApproval: true, writeRequiresApproval: true, lastReceiptId: null },
      connectorId: 'task:ana-example-com',
      provider: 'microsoft',
      operation: 'task.update',
      payload: { taskListId: 'list-1', taskId: 'task-1', title: 'Done', status: 'completed' },
      approvalId: 'approval-task',
      credentialRefs: ['personal.task.task-ana-example-com.accessToken'],
      requestedAt: '2026-06-10T16:30:00.000Z',
    });

    expect(result).toMatchObject({ taskId: 'task-updated-1' });
    expect(calls[0].url).toContain('graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks/task-1');
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toContain('"title":"Done"');
  });
});
