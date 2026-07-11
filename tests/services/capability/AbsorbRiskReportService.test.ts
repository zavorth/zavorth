import {
  ABSORB_RISK_REPORT_CONTRACT_VERSION,
  type AbsorbRiskReport,
} from '../../../src/contracts/capability/AbsorbRiskReportContract.js';
import {
  AbsorbRiskReportService,
  resolveAbsorbProofAction,
  type CapabilityFabricSnapshotLike,
} from '../../../src/services/capability/AbsorbRiskReportService.js';

const FIXED_NOW = new Date('2026-07-11T15:00:00.000Z');

function createService(): AbsorbRiskReportService {
  let counter = 0;
  return new AbsorbRiskReportService({
    now: () => FIXED_NOW,
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

function baseSnapshot(
  overrides: Partial<CapabilityFabricSnapshotLike> = {},
): CapabilityFabricSnapshotLike {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    status: 'preview-only',
    apply: false,
    source: {
      raw: './packs/demo-skill',
      kind: 'path',
      label: 'demo-skill',
      remoteUrl: null,
      resolvedLocalPath: './packs/demo-skill',
    },
    candidates: [],
    issues: [],
    receipts: [],
    summary: {
      candidates: 0,
      skills: 0,
      plugins: 0,
      mcp: 0,
      highRisk: 0,
      executableCode: 0,
      denied: 0,
      heldForApproval: 0,
    },
    quarantineRoot: '/tmp/zavorth-quarantine/demo',
    narrative: {
      headline: 'Absorb preview',
      operatorSummary: 'Candidates quarantined',
      nextSafeAction: 'Review then apply with consent',
    },
    ...overrides,
  };
}

describe('AbsorbRiskReportService', () => {
  test('snapshot with executable → high overall + executable finding', () => {
    const service = createService();
    const snapshot = baseSnapshot({
      candidates: [
        {
          id: 'c-plugin-1',
          kind: 'plugin',
          name: 'risky-plugin',
          title: 'Risky Plugin',
          description: 'Runs local hooks',
          relativeEntry: 'index.js',
          trustState: 'quarantined',
          risk: 'high',
          reasons: ['executable entrypoint'],
          tags: ['plugin'],
          executableCodeDetected: true,
          instructionOnly: false,
          targetDirHint: 'plugins/risky-plugin',
        },
      ],
      summary: {
        candidates: 1,
        skills: 0,
        plugins: 1,
        mcp: 0,
        highRisk: 1,
        executableCode: 1,
        denied: 0,
        heldForApproval: 1,
      },
    });

    const report = service.fromFabricSnapshot(snapshot);

    expect(report.contractVersion).toBe(ABSORB_RISK_REPORT_CONTRACT_VERSION);
    expect(report.overallRisk).toBe('high');
    expect(report.executableDetected).toBe(true);
    expect(report.promoteReady).toBe(false);
    expect(report.candidateCount).toBe(1);
    expect(report.findings.some((f) => f.dimension === 'executable')).toBe(true);
    expect(report.findings.some((f) => f.severity === 'high' || f.severity === 'critical')).toBe(
      true,
    );
    expect(report.summaryBullets.length).toBeGreaterThanOrEqual(3);
    expect(report.summaryBullets.length).toBeLessThanOrEqual(6);
  });

  test('skill-only low risk', () => {
    const service = createService();
    const snapshot = baseSnapshot({
      candidates: [
        {
          id: 'c-skill-1',
          kind: 'skill',
          name: 'notes-skill',
          title: 'Notes Skill',
          description: 'Instruction-only skill markdown',
          relativeEntry: 'SKILL.md',
          trustState: 'previewed',
          risk: 'low',
          reasons: ['instruction pack'],
          tags: ['skill'],
          executableCodeDetected: false,
          instructionOnly: true,
          targetDirHint: 'skills/notes-skill',
        },
      ],
      summary: {
        candidates: 1,
        skills: 1,
        plugins: 0,
        mcp: 0,
        highRisk: 0,
        executableCode: 0,
        denied: 0,
        heldForApproval: 0,
      },
    });

    const report = service.fromFabricSnapshot(snapshot);

    expect(report.kind).toBe('skill');
    expect(report.executableDetected).toBe(false);
    expect(report.secretLikeDetected).toBe(false);
    expect(report.overallRisk).toBe('low');
    expect(report.findings.some((f) => f.dimension === 'executable' && f.severity === 'high')).toBe(
      false,
    );
  });

  test('markdown contains Risk report', () => {
    const service = createService();
    const report = service.fromFabricSnapshot(
      baseSnapshot({
        candidates: [
          {
            id: 'c1',
            kind: 'skill',
            name: 'hello',
            title: 'Hello',
            risk: 'low',
            executableCodeDetected: false,
            relativeEntry: 'SKILL.md',
          },
        ],
      }),
    );
    const md = service.toMarkdown(report);
    expect(md).toContain('Risk report:');
    expect(md).toContain('overall:');
    expect(md).toContain('Summary:');
  });

  test('proof event input has kind marketplace or system', () => {
    const service = createService();
    const report = service.fromFabricSnapshot(
      baseSnapshot({
        candidates: [
          {
            id: 'c1',
            kind: 'mcp',
            name: 'remote-mcp',
            risk: 'medium',
            executableCodeDetected: false,
          },
        ],
        source: {
          raw: 'https://example.com/mcp-pack',
          kind: 'https-url',
          label: 'mcp-pack',
          remoteUrl: 'https://example.com/mcp-pack',
        },
      }),
    );

    for (const action of ['preview', 'promote', 'reject'] as const) {
      const event = service.toProofEventInput(report, action);
      expect(['marketplace', 'system']).toContain(event.kind);
      expect(event.source).toBe('absorb-risk-report');
      expect(event.title.toLowerCase()).toContain('absorb');
      expect(event.metadata?.absorbAction).toBe(action);
      expect(event.metadata?.contractVersion).toBe(ABSORB_RISK_REPORT_CONTRACT_VERSION);
      // Dual-tag: marketplace primary + system secondary
      expect(
        event.kind === 'marketplace' ||
          event.kind === 'system' ||
          event.metadata?.secondaryKind === 'system',
      ).toBe(true);
    }
  });

  test('secret-like issues raise secrets dimension', () => {
    const service = createService();
    const report = service.fromFabricSnapshot(
      baseSnapshot({
        candidates: [
          {
            id: 'c1',
            kind: 'skill',
            name: 'ok-skill',
            risk: 'low',
            executableCodeDetected: false,
          },
        ],
        issues: [
          {
            severity: 'warn',
            code: 'SECRET_LIKE_PATH',
            message: 'Candidate path looks like api_key material',
          },
        ],
      }),
    );

    expect(report.secretLikeDetected).toBe(true);
    expect(report.findings.some((f) => f.dimension === 'secrets')).toBe(true);
    expect(['high', 'critical', 'medium']).toContain(report.overallRisk);
  });

  test('resolveAbsorbProofAction maps preview / promote / reject', () => {
    expect(
      resolveAbsorbProofAction({ apply: false, consent: false, status: 'preview-only' }),
    ).toBe('preview');
    expect(
      resolveAbsorbProofAction({ apply: true, consent: true, status: 'passed' }),
    ).toBe('promote');
    expect(
      resolveAbsorbProofAction({ apply: true, consent: true, status: 'blocked' }),
    ).toBe('reject');
    expect(
      resolveAbsorbProofAction({
        apply: false,
        consent: false,
        status: 'preview-only',
        receipts: [{ kind: 'deny', status: 'deny' }],
      }),
    ).toBe('reject');
  });

  test('network finding for http source and mcp', () => {
    const service = createService();
    const report = service.fromFabricSnapshot(
      baseSnapshot({
        source: {
          raw: 'https://cdn.example.com/pack.tgz',
          kind: 'https-url',
          label: 'pack.tgz',
          remoteUrl: 'https://cdn.example.com/pack.tgz',
        },
        candidates: [
          {
            id: 'mcp-1',
            kind: 'mcp',
            name: 'tools-mcp',
            risk: 'medium',
            executableCodeDetected: false,
          },
        ],
      }),
    );

    expect(report.findings.some((f) => f.dimension === 'network')).toBe(true);
    expect(report.kind).toBe('mcp');
  });

  test('empty snapshot still yields a valid report', () => {
    const service = createService();
    const report: AbsorbRiskReport = service.fromFabricSnapshot({});
    expect(report.contractVersion).toBe(ABSORB_RISK_REPORT_CONTRACT_VERSION);
    expect(report.candidateCount).toBe(0);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(service.toMarkdown(report)).toContain('Risk report:');
  });
});
