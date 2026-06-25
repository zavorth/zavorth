import { ZavorthProductQaLiveService } from '../../src/services/ZavorthProductQaLiveService.js';

describe('ZavorthProductQaLiveService', () => {
  const now = () => new Date('2026-05-24T12:00:00.000Z');

  it('builds the final live QA matrix without claiming live provider or Telegram by default', () => {
    const service = new ZavorthProductQaLiveService({
      now,
      cwd: 'C:/workspace',
      env: {},
      exists: existingFiles(),
    });

    const snapshot = service.execute();

    expect(snapshot.contractVersion).toBe('2026-05-24.product-qa-live-phase-9');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.matrix.map((row) => row.id)).toEqual([
      'fresh-install',
      'real-provider',
      'real-telegram',
      'mutation-approval',
      'receipt',
      'dashboard',
      'cli',
      'llm-brain-session',
      'learning-candidate',
      'long-tail-adapters',
      'rollback-sandbox',
    ]);
    expect(snapshot.summary.total).toBe(11);
    expect(snapshot.summary.needsLiveCredentials).toBe(2);
    expect(snapshot.policy.dryRunDoesNotClaimLiveProvider).toBe(true);
    expect(snapshot.policy.dryRunDoesNotClaimLiveTelegram).toBe(true);
    expect(snapshot.matrix.every((row) => row.receiptsRequired === true && row.secretValuesSerialized === false)).toBe(true);
  });

  it('marks provider and Telegram as passed when live credential signals and allowlists are present', () => {
    const service = new ZavorthProductQaLiveService({
      now,
      cwd: 'C:/workspace',
      env: {
        OPENAI_API_KEY: 'redacted-test-signal',
        TELEGRAM_BOT_TOKEN: 'redacted-test-signal',
        TELEGRAM_ALLOWED_USER_IDS: '123',
      },
      exists: existingFiles(),
    });

    const snapshot = service.execute({ requireLive: true });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.matrix.find((row) => row.id === 'real-provider')?.status).toBe('passed');
    expect(snapshot.matrix.find((row) => row.id === 'real-telegram')?.status).toBe('passed');
    expect(snapshot.liveReadiness.providerConfigured).toBe(true);
    expect(snapshot.liveReadiness.telegramAllowlistConfigured).toBe(true);
  });

  it('requires live credentials when requireLive is set and provider or Telegram are missing', () => {
    const service = new ZavorthProductQaLiveService({
      now,
      cwd: 'C:/workspace',
      env: {},
      exists: existingFiles(),
    });

    const snapshot = service.execute({ requireLive: true });

    expect(snapshot.status).toBe('needs-live-credentials');
    expect(snapshot.nextSafeAction).toContain('Configure real provider and Telegram credentials');
  });

  it('requires operator action when Telegram token is present but allowlist is missing', () => {
    const service = new ZavorthProductQaLiveService({
      now,
      cwd: 'C:/workspace',
      env: {
        OPENAI_API_KEY: 'redacted-test-signal',
        TELEGRAM_BOT_TOKEN: 'redacted-test-signal',
      },
      exists: existingFiles(),
    });

    const snapshot = service.execute({ requireLive: true });

    expect(snapshot.status).toBe('needs-operator-action');
    expect(snapshot.matrix.find((row) => row.id === 'real-telegram')?.status).toBe('needs-operator-action');
  });

  it('blocks the matrix when required local proof files are missing', () => {
    const service = new ZavorthProductQaLiveService({
      now,
      cwd: 'C:/workspace',
      env: {},
      exists: () => false,
    });

    const snapshot = service.execute();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blocked).toBeGreaterThan(0);
  });
});

function existingFiles() {
  const files = new Set([
    'scripts/install.sh',
    'scripts/install.ps1',
    'scripts/install-zavorth.sh',
    'scripts/install-zavorth.ps1',
    'docs/install.md',
    'bin/zavorth.js',
    'src/zavorth-control/app/(dashboard)/control/useControlPageClient.ts',
    'scripts/zavorth-dashboard-final-product-polish-check.mjs',
    'scripts/zavorth-cli-final-product-polish-check.mjs',
    'src/zavorth-cli.ts',
    'scripts/zavorth-sandbox-lifecycle.ts',
    'scripts/zavorth-sandbox-lifecycle-check.mjs',
    'scripts/zavorth-live-readiness-evidence-proof-pack.ts',
    'scripts/zavorth-live-readiness-evidence-proof-pack-check.mjs',
    'scripts/zavorth-native-learning-loop.ts',
    'scripts/zavorth-native-learning-loop-check.mjs',
    'src/contracts/ZavorthLlmBrainContract.ts',
    'src/services/ZavorthLlmBrainService.ts',
    'src/runtime/agent/AgentRunNativeToolLoopService.ts',
    'src/runtime/agent/AgentRunService.ts',
    'src/adapters/channels/ChannelLongTailLiveClients.ts',
    'src/adapters/providers/ProviderLongTailLiveClients.ts',
    'src/zavorth-control/app/api/experience/approvals/[id]/decision/route.ts',
    'src/services/experience/ActionCardService.ts',
  ]);
  return (file: string) => {
    const normalized = file.replace(/\\/g, '/');
    return Array.from(files).some((entry) => normalized.endsWith(entry));
  };
}
