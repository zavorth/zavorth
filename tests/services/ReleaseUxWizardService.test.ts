import { RELEASE_UX_PACKAGE_SCRIPTS } from '../../src/contracts/ReleaseUxWizardContract';
import { buildRuntimeShellHtml } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml';
import type { ZavorthReleasePresenceSnapshot } from '../../src/services/ZavorthReleasePresenceControlPlaneService';
import { ReleaseUxWizardService } from '../../src/services/ReleaseUxWizardService';

describe('ReleaseUxWizardService', () => {
  it('passes against the current repository release UX contract', async () => {
    const service = new ReleaseUxWizardService();

    const snapshot = await service.buildSnapshot();

    expect(snapshot.phase).toBe('44');
    expect(snapshot.surface).toBe('release-ux');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.wizard.steps.some((step) => step.stage === 'publish' && step.requiresApproval)).toBe(true);
    expect(snapshot.wizard.rollback.previewOnly).toBe(true);
  });

  it('builds preview-first wizard, human diff, rollback preview and changelog', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/control'),
      releasePresenceSnapshot: releasePresenceFixture(),
      now: () => new Date('2026-04-24T17:10:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.release.channel).toBe('stable');
    expect(snapshot.wizard.humanDiff.available).toBe(true);
    expect(snapshot.wizard.humanDiff.docsDelta).toBe('+1 ~2 -0');
    expect(snapshot.wizard.rollback.confirmationRequired).toBe(true);
    expect(snapshot.wizard.rollback.executed).toBe(false);
    expect(snapshot.wizard.changelog.entries).toHaveLength(2);
    expect(snapshot.wizard.steps.every((step) => step.previewOnly)).toBe(true);
  });

  it('fails when package scripts for the release wizard are missing', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture({
        'release:wizard': '',
        'qa:release-ux': '',
      }),
      html: buildRuntimeShellHtml('/control'),
      releasePresenceSnapshot: releasePresenceFixture(),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'package:release:wizard', status: 'fail' }),
      expect.objectContaining({ id: 'package:qa:release-ux', status: 'fail' }),
    ]));
  });

  it('fails when the Control UI release wizard card disappears', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture(),
      html: '<section id="qa-control-plane-card"></section>',
      releasePresenceSnapshot: releasePresenceFixture(),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'web:release-ux-wizard', status: 'fail' }),
    ]));
  });

  it('fails when rollback preview becomes executable or lacks confirmation', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/control'),
      releasePresenceSnapshot: releasePresenceFixture({
        rollback: {
          ...releasePresenceFixture().rollback,
          previewOnly: false,
          confirmationRequired: false,
        },
        contracts: {
          ...releasePresenceFixture().contracts,
          rollbackPreviewDoesNotExecute: false,
        },
      }),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rollback:guarded-preview', status: 'fail' }),
      expect.objectContaining({ id: 'control-plane:release-presence', status: 'fail' }),
    ]));
  });

  it('fails when operational changelog exposes unsafe payload language', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/control'),
      releasePresenceSnapshot: releasePresenceFixture({
        changelog: {
          generatedFrom: 'publish-history+telemetry-ledger',
          entries: ['Published with token=abc123 raw payload secret'],
        },
      }),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'changelog:operational', status: 'fail' }),
    ]));
  });

  it('renders a human report with the next phase recommendation', async () => {
    const service = new ReleaseUxWizardService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/control'),
      releasePresenceSnapshot: releasePresenceFixture(),
    });

    const report = await service.renderReport();

    expect(report).toContain('Etapa 44 - Release UX');
    expect(report).toContain('proximo passo recomendada: 42 - Tenant/Team Ops');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  const scripts = Object.fromEntries(RELEASE_UX_PACKAGE_SCRIPTS.map((scriptName) => [
    scriptName,
    scriptCommandFixture(scriptName),
  ]));
  return {
    scripts: {
      ...scripts,
      ...overrides,
    },
  };
}

function scriptCommandFixture(scriptName: string): string {
  const commands: Record<string, string> = {
    'release:status': 'npm run cli -- release status',
    'release:diff': 'npm run cli:fast -- release diff previous latest',
    'release:rollback-preview': 'npm run cli:fast -- release rollback --preview',
    'release:presence': 'npm run cli:fast -- release presence',
    'release:changelog': 'npx tsx scripts/release-ux-wizard.ts --changelog',
    'release:wizard': 'npx tsx scripts/release-ux-wizard.ts',
    'release:wizard:json': 'npx tsx scripts/release-ux-wizard.ts --json',
    'qa:release-ux': 'npx tsx scripts/release-ux-wizard.ts --require-pass',
    'qa:stage:44': 'node scripts/capability-suite-market-check.mjs --phase=44',
    'release:scan': 'npx tsx scripts/release-hygiene-scan.ts',
    'release:alpha': 'node scripts/release-train.mjs --profile=alpha',
    'release:beta': 'node scripts/release-train.mjs --profile=beta',
  };
  return commands[scriptName] || `npm run ${scriptName}`;
}

function releasePresenceFixture(overrides: Partial<ZavorthReleasePresenceSnapshot> = {}): ZavorthReleasePresenceSnapshot {
  const base: ZavorthReleasePresenceSnapshot = {
    generatedAt: '2026-04-24T17:00:00.000Z',
    stage: '31',
    surface: 'release-presence-control-plane',
    mode: 'status',
    status: 'ready',
    release: {
      packageName: 'zavorth',
      version: '1.2.3',
      channel: 'stable',
      latest: {
        id: 'release-b',
        label: 'release-b',
        publishedAt: '2026-04-24T16:00:00.000Z',
        branch: 'main',
        commit: 'bbbbbbbb22222222',
        docsUrl: 'https://docs.example.com',
        remoteConsoleUrl: 'https://console.example.com',
        diffToPrevious: '2 changed files',
      },
      risk: {
        level: 'low',
        reasons: ['release com historico e rollback em postura aceitavel'],
      },
      verification: {
        available: true,
        digest: 'sha256:test',
        subject: 'release-b',
        reason: 'digest local calculado',
      },
    },
    channels: [],
    history: [],
    changelog: {
      generatedFrom: 'publish-history+telemetry-ledger',
      entries: [
        'Ultimo publish: release-b em 2026-04-24T16:00:00.000Z.',
        'Diff: 3 arquivo(s) adicionados ou alterados.',
      ],
    },
    diff: {
      requested: { from: 'previous', to: 'latest' },
      available: true,
      report: {
        from: { id: 'release-a', label: 'release-a', commit: 'aaaaaaaa11111111', publishedAt: '2026-04-24T15:00:00.000Z' },
        to: { id: 'release-b', label: 'release-b', commit: 'bbbbbbbb22222222', publishedAt: '2026-04-24T16:00:00.000Z' },
        comparedAt: '2026-04-24T17:00:00.000Z',
        commitChanged: true,
        summary: 'release-a (aaaaaaaa) -> release-b (bbbbbbbb): 3 arquivo(s) adicionados/alterados.',
        overall: { added: 1, changed: 2, removed: 0, unchanged: 5 },
        targets: {
          docs: {
            label: 'docs',
            fromPath: 'archives/a/docs',
            toPath: 'archives/b/docs',
            fromFileCount: 3,
            toFileCount: 4,
            added: ['new.html'],
            changed: ['index.html', 'guide.html'],
            removed: [],
            unchangedCount: 1,
          },
          remoteConsole: {
            label: 'remote-console',
            fromPath: 'archives/a/remote-console',
            toPath: 'archives/b/remote-console',
            fromFileCount: 2,
            toFileCount: 2,
            added: [],
            changed: ['index.html'],
            removed: [],
            unchangedCount: 1,
          },
        },
      },
      summary: 'release-a (aaaaaaaa) -> release-b (bbbbbbbb): 3 arquivo(s) adicionados/alterados.',
    },
    rollback: {
      targetId: 'release-a',
      targetLabel: 'release-a',
      command: 'node scripts/remote-rollback.mjs --dry-run --id=release-a',
      previewOnly: true,
      confirmationRequired: true,
      executed: false,
      preflight: {
        status: 'pass',
        checks: [
          { id: 'target-resolved', status: 'pass', summary: 'Target release-a resolvido.' },
          { id: 'diff-evidence', status: 'pass', summary: 'Diff pronto.' },
        ],
      },
      evidence: ['commit=aaaaaaaa11111111', 'publishedAt=2026-04-24T15:00:00.000Z'],
      reversalPlan: [
        'Selecionar snapshot arquivado.',
        'Comparar target com current-prepared.',
      ],
    },
    remotePresence: {
      status: 'online',
      transportTotal: 1,
      ready: 1,
      partial: 0,
      dormant: 0,
      pendingWork: 0,
      stateSummary: 'Remote presence online.',
      credentials: {
        mode: 'redacted-or-none',
        looseCredentialRequired: false,
        reason: 'Sem credencial solta.',
      },
      entries: [],
    },
    mirroring: {
      longFlowMirroring: 'authorized-surfaces-only',
      enabled: true,
      authorizedSurfaces: ['cli', 'control-ui'],
      reason: 'Autorizado.',
    },
    costPanel: {
      source: 'telemetry-ledger',
      available: true,
      totalEvents: 2,
      traces: 1,
      failures: 0,
      blocked: 0,
      estimatedAttempts: 2,
      tokenAccounting: {
        available: false,
        totalTokens: 0,
        reason: 'Sem token bruto.',
      },
      taskCosts: [],
    },
    contracts: {
      remoteNeverRequiresLooseCredentialFirstLayer: true,
      rollbackHasPreflightAndEvidence: true,
      publishRegistersVersionDiffRiskRollback: true,
      remotePresenceDegradesWhenOffline: true,
      rollbackPreviewDoesNotExecute: true,
      snapshotVerificationWhenApplicable: true,
    },
    commands: {
      status: 'zavorth release status --json',
      diff: 'zavorth release diff previous latest --json',
      rollbackPreview: 'zavorth release rollback --preview --json',
      presence: 'zavorth release presence --json',
    },
    narrative: {
      headline: 'Release stable pronto.',
      operatorSummary: 'low: release com historico e rollback em postura aceitavel',
    },
  };

  return {
    ...base,
    ...overrides,
  };
}
