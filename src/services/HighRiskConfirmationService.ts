import crypto from 'crypto';
import { config } from '../config/index.js';
import { Task } from '../contracts/TaskContract.js';
import { SecureStorageService } from './SecureStorageService.js';

const TOTP_WINDOW_STEPS = [-1, 0, 1];

export class HighRiskConfirmationService {
  constructor(private readonly secureStorage = new SecureStorageService()) {}

  public isConfigured(): boolean {
    return Boolean(this.resolveTotpSecret());
  }

  public requiresPin(task: Task | null | undefined): boolean {
    if (!task) {
      return false;
    }

    if (Boolean(task.metadata?.requiresHighRiskPin)) {
      return true;
    }

    return Number(task.risk_level || 0) >= 3;
  }

  public validate(task: Task, providedCode: string): boolean {
    if (!this.requiresPin(task)) {
      return true;
    }

    const normalized = String(providedCode || '').trim();
    if (!normalized) {
      return false;
    }

    const totpSecret = this.resolveTotpSecret();
    if (!totpSecret) {
      return false;
    }

    return TOTP_WINDOW_STEPS.some((offset) => this.generateTotp(totpSecret, offset) === normalized);
  }

  public describeRequirement(): string {
    if (this.resolveTotpSecret()) {
      return 'Esse pedido e HIGH_RISK. Confirme com `/approve <task_id> <codigo TOTP>` usando seu autenticador.';
    }

    return 'Esse pedido e HIGH_RISK. Configure o segredo TOTP no SecureStorageService. O fallback por env exige ZAVORTH_HIGH_RISK_TOTP_ALLOW_ENV_FALLBACK=true. PIN estatico nao e aceito.';
  }

  private resolveTotpSecret(): string {
    const secretRef = String((config as { highRiskApprovalTotpSecretRef?: string }).highRiskApprovalTotpSecretRef || 'high-risk-approval-totp').trim();
    const stored = secretRef ? String(this.secureStorage.readSecret(secretRef) || '').trim() : '';
    if (stored) {
      return stored;
    }

    const allowEnvFallback = Boolean((config as { highRiskApprovalAllowEnvFallback?: boolean }).highRiskApprovalAllowEnvFallback);
    if (!allowEnvFallback) {
      return '';
    }

    return String(config.highRiskApprovalTotpSecret || '').trim();
  }

  private generateTotp(secret: string, offsetSteps = 0): string {
    const counter = Math.floor(Date.now() / 30_000) + offsetSteps;
    const key = crypto.createHash('sha1').update(secret).digest();
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }
}
