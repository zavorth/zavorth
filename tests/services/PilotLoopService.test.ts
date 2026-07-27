import {
  PilotLoopService,
  type PilotLoopServiceOptions,
} from '../../src/services/PilotLoopService';
import {
  PILOT_DASHBOARD_METRICS,
  PILOT_FEEDBACK_TEMPLATES,
  PILOT_LEDGER_ENTRIES,
  PILOT_LOOP_REQUIRED_CORE_SCRIPTS,
  PILOT_SUPPORT_POLICY,
  PILOT_TRIAGE_RULES,
} from '../../src/contracts/PilotLoopContract';

describe('PilotLoopService', () => {
  it('builds an ok Credential vault7 snapshot from pilot loop artifacts', () => {
    const service = serviceFromFixture({}, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('pilot-loop');
    expect(snapshot.surface).toBe('pilot-loop');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.nextRecommendedGate).toEqual(expect.objectContaining({
      stage: '58',
      title: 'Integration Showcase And Partner Surface',
    }));
  });

  it('warns about missing artifacts when not required yet', () => {
    const service = serviceFromFixture({
      'artifact:feedback-preview-redacted.json': undefined,
      'artifact:pilot-ledger.json': undefined,
      'artifact:support-dashboard.json': undefined,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pilot-loop:feedback-preview',
        status: 'warn',
      }),
    ]));
  });

  it('fails when qa:pilot-loop is missing from package scripts', () => {
    const scripts = coreScriptsFixture();
    delete scripts['qa:pilot-loop'];
    const service = serviceFromFixture({
      'core:package.json': JSON.stringify({ scripts }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pilot-loop:script:qa:pilot-loop',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the preview artifact would send data', () => {
    const service = serviceFromFixture({
      'artifact:feedback-preview-redacted.json': JSON.stringify({
        ...feedbackPreviewArtifact(),
        sendsData: true,
      }),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pilot-loop:feedback-preview',
        status: 'fail',
      }),
    ]));
  });

  it('fails when the pilot ledger contains workspace payload data policy', () => {
    const artifact = pilotLedgerArtifact();
    artifact.entries[0] = {
      ...artifact.entries[0],
      dataPolicy: 'workspace-payload',
    };
    const service = serviceFromFixture({
      'artifact:pilot-ledger.json': JSON.stringify(artifact),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pilot-loop:pilot-ledger',
        status: 'fail',
      }),
    ]));
  });

  it('fails when docs no longer point to Credential vault8', () => {
    const service = serviceFromFixture({
      'core:docs/product-direction.md': docs76Source().replace(
        'Readiness checkpoint 8 - Integration Showcase And Partner Surface',
        'Future stage',
      ),
      'core:docs/product-direction.md': roadmapSource().replace(
        'Readiness checkpoint 8 - Integration Showcase And Partner Surface',
        'Future stage',
      ),
    }, { requireArtifacts: true });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pilot-loop:next-phase',
        status: 'fail',
      }),
    ]));
  });

  it('renders a human report with the next gate recommendation', () => {
    const service = serviceFromFixture();

    const report = service.renderReport();

    expect(report).toContain('Readiness checkpoint 7 - Feedback, Support And Pilot Loop');
    expect(report).toContain('next step recomendada: 58 - Integration Showcase And Partner Surface');
  });
});

function serviceFromFixture(
  overrides: Record<string, string | undefined> = {},
  options: Partial<PilotLoopServiceOptions> = {},
) {
  const files = filesFixture();
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'undefined') {
      delete files[key];
    } else {
      files[key] = value;
    }
  }
  return new PilotLoopService({
    projectRoot: 'C:\\repo\\Zavorth',
    websiteRoot: 'C:\\repo\\zavorth-website',
    artifactDir: 'C:\\repo\\Zavorth\\.qa\\pilot-loop',
    files,
    existsSync: (targetPath: string) => {
      const normalized = targetPath.replace(/\\/g, '/');
      if (normalized === 'C:/repo/zavorth-website') {
        return true;
      }
      return [
        '/app/feedback/page.tsx',
        '/data/feedback-loop.ts',
        '/app/docs/page.tsx',
      ].some((suffix) => normalized.endsWith(suffix));
    },
    readFileSync: () => '',
    now: () => new Date('2026-04-26T00:00:00.000Z'),
    ...options,
  });
}

function filesFixture(): Record<string, string> {
  return {
    'core:package.json': JSON.stringify({
      scripts: coreScriptsFixture(),
    }, null, 2),
    'core:src/contracts/FeedbackTelemetryContract.ts': 'Feedback opt-in feedback-preview-redacted.json',
    'core:src/services/FeedbackTelemetryContractService.ts': 'export class FeedbackTelemetryContractService {}',
    'core:scripts/feedback-loop.ts': 'feedback-preview-redacted.json product-feedback-ledger.json',
    'core:docs/product-direction.md': 'Readiness checkpoint 2 - Feedback, Telemetry Opt-In And Product Loop',
    'core:docs/product-direction.md': docs76Source(),
    'core:docs/product-direction.md': roadmapSource(),
    'website:app/feedback/page.tsx': feedbackSource(),
    'website:data/feedback-loop.ts': feedbackSource(),
    'website:app/docs/page.tsx': docsSource(),
    'artifact:feedback-preview-redacted.json': JSON.stringify(feedbackPreviewArtifact()),
    'artifact:pilot-ledger.json': JSON.stringify(pilotLedgerArtifact()),
    'artifact:support-dashboard.json': JSON.stringify(dashboardArtifact()),
  };
}

function coreScriptsFixture() {
  const scripts: Record<string, string> = {};
  for (const scriptName of PILOT_LOOP_REQUIRED_CORE_SCRIPTS) {
    scripts[scriptName] = `echo ${scriptName}`;
  }
  return scripts;
}

function feedbackSource() {
  return [
    'issue/report template',
    'Product feedback ledger',
    'agregador sem payload sensitive',
    'feedback:preview',
    'feedback:revoke',
    'feedback:delete',
    'Telemetry desligada por pattern',
    'preview redigido',
    'sem depender de cloud obrigatoria',
  ].join('\n');
}

function docsSource() {
  return [
    feedbackSource(),
    'triagem',
    'pilotos',
    'suporte',
  ].join('\n');
}

function docs76Source() {
  return [
    'Readiness checkpoint 7 - Feedback, Support And Pilot Loop',
    'feedback',
    'support',
    'pilot loop',
    'triagem',
    'ledger local',
    'payload sensitive',
    'qa:pilot-loop',
    'qa:pilot-loop',
    'Readiness checkpoint 8 - Integration Showcase And Partner Surface',
    'qa:integration-showcase',
  ].join('\n');
}

function roadmapSource() {
  return [
    'Readiness checkpoint 7 - Feedback, Support And Pilot Loop: implementada.',
    'feedback support pilot loop triagem ledger local payload sensitive',
    'qa:pilot-loop',
    'qa:pilot-loop',
    'Readiness checkpoint 8 - Integration Showcase And Partner Surface',
    'qa:integration-showcase',
  ].join('\n');
}

function feedbackPreviewArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '57',
    ok: true,
    telemetry: 'disabled-by-default',
    sendsData: false,
    redactions: ['tokens', 'secrets', 'paths pessoais', 'payload bruto'],
  };
}

function pilotLedgerArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '57',
    ok: true,
    entries: PILOT_LEDGER_ENTRIES.map((entry) => ({ ...entry })),
    supportPolicy: PILOT_SUPPORT_POLICY,
    triageRules: PILOT_TRIAGE_RULES,
  };
}

function dashboardArtifact() {
  return {
    schemaVersion: '1.0.0',
    stage: '57',
    ok: true,
    containsPayload: false,
    metrics: PILOT_DASHBOARD_METRICS.map((metric) => ({ ...metric, value: 0 })),
  };
}
