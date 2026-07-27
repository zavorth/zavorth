import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

function makeRuntime() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-personal-ops-runtime-'));
  const now = () => new Date('2026-06-10T15:00:00.000Z');
  const bus = new ZavorthRuntimeStateBusService({
    stateFilePath: path.join(root, 'runtime-state.json'),
    now,
  });
  const secureStorage = new MemorySecureStorage();
  const secureIntegration = new ZavorthRuntimeSecureIntegrationService({
    runtimeStateBus: bus,
    secureStorage,
    now,
  });
  const adapter = new MemoryPersonalOpsAdapter();
  const service = new ZavorthPersonalOpsRuntimeService({
    runtimeStateBus: bus,
    secureIntegration,
    adapters: {
      google: adapter,
      microsoft: adapter,
      local: adapter,
    },
    now,
  });
  return { service, bus, secureStorage, adapter };
}

function approvePersonalOps(
  bus: ZavorthRuntimeStateBusService,
  input: { operation: string; connectorId: string },
): string {
  const result = bus.dispatch({
    type: 'sync-command',
    approved: true,
    source: 'personal-ops-approval-test',
    payload: {
      metadata: {
        approvalScope: 'personal-ops',
        operation: input.operation,
        connectorId: input.connectorId,
      },
    },
  });
  return result.receipt.id;
}

class MemoryPersonalOpsAdapter {
  public readonly reads: unknown[] = [];
  public readonly drafts: unknown[] = [];
  public readonly sends: unknown[] = [];
  public readonly calendarCreates: unknown[] = [];
  public readonly calendarUpdates: unknown[] = [];
  public readonly taskReads: unknown[] = [];
  public readonly taskCreates: unknown[] = [];
  public readonly taskUpdates: unknown[] = [];

  public async readEmail(input: unknown) {
    this.reads.push(input);
    return { messageIds: ['email-1'], count: 1 };
  }

  public async draftEmail(input: unknown) {
    this.drafts.push(input);
    return { draftId: 'draft-1' };
  }

  public async sendEmail(input: unknown) {
    this.sends.push(input);
    return { messageId: 'sent-1' };
  }

  public async readCalendar(input: unknown) {
    this.reads.push(input);
    return { eventIds: ['event-1'], count: 1 };
  }

  public async createCalendarEvent(input: unknown) {
    this.calendarCreates.push(input);
    return { eventId: 'event-created-1' };
  }

  public async updateCalendarEvent(input: unknown) {
    this.calendarUpdates.push(input);
    return { eventId: 'event-updated-1' };
  }

  public async readTasks(input: unknown) {
    this.taskReads.push(input);
    return { taskIds: ['task-1'], count: 1 };
  }

  public async createTask(input: unknown) {
    this.taskCreates.push(input);
    return { taskId: 'task-created-1' };
  }

  public async updateTask(input: unknown) {
    this.taskUpdates.push(input);
    return { taskId: 'task-updated-1' };
  }
}

describe('ZavorthPersonalOpsRuntimeService', () => {
  it('connects an OAuth personal account through secure storage and registers sanitized runtime state', () => {
    const { service, secureStorage } = makeRuntime();

    const result = service.connectAccount({
      kind: 'email',
      provider: 'google',
      accountEmail: 'ana@example.com',
      label: 'Gmail Ana',
      accessToken: 'ya29.email-access-token',
      refreshToken: 'refresh-email-token',
      scopes: ['gmail.readonly', 'gmail.compose', 'gmail.send'],
      approved: true,
      profile: 'personal',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('configured');
    expect(result.connector).toMatchObject({
      id: 'email:ana-example-com',
      kind: 'email',
      status: 'configured',
      enabled: true,
    });
    expect(result.visibility).toMatchObject({
      profile: 'personal',
      priority: 'primary',
    });
    expect(secureStorage.readSecret('personal.email.email-ana-example-com.accessToken')).toBe('ya29.email-access-token');
    expect(secureStorage.readSecret('personal.email.email-ana-example-com.refreshToken')).toBe('refresh-email-token');
    expect(JSON.stringify(result)).not.toContain('ya29.email-access-token');
    expect(JSON.stringify(result)).not.toContain('refresh-email-token');
  });

  it('keeps personal ops discreet outside the personal profile', () => {
    const { service } = makeRuntime();

    const result = service.connectAccount({
      kind: 'task',
      provider: 'microsoft',
      accountEmail: 'dev@example.com',
      accessToken: 'task-token',
      approved: true,
      profile: 'developer',
    });

    expect(result.ok).toBe(true);
    expect(result.visibility).toMatchObject({
      profile: 'developer',
      priority: 'discreet',
    });
  });

  it('does not store OAuth tokens until account setup is explicitly approved', () => {
    const { service, secureStorage } = makeRuntime();

    const result = service.connectAccount({
      kind: 'email',
      provider: 'google',
      accountEmail: 'ana@example.com',
      accessToken: 'email-token-without-approval',
      refreshToken: 'refresh-token-without-approval',
      profile: 'personal',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('pending-approval');
    expect(secureStorage.readSecret('personal.email.email-ana-example-com.accessToken')).toBeNull();
    expect(secureStorage.readSecret('personal.email.email-ana-example-com.refreshToken')).toBeNull();
    expect(JSON.stringify(result)).not.toContain('email-token-without-approval');
    expect(JSON.stringify(result)).not.toContain('refresh-token-without-approval');
  });

  it('returns a preview and blocks adapters when email operations are missing explicit approval', async () => {
    const { service, bus, adapter } = makeRuntime();
    service.connectAccount({
      kind: 'email',
      provider: 'google',
      accountEmail: 'ana@example.com',
      accessToken: 'email-token',
      approved: true,
      profile: 'personal',
    });

    const result = await service.executeOperation({
      operation: 'email.send',
      connectorId: 'email:ana-example-com',
      payload: {
        to: ['bob@example.com'],
        subject: 'Assunto privado',
        body: 'content privado que not deve ir para receipt',
      },
      profile: 'personal',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('pending-approval');
    expect(result.preview.requiresApproval).toBe(true);
    expect(result.approval.approvalId).toMatch(/^personal-ops-approval-/);
    expect(adapter.sends).toHaveLength(0);
    expect(JSON.stringify(result.receipt)).not.toContain('content privado');
  });

  it('creates email drafts without sending and only sends email after approval', async () => {
    const { service, bus, adapter } = makeRuntime();
    service.connectAccount({
      kind: 'email',
      provider: 'google',
      accountEmail: 'ana@example.com',
      accessToken: 'email-token',
      approved: true,
      profile: 'personal',
    });

    const draftApprovalId = approvePersonalOps(bus, {
      operation: 'email.draft',
      connectorId: 'email:ana-example-com',
    });
    const sendApprovalId = approvePersonalOps(bus, {
      operation: 'email.send',
      connectorId: 'email:ana-example-com',
    });
    const draft = await service.executeOperation({
      operation: 'email.draft',
      connectorId: 'email:ana-example-com',
      approvalId: draftApprovalId,
      approved: true,
      payload: {
        to: ['bob@example.com'],
        subject: 'Draft',
        body: 'corpo privado do rascunho',
      },
      profile: 'personal',
    });
    const send = await service.executeOperation({
      operation: 'email.send',
      connectorId: 'email:ana-example-com',
      approvalId: sendApprovalId,
      approved: true,
      payload: {
        to: ['bob@example.com'],
        subject: 'Enviar',
        body: 'corpo privado do envio',
      },
      profile: 'personal',
    });

    expect(draft.ok).toBe(true);
    expect(draft.result).toMatchObject({ draftId: 'draft-1' });
    expect(send.ok).toBe(true);
    expect(send.result).toMatchObject({ messageId: 'sent-1' });
    expect(adapter.drafts).toHaveLength(1);
    expect(adapter.sends).toHaveLength(1);
    expect(JSON.stringify(draft.receipt)).not.toContain('corpo privado do rascunho');
    expect(JSON.stringify(send.receipt)).not.toContain('corpo privado do envio');
  });

  it('governs calendar and task writes with approval-backed receipts', async () => {
    const { service, bus, adapter } = makeRuntime();
    service.connectAccount({
      kind: 'calendar',
      provider: 'google',
      accountEmail: 'ana@example.com',
      accessToken: 'calendar-token',
      approved: true,
      profile: 'personal',
    });
    service.connectAccount({
      kind: 'task',
      provider: 'microsoft',
      accountEmail: 'ana@example.com',
      accessToken: 'task-token',
      approved: true,
      profile: 'personal',
    });

    const blocked = await service.executeOperation({
      operation: 'calendar.create-event',
      connectorId: 'calendar:ana-example-com',
      payload: { title: 'Consulta', startsAt: '2026-06-11T10:00:00-03:00' },
      profile: 'personal',
    });
    const eventApprovalId = approvePersonalOps(bus, {
      operation: 'calendar.create-event',
      connectorId: 'calendar:ana-example-com',
    });
    const taskApprovalId = approvePersonalOps(bus, {
      operation: 'task.update',
      connectorId: 'task:ana-example-com',
    });
    const event = await service.executeOperation({
      operation: 'calendar.create-event',
      connectorId: 'calendar:ana-example-com',
      approvalId: eventApprovalId,
      approved: true,
      payload: { title: 'Consulta', startsAt: '2026-06-11T10:00:00-03:00' },
      profile: 'personal',
    });
    const task = await service.executeOperation({
      operation: 'task.update',
      connectorId: 'task:ana-example-com',
      approvalId: taskApprovalId,
      approved: true,
      payload: { taskId: 'task-123', title: 'Revisar PR', status: 'done' },
      profile: 'personal',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe('pending-approval');
    expect(event.ok).toBe(true);
    expect(task.ok).toBe(true);
    expect(adapter.calendarCreates).toHaveLength(1);
    expect(adapter.taskUpdates).toHaveLength(1);
    expect(event.receipt.operation).toBe('calendar.create-event');
    expect(task.receipt.operation).toBe('task.update');
    expect(event.receipt.stage).toBe('receipt');
    expect(task.receipt.approval.approved).toBe(true);
  });
});
