import fs from 'fs';
import path from 'path';
import type { IntegrationActionExecutionRecord } from '../../../../contracts/IntegrationHubContract.js';
import { logger } from '../../../../logger';

type IntegrationActionExecution = IntegrationActionExecutionRecord;

type IntegrationActionLedgerRuntime = {
  actionStatusFile: string;
  actionHistoryFile: string;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
};

export class IntegrationActionLedgerService {
  private readonly actionStatusFile: string;
  private readonly actionHistoryFile: string;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly appendFileSyncImpl: typeof fs.appendFileSync;

  public constructor(runtime: IntegrationActionLedgerRuntime) {
    this.actionStatusFile = runtime.actionStatusFile;
    this.actionHistoryFile = runtime.actionHistoryFile;
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSyncImpl = runtime.appendFileSync || fs.appendFileSync.bind(fs);
  }

  public readLatestAction(integrationId: string): IntegrationActionExecution | null {
    if (!fs.existsSync(this.actionStatusFile)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.actionStatusFile, 'utf8');
      const parsed = JSON.parse(raw) as IntegrationActionExecution;
      return parsed.integrationId === integrationId ? parsed : null;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Integration Action Ledger] JSON parse failed', error); return null; }
  }

  public readActionHistory(integrationId: string, limit: number): IntegrationActionExecution[] {
    if (!fs.existsSync(this.actionHistoryFile)) {
      return [];
    }

    const lines = fs.readFileSync(this.actionHistoryFile, 'utf8').split(/\r?\n/).filter(Boolean);
    const records: IntegrationActionExecution[] = [];
    const seenExecutionIds = new Set<string>();
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const parsed = JSON.parse(lines[index]) as IntegrationActionExecution;
        if (parsed.integrationId !== integrationId) {
          continue;
        }
        const executionId = String(parsed.executionId || '').trim();
        if (executionId && seenExecutionIds.has(executionId)) {
          continue;
        }
        if (executionId) {
          seenExecutionIds.add(executionId);
        }
        records.push(parsed);
        if (records.length >= limit) {
          break;
        }
      } catch (error: any) { const err = error; const e = error;
      // Ignora linhas corrompidas no historico.
      logger.warn('[Integration Action Ledger] process execution failed', error);
    }
    }
    return records;
  }

  public readLogExcerpt(logFile: string, maxLines: number): string[] {
    if (!logFile || !fs.existsSync(logFile)) {
      return [];
    }

    const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, maxLines));
  }

  public persistRecord(record: IntegrationActionExecution): void {
    this.mkdirSyncImpl(path.dirname(this.actionStatusFile), { recursive: true });
    this.writeFileSyncImpl(this.actionStatusFile, JSON.stringify(record, null, 2), 'utf8');
    this.appendFileSyncImpl(this.actionHistoryFile, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
