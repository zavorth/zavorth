import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { ZavorthControlAuthService } from './ZavorthControlAuthService.js';

type SecurityCheckSnapshot = {
  available: boolean;
  generatedAt: string | null;
  ok: boolean | null;
  summary: string | null;
};

type SecurityAuditReplayRecord = {
  eventId: string;
  eventType: string;
  taskId: string;
  timestamp: string | null;
  chainHash: string;
  previousChainHash: string | null;
};

type SecurityAuditSnapshot = SecurityCheckSnapshot & {
  trailAvailable: boolean;
  trailDir: string;
  eventsFile: string;
  ledgerFile: string;
  totalEvents: number;
  latestEventId: string | null;
  latestEventType: string | null;
  latestTaskId: string | null;
  latestTimestamp: string | null;
  latestChainHash: string | null;
  recentChain: SecurityAuditReplayRecord[];
};

export type OperationalSecuritySnapshot = {
  zavorthControlAuth: {
    enabled: boolean;
    source: 'env' | 'runtime-file' | 'missing';
    tokenFile: string;
    tokenFileExists: boolean;
    note: string;
  };
  mailboxSecret: {
    source: 'env' | 'runtime-file' | 'missing';
    filePath: string;
    fileExists: boolean;
  };
  dbEncryption: {
    enabled: boolean;
    source: 'env' | 'runtime-file' | 'missing';
    filePath: string;
    fileExists: boolean;
  };
  hostIdentity: {
    filePath: string;
    exists: boolean;
  };
  lastAudit: SecurityAuditSnapshot;
  lastPreflight: SecurityCheckSnapshot;
  needsAttention: boolean;
};

type OperationalSecurityRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  authService?: {
    getStatus(): {
      enabled: boolean;
      source: 'env' | 'runtime-file';
      tokenFile: string;
    };
  };
};

export class OperationalSecurityService {
  private readonly authService: {
    getStatus(): {
      enabled: boolean;
      source: 'env' | 'runtime-file';
      tokenFile: string;
    };
  };
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: OperationalSecurityRuntime = {}) {
    this.authService = runtime.authService || new ZavorthControlAuthService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public readSnapshot(): OperationalSecuritySnapshot {
    const authStatus = this.authService.getStatus();
    const zavorthControlAuthSource =
      authStatus.enabled && authStatus.source ? authStatus.source : ('missing' as const);
    const tokenFileExists = this.existsSync(authStatus.tokenFile);
    const mailboxSource = this.resolveMailboxSecretSource();
    const mailboxFileExists = this.existsSync(config.mailboxSecretFile);
    const dbSource = this.resolveDbEncryptionSource();
    const dbKeyFileExists = this.existsSync(config.dbEncryptionKeyFile);
    const hostIdentityExists = this.existsSync(config.hostIdentityFile);
    const lastAudit = this.readAuditSnapshot();
    const lastPreflight = this.readSecurityCheck(config.securityPreflightStatusFile);

    const needsAttention =
      zavorthControlAuthSource === 'missing' ||
      mailboxSource === 'missing' ||
      dbSource === 'missing' ||
      !hostIdentityExists ||
      lastAudit.ok === false ||
      lastPreflight.ok === false;

    return {
      zavorthControlAuth: {
        enabled: authStatus.enabled,
        source: zavorthControlAuthSource,
        tokenFile: authStatus.tokenFile,
        tokenFileExists,
        note: this.describeZavorthControlAuthSource(zavorthControlAuthSource, tokenFileExists),
      },
      mailboxSecret: {
        source: mailboxSource,
        filePath: config.mailboxSecretFile,
        fileExists: mailboxFileExists,
      },
      dbEncryption: {
        enabled: dbSource !== 'missing',
        source: dbSource,
        filePath: config.dbEncryptionKeyFile,
        fileExists: dbKeyFileExists,
      },
      hostIdentity: {
        filePath: config.hostIdentityFile,
        exists: hostIdentityExists,
      },
      lastAudit,
      lastPreflight,
      needsAttention,
    };
  }

  private resolveMailboxSecretSource(): 'env' | 'runtime-file' | 'missing' {
    const envSecret = String(process.env.ZAVORTH_MAILBOX_SECRET || '').trim();
    if (envSecret) {
      return 'env';
    }

    return this.existsSync(config.mailboxSecretFile) ? 'runtime-file' : 'missing';
  }

  private resolveDbEncryptionSource(): 'env' | 'runtime-file' | 'missing' {
    const envKey = String(config.dbEncryptionKey || '').trim();
    if (envKey) {
      return 'env';
    }

    return this.existsSync(config.dbEncryptionKeyFile) ? 'runtime-file' : 'missing';
  }

  private readSecurityCheck(filePath: string): SecurityCheckSnapshot {
    try {
      if (!this.existsSync(filePath)) {
        return {
          available: false,
          generatedAt: null,
          ok: null,
          summary: null,
        };
      }

      const parsed = JSON.parse(this.readFileSync(filePath, 'utf8')) as any;
      return {
        available: true,
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null,
        ok: typeof parsed.ok === 'boolean' ? parsed.ok : null,
        summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      };
    } catch {
      return {
        available: false,
        generatedAt: null,
        ok: null,
        summary: null,
      };
    }
  }

  private readAuditSnapshot(): SecurityAuditSnapshot {
    const status = this.readSecurityCheck(config.securityAuditStatusFile);
    const trailDir = config.securityAuditTrailDir;
    const eventsFile = path.join(trailDir, 'events.ndjson');
    const ledgerFile = path.join(trailDir, 'ledger.json');
    const ledger = this.readAuditLedger(ledgerFile);
    const recentChain = this.readRecentAuditRecords(eventsFile, 3);

    return {
      ...status,
      trailAvailable: this.existsSync(eventsFile) || this.existsSync(ledgerFile),
      trailDir,
      eventsFile,
      ledgerFile,
      totalEvents: Number(ledger?.totalEvents || 0),
      latestEventId: typeof ledger?.latestEventId === 'string' ? ledger.latestEventId : null,
      latestEventType: typeof ledger?.latestEventType === 'string' ? ledger.latestEventType : null,
      latestTaskId: typeof ledger?.latestTaskId === 'string' ? ledger.latestTaskId : null,
      latestTimestamp: typeof ledger?.latestTimestamp === 'string' ? ledger.latestTimestamp : null,
      latestChainHash: typeof ledger?.latestChainHash === 'string' ? ledger.latestChainHash : null,
      recentChain,
    };
  }

  private readAuditLedger(filePath: string): Record<string, unknown> | null {
    try {
      if (!this.existsSync(filePath)) {
        return null;
      }

      return JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private readRecentAuditRecords(filePath: string, limit: number): SecurityAuditReplayRecord[] {
    try {
      if (!this.existsSync(filePath)) {
        return [];
      }

      const lines = String(this.readFileSync(filePath, 'utf8') || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      return lines
        .slice(Math.max(0, lines.length - limit))
        .reverse()
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .map((record) => ({
          eventId: typeof record.event_id === 'string' ? record.event_id : 'unknown-event',
          eventType: typeof record.event_type === 'string' ? record.event_type : 'UNKNOWN',
          taskId: typeof record.task_id === 'string' ? record.task_id : 'unknown-task',
          timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
          chainHash: typeof record.chain_hash === 'string' ? record.chain_hash : '',
          previousChainHash:
            typeof record.previous_chain_hash === 'string' ? record.previous_chain_hash : null,
        }))
        .filter((record) => record.chainHash);
    } catch {
      return [];
    }
  }

  private describeZavorthControlAuthSource(
    source: 'env' | 'runtime-file' | 'missing',
    tokenFileExists: boolean,
  ): string {
    if (source === 'env') {
      return 'Protegido por ZAVORTH_WEB_AUTH_TOKEN no ambiente.';
    }

    if (source === 'runtime-file') {
      return tokenFileExists
        ? 'Protegido por token local persistido em arquivo.'
        : 'Token local configurado para arquivo, mas o arquivo nao foi encontrado.';
    }

    return 'Sem autenticacao web efetiva detectada.';
  }
}
