import fs from 'node:fs';
import path from 'node:path';

import {
  createCoordinatedNpmPublishApprovalGateFixture,
  createCoordinatedNpmPublishApprovalSource,
  normalizeCoordinatedNpmPublishApprovalGate,
  COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  CoordinatedNpmPublishApprovalSource,
  CoordinatedNpmPublishExpectedState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/265-coordinated-npm-publish-approval-gate.md';
const DOC_263 = 'docs/263-post-absorption-publish-create-and-stability-gate.md';
const DOC_264 = 'docs/264-create-zavorth-package-bridge-pack.md';
const BOUNDARY = 'src/runtime/external-agents/CoordinatedNpmPublishApprovalGate.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const PUBLIC_SURFACES = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
  'package.json',
  'packages/create-zavorth/package.json',
  'packages/create-zavorth/README.md',
];

const EXPECTED_STATES: CoordinatedNpmPublishExpectedState[] = [
  'publishDecision=blocked',
  'publishBlocked=true',
  'rootPackageReady=true',
  'createZavorthPackageReady=true',
  'npmIdentityAvailable=false',
  'publishOrder=root-then-create',
  'npmPublishActuallyPerformed=false',
  'createZavorthPublishActuallyPerformed=false',
  'finalOperatorApprovalRequired=true',
];

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('raw user message body' + ' that must never migrate');
  expect(serialized).not.toContain('unredacted private message' + ' fixture');
}

describe('Coordinated npm publish approval gate', () => {
  let source: CoordinatedNpmPublishApprovalSource;
  let pack: ReturnType<typeof createCoordinatedNpmPublishApprovalGateFixture>;

  beforeAll(() => {
    source = createCoordinatedNpmPublishApprovalSource();
    pack = createCoordinatedNpmPublishApprovalGateFixture();
  });

  it('documents 265 as a coordinated final publish gate with blockers', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `blocked`');
    expect(content).toContain('CoordinatedNpmPublishApprovalGate.ts');
    expect(content).toContain('publishDecision=blocked');
    expect(content).toContain('rootPackageReady=true');
    expect(content).toContain('createZavorthPackageReady=true');
    expect(content).toContain('npmWhoamiResult=ENEEDAUTH');
    expect(content).toContain('npm publish --access public');
    expect(content).toContain('cd packages/create-zavorth && npm publish --access public');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    assertNoRawSecretOrContent(content);
  });

  it('exports the 265 boundary and creates a blocked fixture', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('CoordinatedNpmPublishApprovalGate/v1');
    expect(boundary).toContain('NpmPackagePublishReadiness/v1');
    expect(boundary).toContain('NpmPublishOrderPlan/v1');
    expect(boundary).toContain('NpmPublishIdentityCheck/v1');
    expect(boundary).toContain('NpmPublishSafetyReport/v1');
    expect(boundary).toContain('NpmPublishGoNoGoDecision/v1');
    expect(index).toContain("from './CoordinatedNpmPublishApprovalGate.js'");
    expect(index).toContain('COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('blocked');
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('knows both npm packages and keeps versions coherent', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };

    expect(rootPackage.name).toBe('zavorth');
    expect(createPackage.name).toBe('create-zavorth');
    expect(rootPackage.version).toBe('1.1.0-alpha.0');
    expect(createPackage.version).toBe(rootPackage.version);
    expect(pack.normalization.rootPackage).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      packageVersion: '1.1.0-alpha.0',
      packDryRunReady: true,
      blockers: [],
      npmPublishActuallyPerformed: false,
    }));
    expect(pack.normalization.createZavorthPackage).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      packageVersion: '1.1.0-alpha.0',
      packDryRunReady: true,
      blockers: [],
      npmPublishActuallyPerformed: false,
    }));
    expect(rootPackage.bin.zavorth).toBe('./bin/zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
  });

  it('prepares publish order and commands without executing publish', () => {
    expect(pack.normalization.publishOrderPlan).toEqual({
      nativeContract: 'NpmPublishOrderPlan/v1',
      publishOrder: 'root-then-create',
      rationale: 'Publish the main zavorth CLI first so the create-zavorth initializer can point users at an already available installed CLI path.',
      publishCommandsPreparedButNotExecuted: true,
      finalCommands: [
        'npm publish --access public',
        'cd packages/create-zavorth && npm publish --access public',
      ],
      alphaTagAlternatives: [
        'npm publish --access public --tag alpha',
        'cd packages/create-zavorth && npm publish --access public --tag alpha',
      ],
      residualRisks: [
        'Public npm currently has a zavorth package at 0.3.9; operator must have maintainer rights before publishing zavorth@1.1.0-alpha.0.',
        'Version 1.1.0-alpha.0 is prerelease-shaped; use --tag alpha unless the operator explicitly wants this to become latest.',
        'create-zavorth appears unpublished, so its first publish still requires authenticated operator approval.',
      ],
      futureSmokeAfterPublish: 'npm create zavorth -- --dry-run',
      npmPublishActuallyPerformed: false,
      createZavorthPublishActuallyPerformed: false,
    });
  });

  it('records npm identity as checked but unavailable without printing tokens', () => {
    expect(pack.normalization.npmIdentityCheck).toEqual({
      nativeContract: 'NpmPublishIdentityCheck/v1',
      npmWhoamiChecked: true,
      npmIdentityAvailable: false,
      npmIdentityStatus: 'not-authenticated',
      npmWhoamiResult: 'ENEEDAUTH',
      npmTokenPrinted: false,
      npmAuthModified: false,
      blocker: 'npm whoami returned ENEEDAUTH; operator must authenticate before any real publish approval.',
    });
  });

  it('keeps safety guardrails closed', () => {
    expect(pack.normalization.safetyReport).toEqual({
      nativeContract: 'NpmPublishSafetyReport/v1',
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
      batFilesNotProductPath: true,
      rawImportDefaultDisabled: true,
      limitedProductionSendStillGated: true,
      adapterRemovalGlobalAllowed: false,
      runtimePersistentStart: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorLiveCalled: false,
      blockers: [],
    });
  });

  it('blocks publish until npm auth and registry ownership are resolved', () => {
    expect(pack.normalization.goNoGoDecision).toEqual({
      nativeContract: 'NpmPublishGoNoGoDecision/v1',
      publishDecision: 'blocked',
      publishReady: false,
      publishBlocked: true,
      publishBlockers: [
        'npm identity unavailable: npm whoami returned ENEEDAUTH',
        'registry ownership unverified: public npm already has zavorth at 0.3.9, so operator maintainer rights must be confirmed',
      ],
      finalOperatorApprovalRequired: true,
      rootPackageReady: true,
      createZavorthPackageReady: true,
      npmPublishActuallyPerformed: false,
      createZavorthPublishActuallyPerformed: false,
    });
    expect(pack.publishAllowed()).toBe(false);
  });

  it('updates 263 and 264 follow-up docs with coordinated gate context', () => {
    const doc263 = read(DOC_263);
    const doc264 = read(DOC_264);

    expect(doc263).toContain('docs/264-create-zavorth-package-bridge-pack.md');
    expect(doc264).toContain('docs/265-coordinated-npm-publish-approval-gate.md');
    expect(doc264).toContain('publishDecision=blocked');
    expect(doc264).toContain('npmIdentityAvailable=false');
    assertNoRawSecretOrContent(doc263);
    assertNoRawSecretOrContent(doc264);
  });

  it('keeps public docs and packages free of source identity and local launcher promotion', () => {
    PUBLIC_SURFACES.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\\.bat\\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      assertNoRawSecretOrContent(content);
    });
  });

  it('keeps exact execution guarantees closed', () => {
    expect(pack.normalization.executionGate).toEqual({
      coordinatedNpmPublishApprovalGateCreated: true,
      publishDecision: 'blocked',
      publishReady: false,
      publishBlocked: true,
      rootPackageReady: true,
      createZavorthPackageReady: true,
      npmIdentityAvailable: false,
      publishOrder: 'root-then-create',
      npmPublishActuallyPerformed: false,
      createZavorthPublishActuallyPerformed: false,
      finalOperatorApprovalRequired: true,
      rawSecretSerialized: false,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      rawImportDefaultDisabled: true,
      limitedProductionSendStillGated: true,
      adapterRemovalGlobalAllowed: false,
    });
  });

  it('blocks prohibited publish, auth, runtime, source identity, migration, and execution regressions', () => {
    const blockedCases: Array<keyof CoordinatedNpmPublishApprovalSource> = [
      'npmPublishAttempted',
      'createZavorthPublishAttempted',
      'npmAuthModified',
      'globalInstallAttempted',
      'runtimePersistentStartAttempted',
      'externalExecutorLiveCalled',
      'publicExternalExecutorIdentityExposed',
      'docsPromoteBatFiles',
      'rawSqliteImportEnabled',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'adapterGlobalRemovalAttempted',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeCoordinatedNpmPublishApprovalGate({
        generatedAt: '2026-05-02T04:30:00.000Z',
        runtimeId: COORDINATED_NPM_PUBLISH_APPROVAL_GATE_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as CoordinatedNpmPublishApprovalSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.createZavorthPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.finalOperatorApprovalRequired).toBe(true);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.executionGate.publicExternalExecutorIdentityLeak).toBe(false);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
    });
  });

  it('keeps serialized output redacted and terminal on explicit operator approval', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.terminalGate).toBe('do-not-publish-without-explicit-operator-approval');
    assertNoRawSecretOrContent(serialized);
  });
});
