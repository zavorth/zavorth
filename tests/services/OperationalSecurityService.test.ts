import path from 'path';
import { config } from '../../src/config/index.js';
import { OperationalSecurityService } from '../../src/services/OperationalSecurityService.js';

describe('OperationalSecurityService', () => {
  const originalMailboxSecret = process.env.ZAVORTH_MAILBOX_SECRET;
  const originalDbEncryptionKey = config.dbEncryptionKey;
  const originalMailboxSecretFile = config.mailboxSecretFile;
  const originalDbKeyFile = config.dbEncryptionKeyFile;
  const originalHostIdentityFile = config.hostIdentityFile;
  const originalAuditFile = config.securityAuditStatusFile;
  const originalAuditTrailDir = config.securityAuditTrailDir;
  const originalPreflightFile = config.securityPreflightStatusFile;

  afterEach(() => {
    process.env.ZAVORTH_MAILBOX_SECRET = originalMailboxSecret;
    config.dbEncryptionKey = originalDbEncryptionKey;
    config.mailboxSecretFile = originalMailboxSecretFile;
    config.dbEncryptionKeyFile = originalDbKeyFile;
    config.hostIdentityFile = originalHostIdentityFile;
    config.securityAuditStatusFile = originalAuditFile;
    config.securityAuditTrailDir = originalAuditTrailDir;
    config.securityPreflightStatusFile = originalPreflightFile;
  });

  it('summarizes sources and reports attention when checks fail', () => {
    process.env.ZAVORTH_MAILBOX_SECRET = 'mailbox-secret-from-env';
    config.dbEncryptionKey = '';
    config.mailboxSecretFile = '/runtime/mailbox-secret.key';
    config.dbEncryptionKeyFile = '/runtime/db-field.key';
    config.hostIdentityFile = '/runtime/authorized-host.json';
    config.securityAuditStatusFile = '/runtime/security-audit-last.json';
    config.securityAuditTrailDir = '/runtime/security-audit-trail';
    config.securityPreflightStatusFile = '/runtime/security-preflight-last.json';
    const eventsFile = path.join(config.securityAuditTrailDir, 'events.ndjson');
    const ledgerFile = path.join(config.securityAuditTrailDir, 'ledger.json');

    const existsSync = jest.fn((filePath: string) =>
      [
        config.mailboxSecretFile,
        config.dbEncryptionKeyFile,
        config.hostIdentityFile,
        config.securityAuditStatusFile,
        eventsFile,
        ledgerFile,
        config.securityPreflightStatusFile,
        '/runtime/web-api-token.txt',
      ].includes(filePath),
    );
    const readFileSync = jest.fn((filePath: string) => {
      if (filePath === config.securityAuditStatusFile) {
        return JSON.stringify({
          generatedAt: '2026-03-29T07:00:00.000Z',
          ok: true,
          summary: 'Nenhum problema relevante detectado.',
        });
      }

      if (filePath === ledgerFile) {
        return JSON.stringify({
          totalEvents: 2,
          latestEventId: 'audit-0000002',
          latestEventType: 'PERMISSION_DECISION',
          latestTaskId: 'task-ops-1',
          latestTimestamp: '2026-03-29T07:01:00.000Z',
          latestChainHash: 'abcdef1234567890',
        });
      }

      if (filePath === eventsFile) {
        return [
          JSON.stringify({
            event_id: 'audit-0000001',
            event_type: 'APPROVAL_DECISION',
            task_id: 'task-ops-1',
            timestamp: '2026-03-29T07:00:00.000Z',
            chain_hash: 'hash-1',
            previous_chain_hash: null,
          }),
          JSON.stringify({
            event_id: 'audit-0000002',
            event_type: 'PERMISSION_DECISION',
            task_id: 'task-ops-1',
            timestamp: '2026-03-29T07:01:00.000Z',
            chain_hash: 'hash-2',
            previous_chain_hash: 'hash-1',
          }),
        ].join('\n');
      }

      if (filePath === config.securityPreflightStatusFile) {
        return JSON.stringify({
          generatedAt: '2026-03-29T08:00:00.000Z',
          ok: false,
          summary: '1 bloqueio(s) e 0 aviso(s) detectados.',
        });
      }

      return '';
    });

    const service = new OperationalSecurityService({
      authService: {
        getStatus: () => ({
          enabled: true,
          source: 'runtime-file',
          tokenFile: '/runtime/web-api-token.txt',
        }),
      },
      existsSync: existsSync as any,
      readFileSync: readFileSync as any,
    });

    const snapshot = service.readSnapshot();

    expect(snapshot.dashboardAuth.source).toBe('runtime-file');
    expect(snapshot.mailboxSecret.source).toBe('env');
    expect(snapshot.dbEncryption.source).toBe('runtime-file');
    expect(snapshot.hostIdentity.exists).toBe(true);
    expect(snapshot.lastAudit.ok).toBe(true);
    expect(snapshot.lastAudit.totalEvents).toBe(2);
    expect(snapshot.lastAudit.latestEventType).toBe('PERMISSION_DECISION');
    expect(snapshot.lastAudit.latestTaskId).toBe('task-ops-1');
    expect(snapshot.lastAudit.latestChainHash).toBe('abcdef1234567890');
    expect(snapshot.lastAudit.recentChain).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 'audit-0000002',
          eventType: 'PERMISSION_DECISION',
          taskId: 'task-ops-1',
        }),
      ]),
    );
    expect(snapshot.lastPreflight.ok).toBe(false);
    expect(snapshot.needsAttention).toBe(true);
  });

  it('stays green when local files and checks are healthy', () => {
    delete process.env.ZAVORTH_MAILBOX_SECRET;
    config.dbEncryptionKey = 'db-key-env';
    config.mailboxSecretFile = '/runtime/mailbox-secret.key';
    config.dbEncryptionKeyFile = '/runtime/db-field.key';
    config.hostIdentityFile = '/runtime/authorized-host.json';
    config.securityAuditStatusFile = '/runtime/security-audit-last.json';
    config.securityAuditTrailDir = '/runtime/security-audit-trail';
    config.securityPreflightStatusFile = '/runtime/security-preflight-last.json';
    const eventsFile = path.join(config.securityAuditTrailDir, 'events.ndjson');
    const ledgerFile = path.join(config.securityAuditTrailDir, 'ledger.json');

    const existsSync = jest.fn(() => true);
    const readFileSync = jest.fn((filePath: string) => {
      if (filePath === ledgerFile) {
        return JSON.stringify({
          totalEvents: 0,
          latestEventId: null,
          latestEventType: null,
          latestTaskId: null,
          latestTimestamp: null,
          latestChainHash: null,
        });
      }

      if (filePath === eventsFile) {
        return '';
      }

      return JSON.stringify({
        generatedAt: '2026-03-29T09:00:00.000Z',
        ok: true,
        summary: 'Nenhum problema relevante detectado.',
      });
    });

    const service = new OperationalSecurityService({
      authService: {
        getStatus: () => ({
          enabled: true,
          source: 'env',
          tokenFile: '/runtime/web-api-token.txt',
        }),
      },
      existsSync: existsSync as any,
      readFileSync: readFileSync as any,
    });

    const snapshot = service.readSnapshot();

    expect(snapshot.dashboardAuth.source).toBe('env');
    expect(snapshot.mailboxSecret.source).toBe('runtime-file');
    expect(snapshot.dbEncryption.source).toBe('env');
    expect(snapshot.lastAudit.ok).toBe(true);
    expect(snapshot.lastAudit.totalEvents).toBe(0);
    expect(snapshot.lastAudit.recentChain).toEqual([]);
    expect(snapshot.lastPreflight.ok).toBe(true);
    expect(snapshot.needsAttention).toBe(false);
  });
});
