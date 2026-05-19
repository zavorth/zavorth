import { ZavorthMaturityService } from '../../src/services/ZavorthMaturityService';

const NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ZavorthMaturityService', () => {
  it('builds a daily-use-ready maturity snapshot while keeping live production honest', () => {
    const service = buildService();

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-maturity.v1');
    expect(snapshot.status).toBe('needs-attention');
    expect(snapshot.summary.dailyUseReady).toBe(true);
    expect(snapshot.summary.productionLiveReady).toBe(false);
    expect(snapshot.summary.stubsOrPartials).toBe(1);
    expect(snapshot.distinctions).toEqual(expect.objectContaining({
      contractReady: true,
      dailyUseReady: true,
      productionLiveReady: false,
      dashboardVisualQaClaimed: false,
      externalReferenceLeakFree: true,
      hostLiveCertificationHonest: true,
      dataLifecycleComplete: true,
    }));
    expect(snapshot.gates.map((gate) => gate.id)).toEqual(expect.arrayContaining([
      'channel-experience-contract',
      'contract-vs-live-boundary',
      'host-live-certification',
      'operational-maturity-matrix',
      'stub-partial-truth-ledger',
      'dashboard-contract-and-visual-qa',
      'privacy-data-lifecycle',
      'operator-simplicity',
      'identity-hygiene',
    ]));
  });

  it('blocks maturity when channel contracts fail', () => {
    const service = buildService({
      channelReleaseReady: false,
      channelBlockers: 2,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.dailyUseReady).toBe(false);
    expect(snapshot.gates.find((gate) => gate.id === 'channel-experience-contract')).toEqual(expect.objectContaining({
      status: 'blocked',
    }));
  });

  it('detects external reference leaks in active source', () => {
    const service = buildService({
      files: {
        'package.json': JSON.stringify({ scripts: requiredScripts() }),
        'src/services/BadName.ts': 'export const bad = "ThirdPartyAgent";',
        'src/security/SensitiveDataGuard.ts': 'ok',
        'src/ai-gateway/lib/logExportRedaction.ts': 'ok',
        'src/ai-gateway/lib/db/backupSanitizer.ts': 'ok',
        'docs/05-security.md': 'ok',
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.externalReferenceLeaks).toBe(1);
    expect(snapshot.gates.find((gate) => gate.id === 'identity-hygiene')?.evidence).toEqual([
      'src/services/BadName.ts',
    ]);
  });

  it('renders a compact maturity report', () => {
    const service = buildService();

    const report = service.renderReport();

    expect(report).toContain('Zavorth Product Maturity');
    expect(report).toContain('Status: needs-attention');
    expect(report).toContain('Stubs/partials explicitos: 1');
  });
});

function buildService(options: {
  channelReleaseReady?: boolean;
  channelBlockers?: number;
  files?: Record<string, string>;
} = {}): ZavorthMaturityService {
  const files = options.files || defaultFiles();
  const projectRoot = 'C:/fixture/zavorth';
  return new ZavorthMaturityService({
    projectRoot,
    now: () => NOW,
    channelExperienceCertificationService: {
      buildSnapshot: () => channelSnapshot({
        releaseReady: options.channelReleaseReady !== false,
        blockers: options.channelBlockers || 0,
      }) as any,
    },
    liveParityCertificationService: {
      buildSnapshot: () => liveSnapshot() as any,
    },
    hostLiveCertificationService: {
      buildSnapshot: () => hostLiveSnapshot() as any,
    },
    dataLifecyclePolicyService: {
      buildSnapshot: () => dataLifecycleSnapshot() as any,
    },
    dashboardVisualQaService: {
      buildSnapshot: () => dashboardVisualQaSnapshot() as any,
    },
    operationalMaturityService: {
      validate: () => operationalReport() as any,
    },
    existsSync: (targetPath: string) => fileOrDirectoryExists(projectRoot, targetPath, files),
    readFileSync: (targetPath: string) => {
      const key = toRelative(projectRoot, targetPath);
      if (!files[key]) {
        throw new Error(`missing fixture file: ${key}`);
      }
      return files[key] as any;
    },
    readdirSync: (targetPath: string) => listDir(projectRoot, targetPath, files) as any,
    statSync: (targetPath: string) => {
      const relative = toRelative(projectRoot, targetPath);
      const isFile = Boolean(files[relative]);
      return {
        isDirectory: () => !isFile,
      } as any;
    },
  });
}

function fileOrDirectoryExists(projectRoot: string, targetPath: string, files: Record<string, string>): boolean {
  const relative = toRelative(projectRoot, targetPath);
  if (files[relative]) {
    return true;
  }
  const prefix = relative ? `${relative}/` : '';
  return Object.keys(files).some((key) => key.startsWith(prefix));
}

function defaultFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({ scripts: requiredScripts() }),
    'src/index.ts': 'export const name = "Zavorth";',
    'src/security/SensitiveDataGuard.ts': 'ok',
    'src/ai-gateway/lib/logExportRedaction.ts': 'ok',
    'src/ai-gateway/lib/db/backupSanitizer.ts': 'ok',
    'docs/05-security.md': 'ok',
  };
}

function requiredScripts(): Record<string, string> {
  return {
    'channel-experience-certification': 'npx tsx scripts/channel-experience-certification.ts',
    'channel-experience-certification:check': 'node scripts/channel-experience-certification-check.mjs',
    'security:doctor': 'npx tsx scripts/security-doctor.ts',
    'security:continuous': 'npx tsx scripts/security-continuous.ts',
    'security:preset': 'npx tsx scripts/security-preset.ts',
    'zavorth:maturity': 'npx tsx scripts/zavorth-maturity.ts',
    'zavorth:maturity:check': 'node scripts/zavorth-maturity-check.mjs',
    'zavorth:live-host': 'npx tsx scripts/zavorth-live-host-certification.ts',
    'zavorth:live-host:check': 'node scripts/zavorth-live-host-certification-check.mjs',
    'zavorth:data-lifecycle': 'npx tsx scripts/zavorth-data-lifecycle.ts',
    'zavorth:data-lifecycle:check': 'node scripts/zavorth-data-lifecycle-check.mjs',
    'zavorth:dashboard-visual-qa': 'npx tsx scripts/zavorth-dashboard-visual-qa.ts',
    'zavorth:dashboard-visual-qa:check': 'node scripts/zavorth-dashboard-visual-qa-check.mjs',
  };
}

function channelSnapshot(input: { releaseReady: boolean; blockers: number }) {
  return {
    contractVersion: 'channel-experience-certification.v1',
    summary: {
      releaseReady: input.releaseReady,
      blockers: input.blockers,
      certified: input.releaseReady ? 2 : 1,
      total: 2,
      requiredPassed: input.releaseReady ? 20 : 18,
      requiredTotal: 20,
    },
    dashboardEvidence: {
      status: 'contract-ready',
      routes: ['/api/web/channels'],
    },
    entries: [
      {
        channelId: 'telegram',
        readiness: 'ready',
        transport: 'native',
        implementationState: 'full',
      },
      {
        channelId: 'whatsapp',
        readiness: 'partial',
        transport: 'local',
        implementationState: 'partial',
      },
    ],
  };
}

function liveSnapshot() {
  return {
    status: 'certified',
    statement: {
      productionLiveRelease: 'not-claimed-without-operator-live-receipts',
    },
    policy: {
      noLiveIoDuringCertification: true,
    },
  };
}

function hostLiveSnapshot() {
  return {
    contractVersion: 'zavorth-host-live-certification.v1',
    summary: {
      total: 2,
      liveReady: 0,
      hostReady: 0,
      contractOnly: 1,
      stubOrPartial: 1,
      blocked: 0,
      productionLiveCertified: false,
    },
    entries: [],
    selected: null,
    distinctions: {
      contractReadyIsNotLive: true,
      noExternalSendDuringCertification: true,
      stubsAndPartialsAreVisible: true,
      liveRequiresBoundedRecipients: true,
      liveRequiresProviderEvidence: true,
    },
    commands: {
      nextStep: 'Promover provider real.',
    },
  };
}

function dataLifecycleSnapshot() {
  return {
    contractVersion: 'zavorth-data-lifecycle.v1',
    summary: {
      total: 10,
      covered: 10,
      exportable: 10,
      deletable: 10,
      redactionCovered: 9,
      releaseReady: true,
    },
    issues: [],
    commands: {
      nextStep: 'Manter lifecycle.',
    },
  };
}

function dashboardVisualQaSnapshot() {
  return {
    contractVersion: 'zavorth-dashboard-visual-qa.v1',
    status: 'plan-ready',
    summary: {
      scenarios: 3,
      viewports: 2,
      artifactsPresent: 1,
      artifactsExpected: 4,
      evidenceReady: false,
    },
    commands: {
      nextStep: 'Gerar screenshots.',
    },
  };
}

function operationalReport() {
  return {
    ok: true,
    issues: [],
    snapshot: {
      schemaVersion: 'operational-maturity.v1',
      summary: { total: 7 },
      invariants: {
        nexusIsSurfaceOnly: true,
        echoIsEdgeLayerOnly: true,
      },
    },
  };
}

function toRelative(projectRoot: string, targetPath: string): string {
  return targetPath.replace(/\\/g, '/').replace(projectRoot.replace(/\\/g, '/'), '').replace(/^\/+/, '');
}

function listDir(projectRoot: string, targetPath: string, files: Record<string, string>): string[] {
  const relative = toRelative(projectRoot, targetPath);
  const prefix = relative ? `${relative}/` : '';
  const children = new Set<string>();
  for (const key of Object.keys(files)) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const rest = key.slice(prefix.length);
    const child = rest.split('/')[0];
    if (child) {
      children.add(child);
    }
  }
  return Array.from(children);
}
