import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

type CredentialAttempt = {
  provider: string;
  timestamp: string;
  success: boolean;
  errorCode: string | null;
  recoveredAt: string | null;
};

type RecoveryStrategy = {
  provider: string;
  action: 'refresh' | 'rotate' | 're-auth' | 'fallback';
  description: string;
};

export class CredentialRecoveryService {
  private readonly historyPath: string;
  private readonly maxHistory = 50;

  constructor(options?: { dataDir?: string }) {
    const dataDir = options?.dataDir || path.join(process.cwd(), 'data');
    this.historyPath = path.join(dataDir, 'runtime', 'credential-recovery.json');
  }

  recordAttempt(provider: string, success: boolean, errorCode: string | null): void {
    const history = this.loadHistory();
    history.push({
      provider,
      timestamp: new Date().toISOString(),
      success,
      errorCode,
      recoveredAt: null,
    });
    if (history.length > this.maxHistory) history.splice(0, history.length - this.maxHistory);
    this.saveHistory(history);
  }

  recordRecovery(provider: string): void {
    const history = this.loadHistory();
    const entry = [...history].reverse().find((h) => h.provider === provider && !h.success && !h.recoveredAt);
    if (entry) {
      entry.recoveredAt = new Date().toISOString();
      this.saveHistory(history);
    }
  }

  analyzeFailures(provider: string): RecoveryStrategy[] {
    const history = this.loadHistory();
    const recent = history.filter((h) => h.provider === provider).slice(-10);
    const strategies: RecoveryStrategy[] = [];

    const hasConsecutive401 = recent.filter((h) => h.errorCode === '401').length >= 2;
    const hasRecentSuccess = recent.some((h) => h.success);
    const lastFailure = recent.find((h) => !h.success);

    if (hasConsecutive401) {
      if (hasRecentSuccess) {
        strategies.push({
          provider,
          action: 'refresh',
          description: 'Credential may have expired. Try refreshing the token or re-authenticating.',
        });
      } else {
        strategies.push({
          provider,
          action: 're-auth',
          description: 'Repeated auth failures. The credential may be invalid or revoked. Re-authenticate.',
        });
      }
    }

    if (recent.length >= 3 && recent.filter((h) => !h.success).length >= 2) {
      strategies.push({
        provider,
        action: 'fallback',
        description: 'Multiple failures detected. Consider using a different provider as fallback.',
      });
    }

    if (lastFailure?.errorCode === '401' && !hasRecentSuccess) {
      strategies.push({
        provider,
        action: 'rotate',
        description: 'Token may be stale. Generate a new API key from the provider dashboard.',
      });
    }

    return strategies;
  }

  getRecoveryHistory(provider?: string): CredentialAttempt[] {
    const history = this.loadHistory();
    if (provider) return history.filter((h) => h.provider === provider);
    return history;
  }

  private loadHistory(): CredentialAttempt[] {
    try {
      if (fs.existsSync(this.historyPath)) {
        return JSON.parse(fs.readFileSync(this.historyPath, 'utf-8'));
      }
    } catch (err: unknown) { logger.debug(`[CredentialRecovery] Failed to load or parse history: ${err instanceof Error ? err.message : String(err)}`); }
    return [];
  }

  private saveHistory(history: CredentialAttempt[]): void {
    try {
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (err: unknown) { logger.debug(`[CredentialRecovery] Failed to load or parse history: ${err instanceof Error ? err.message : String(err)}`); }
  }
}
