import crypto from 'crypto';
import { config } from '../../src/config/index';
import { HighRiskConfirmationService } from '../../src/services/HighRiskConfirmationService';

describe('HighRiskConfirmationService', () => {
  const originalPin = config.highRiskApprovalPin;
  const originalTotp = config.highRiskApprovalTotpSecret;
  const originalTotpRef = (config as any).highRiskApprovalTotpSecretRef;
  const originalTotpEnvFallback = (config as any).highRiskApprovalAllowEnvFallback;

  afterEach(() => {
    (config as any).highRiskApprovalPin = originalPin;
    (config as any).highRiskApprovalTotpSecret = originalTotp;
    (config as any).highRiskApprovalTotpSecretRef = originalTotpRef;
    (config as any).highRiskApprovalAllowEnvFallback = originalTotpEnvFallback;
  });

  it('rejects static PINs entirely and requires TOTP configuration', () => {
    (config as any).highRiskApprovalPin = '654321';
    (config as any).highRiskApprovalTotpSecret = '';
    const service = new HighRiskConfirmationService();
    const task = {
      risk_level: 3,
      metadata: {
        requiresHighRiskPin: true,
      },
    } as any;

    expect(service.requiresPin(task)).toBe(true);
    expect(service.validate(task, '654321')).toBe(false);
    expect(service.isConfigured()).toBe(false);
    expect(service.describeRequirement()).toContain('TOTP');
    expect(service.describeRequirement()).toContain('SecureStorageService');
    expect(service.describeRequirement()).toContain('ZAVORTH_HIGH_RISK_TOTP_ALLOW_ENV_FALLBACK=true');
    expect(service.describeRequirement()).toContain('PIN estatico nao e aceito');
  });

  it('does not use env fallback unless explicitly enabled', () => {
    (config as any).highRiskApprovalTotpSecretRef = 'missing-high-risk-approval-totp-test';
    (config as any).highRiskApprovalTotpSecret = 'env-secret';
    (config as any).highRiskApprovalAllowEnvFallback = false;
    const secureStorage = {
      readSecret: jest.fn(() => ''),
    };
    const service = new HighRiskConfirmationService(secureStorage as any);
    const task = {
      risk_level: 3,
      metadata: {
        requiresHighRiskPin: true,
      },
    } as any;

    expect(service.isConfigured()).toBe(false);
    expect(service.validate(task, generateTotpForTest('env-secret'))).toBe(false);
  });

  it('prefers the secure storage TOTP secret over explicit env fallback', () => {
    (config as any).highRiskApprovalTotpSecretRef = 'high-risk-approval-totp-test';
    (config as any).highRiskApprovalTotpSecret = 'env-secret';
    (config as any).highRiskApprovalAllowEnvFallback = true;
    const secureStorage = {
      readSecret: jest.fn(() => 'stored-secret'),
    };
    const service = new HighRiskConfirmationService(secureStorage as any);
    const task = {
      risk_level: 3,
      metadata: {
        requiresHighRiskPin: true,
      },
    } as any;

    expect(service.isConfigured()).toBe(true);
    expect(service.validate(task, generateTotpForTest('stored-secret'))).toBe(true);
    expect(service.validate(task, generateTotpForTest('env-secret'))).toBe(false);
    expect(secureStorage.readSecret).toHaveBeenCalledWith('high-risk-approval-totp-test');
  });

  it('allows env fallback only as an explicit migration escape hatch', () => {
    (config as any).highRiskApprovalTotpSecretRef = 'missing-high-risk-approval-totp-test';
    (config as any).highRiskApprovalTotpSecret = 'env-secret';
    (config as any).highRiskApprovalAllowEnvFallback = true;
    const secureStorage = {
      readSecret: jest.fn(() => ''),
    };
    const service = new HighRiskConfirmationService(secureStorage as any);
    const task = {
      risk_level: 3,
      metadata: {
        requiresHighRiskPin: true,
      },
    } as any;

    expect(service.isConfigured()).toBe(true);
    expect(service.validate(task, generateTotpForTest('env-secret'))).toBe(true);
  });
});

function generateTotpForTest(secret: string): string {
  const counter = Math.floor(Date.now() / 30_000);
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
