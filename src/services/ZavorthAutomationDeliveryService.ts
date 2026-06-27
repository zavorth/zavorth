import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ScheduledTask } from '../storage/SchedulerRepository.js';

export type AutomationDeliveryRecord = {
  id: string;
  taskId: string;
  delivery: string;
  status: 'recorded' | 'queued' | 'skipped';
  createdAt: string;
  prompt: string;
  summary: string;
  target: string | null;
};

type DeliveryRuntime = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  unlinkSync?: typeof fs.unlinkSync;
  maxOutboxAgeMs?: number;
  maxOutboxFiles?: number;
};

export type AutomationOutboxStatus = {
  deliveryReportFile: string;
  webhookOutboxFile: string;
  emailOutboxDir: string;
  bounded: boolean;
  retention: {
    ttlMs: number;
    maxBytes: number;
    maxRotatedFiles: number;
    maxEmailFiles: number;
  };
  deliveryRecords: number;
  queuedDeliveries: number;
  webhookQueued: number;
  emailQueued: number;
  externalDeliveries: number;
  idempotencyKeys: number;
  lastQueuedAt: string | null;
  recommendation: string | null;
};

export class ZavorthAutomationDeliveryService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly appendFileSync: typeof fs.appendFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly unlinkSync: typeof fs.unlinkSync;
  private readonly maxOutboxAgeMs: number;
  private readonly maxOutboxFiles: number;

  constructor(runtime: DeliveryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.appendFileSync = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.unlinkSync = runtime.unlinkSync || fs.unlinkSync.bind(fs);
    this.maxOutboxAgeMs = Math.max(60_000, Math.min(runtime.maxOutboxAgeMs || 7 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000));
    this.maxOutboxFiles = Math.max(10, Math.min(runtime.maxOutboxFiles || 200, 2_000));
  }

  public deliver(task: ScheduledTask, summary: string | null | undefined): AutomationDeliveryRecord {
    const createdAt = this.now().toISOString();
    const normalizedDelivery = this.normalizeDelivery(task.delivery);
    const normalizedSummary = String(summary || '').trim() || 'Execucao concluida sem resumo textual.';
    const target = String(task.delivery_target || '').trim() || null;
    const record: AutomationDeliveryRecord = {
      id: `${task.id}-${createdAt}`,
      taskId: task.id,
      delivery: normalizedDelivery,
      status: normalizedDelivery === 'telegram' ? 'skipped' : 'queued',
      createdAt,
      prompt: String(task.intent_text || task.command || '').trim(),
      summary: normalizedSummary,
      target,
    };

    this.ensureParentDir(config.automationDeliveryReportFile);
    this.rotateIfNeeded(config.automationDeliveryReportFile);
    this.appendFileSync(
      config.automationDeliveryReportFile,
      `${JSON.stringify(record)}${process.platform === 'win32' ? '\r\n' : '\n'}`,
      'utf8',
    );

    if (normalizedDelivery === 'email') {
      this.writeEmailEnvelope(record);
    } else if (normalizedDelivery === 'webhook') {
      this.writeWebhookEnvelope(record);
    } else if (normalizedDelivery !== 'app' && normalizedDelivery !== 'telegram') {
      this.writeChannelEnvelope(record);
    }

    return record;
  }

  public recordSystemNotice(input: {
    taskId: string;
    prompt: string;
    summary: string;
    target?: string | null;
  }): AutomationDeliveryRecord {
    const createdAt = this.now().toISOString();
    const record: AutomationDeliveryRecord = {
      id: `${input.taskId}-${createdAt}-system-notice`,
      taskId: input.taskId,
      delivery: 'app',
      status: 'queued',
      createdAt,
      prompt: String(input.prompt || '').trim() || 'automation-system-notice',
      summary: String(input.summary || '').trim() || 'Aviso operacional de automacao.',
      target: String(input.target || '').trim() || null,
    };
    this.ensureParentDir(config.automationDeliveryReportFile);
    this.rotateIfNeeded(config.automationDeliveryReportFile);
    this.appendFileSync(
      config.automationDeliveryReportFile,
      `${JSON.stringify(record)}${process.platform === 'win32' ? '\r\n' : '\n'}`,
      'utf8',
    );
    return record;
  }

  public readRecent(limit = 10): AutomationDeliveryRecord[] {
    if (!this.existsSync(config.automationDeliveryReportFile)) {
      return [];
    }
    try {
      const raw = this.readFileSync(config.automationDeliveryReportFile, 'utf8');
      return raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AutomationDeliveryRecord)
        .slice(-Math.max(0, limit))
        .reverse();
    } catch {
      return [];
    }
  }

  public readOutboxStatus(): AutomationOutboxStatus {
    const deliveryRecords = this.readDeliveryRecords();
    const webhookEnvelopes = this.readJsonlRecords(config.automationWebhookOutboxFile);
    const emailEnvelopes = this.readEmailEnvelopes();
    const queuedDeliveries = deliveryRecords.filter((entry) => entry.status === 'queued').length;
    const lastQueuedAt = deliveryRecords
      .map((entry) => entry.createdAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;
    const idempotencyKeys = new Set<string>();
    for (const entry of webhookEnvelopes) {
      const key = String((entry as any)?.idempotencyKey || '').trim();
      if (key) {
        idempotencyKeys.add(key);
      }
    }
    for (const entry of emailEnvelopes) {
      const key = String((entry as any)?.idempotencyKey || '').trim();
      if (key) {
        idempotencyKeys.add(key);
      }
    }
    return {
      deliveryReportFile: config.automationDeliveryReportFile,
      webhookOutboxFile: config.automationWebhookOutboxFile,
      emailOutboxDir: config.emailOutboxDir,
      bounded: true,
      retention: {
        ttlMs: this.maxOutboxAgeMs,
        maxBytes: Math.min(config.runtimeLogRotationMaxBytes, 100 * 1024 * 1024),
        maxRotatedFiles: Math.max(1, Math.min(config.runtimeLogRotationMaxFiles, 5)),
        maxEmailFiles: this.maxOutboxFiles,
      },
      deliveryRecords: deliveryRecords.length,
      queuedDeliveries,
      webhookQueued: webhookEnvelopes.length,
      emailQueued: emailEnvelopes.length,
      externalDeliveries: deliveryRecords.filter((entry) => entry.delivery === 'email' || entry.delivery === 'webhook' || entry.delivery === 'slack' || entry.delivery === 'whatsapp' || entry.delivery === 'teams').length,
      idempotencyKeys: idempotencyKeys.size,
      lastQueuedAt,
      recommendation:
        queuedDeliveries > 0
          ? 'Outbox possui entregas pendentes; drenar bridges antes de aumentar recorrencia.'
          : 'Outbox limitado e pronto para entregas sob demanda.',
    };
  }

  private writeEmailEnvelope(record: AutomationDeliveryRecord): void {
    const outboxDir = config.emailOutboxDir;
    this.mkdirSync(outboxDir, { recursive: true });
    this.pruneOutboxDir(outboxDir, '-automation-email.json');
    const envelope = {
      id: `automation-email-${Date.now()}`,
      createdAt: record.createdAt,
      platform: 'email',
      idempotencyKey: `${record.taskId}:${record.createdAt}:email`,
      recipient: record.target,
      recipients: record.target ? [record.target] : [...config.emailAllowedRecipients],
      subject: 'Zavorth automation result',
      message: record.summary,
      prompt: record.prompt,
      kind: 'automation',
    };
    const fileName = `${record.createdAt.replace(/[:.]/g, '-')}-${record.taskId}-automation-email.json`;
    this.writeFileSync(path.join(outboxDir, fileName), JSON.stringify(envelope, null, 2), 'utf8');
  }

  private writeWebhookEnvelope(record: AutomationDeliveryRecord): void {
    this.ensureParentDir(config.automationWebhookOutboxFile);
    this.rotateIfNeeded(config.automationWebhookOutboxFile);
    const envelope = {
      id: `automation-webhook-${Date.now()}`,
      createdAt: record.createdAt,
      taskId: record.taskId,
      idempotencyKey: `${record.taskId}:${record.createdAt}:webhook`,
      target: record.target,
      prompt: record.prompt,
      summary: record.summary,
    };
    this.appendFileSync(
      config.automationWebhookOutboxFile,
      `${JSON.stringify(envelope)}${process.platform === 'win32' ? '\r\n' : '\n'}`,
      'utf8',
    );
  }

  private writeChannelEnvelope(record: AutomationDeliveryRecord): void {
    const channelOutboxDir = path.join(config.runtimeDir, `${record.delivery}-outbox`);
    this.mkdirSync(channelOutboxDir, { recursive: true });
    this.pruneOutboxDir(channelOutboxDir, `-automation-${record.delivery}.json`);
    const envelope = {
      id: `automation-${record.delivery}-${Date.now()}`,
      createdAt: record.createdAt,
      platform: record.delivery,
      taskId: record.taskId,
      idempotencyKey: `${record.taskId}:${record.createdAt}:${record.delivery}`,
      target: record.target,
      prompt: record.prompt,
      summary: record.summary,
      kind: 'automation',
    };
    const fileName = `${record.createdAt.replace(/[:.]/g, '-')}-${record.taskId}-automation-${record.delivery}.json`;
    this.writeFileSync(path.join(channelOutboxDir, fileName), JSON.stringify(envelope, null, 2), 'utf8');
  }

  private ensureParentDir(filePath: string): void {
    this.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  private rotateIfNeeded(filePath: string): void {
    try {
      if (!this.existsSync(filePath)) {
        return;
      }
      const stats = fs.statSync(filePath);
      const maxBytes = Math.min(config.runtimeLogRotationMaxBytes, 100 * 1024 * 1024);
      if (stats.size < maxBytes) {
        return;
      }
      const maxFiles = Math.max(1, Math.min(config.runtimeLogRotationMaxFiles, 5));
      for (let index = maxFiles - 1; index >= 1; index -= 1) {
        const source = `${filePath}.${index}`;
        const target = `${filePath}.${index + 1}`;
        if (this.existsSync(source)) {
          fs.renameSync(source, target);
        }
      }
      fs.renameSync(filePath, `${filePath}.1`);
    } catch {
      // Entrega de automacao deve seguir mesmo se a rotacao encontrar arquivo travado.
    }
  }

  private readDeliveryRecords(): AutomationDeliveryRecord[] {
    if (!this.existsSync(config.automationDeliveryReportFile)) {
      return [];
    }
    return this.readJsonlRecords(config.automationDeliveryReportFile)
      .filter((entry): entry is AutomationDeliveryRecord => Boolean((entry as any)?.taskId));
  }

  private readJsonlRecords(filePath: string): Record<string, unknown>[] {
    if (!filePath || !this.existsSync(filePath)) {
      return [];
    }
    try {
      return this.readFileSync(filePath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    } catch {
      return [];
    }
  }

  private readEmailEnvelopes(): Record<string, unknown>[] {
    try {
      if (!this.existsSync(config.emailOutboxDir)) {
        return [];
      }
      return this.readdirSync(config.emailOutboxDir)
        .filter((entry) => entry.endsWith('-automation-email.json'))
        .map((entry) => {
          try {
            return JSON.parse(this.readFileSync(path.join(config.emailOutboxDir, entry), 'utf8')) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    } catch {
      return [];
    }
  }

  private pruneOutboxDir(dirPath: string, suffix: string): void {
    try {
      if (!this.existsSync(dirPath)) {
        return;
      }
      const nowMs = this.now().getTime();
      const entries = this.readdirSync(dirPath)
        .filter((entry) => entry.endsWith(suffix))
        .map((entry) => {
          const filePath = path.join(dirPath, entry);
          const stats = this.statSync(filePath);
          return {
            filePath,
            mtimeMs: stats.mtimeMs,
          };
        })
        .sort((left, right) => right.mtimeMs - left.mtimeMs);
      for (const entry of entries) {
        const isExpired = nowMs - entry.mtimeMs > this.maxOutboxAgeMs;
        const isOverflow = entries.indexOf(entry) >= this.maxOutboxFiles;
        if (isExpired || isOverflow) {
          this.unlinkSync(entry.filePath);
        }
      }
    } catch {
      // Retencao de outbox e best-effort para nao quebrar a entrega principal.
    }
  }

  private normalizeDelivery(value: ScheduledTask['delivery']): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'none') return 'app';
    return normalized;
  }
}
