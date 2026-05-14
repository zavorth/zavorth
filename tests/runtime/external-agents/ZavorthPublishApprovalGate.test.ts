import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID,
  createZavorthPublishApprovalGateFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/272-zavorth-publish-approval-gate.md';
const DOC_271 = 'docs/271-zavorth-install-smoke-pack.md';
const NAMING_DECISION = 'NAMING_DECISION.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPublishApprovalGate.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth publish approval gate', () => {
  const gate = createZavorthPublishApprovalGateFixture();

  it('exports the 272 boundary and allowed contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPublishApprovalGate/v1');
    expect(boundary).toContain('ZavorthNpmIdentityCheck/v1');
    expect(boundary).toContain('ZavorthPackagePublishDryRun/v1');
    expect(boundary).toContain('ZavorthPublishOrderPlan/v1');
    expect(boundary).toContain('ZavorthPublishTagRecommendation/v1');
    expect(index).toContain("from './ZavorthPublishApprovalGate.js'");
    expect(gate.normalization.packId).toBe('272');
    expect(gate.normalization.runtimeId).toBe(ZAVORTH_PUBLISH_APPROVAL_GATE_RUNTIME_ID);
    expect(gate.normalization.decision).toBe('zavorth-publish-ready-awaiting-operator-approval');
  });

  it('validates expected package names, versions, and bins', () => {
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
    expect(rootPackage.version).toBe('1.1.0-alpha.0');
    expect(rootPackage.bin).toEqual({
      zavorth: 'bin/zavorth.js',
      zavorth: 'bin/zavorth.js',
    });
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.version).toBe('1.1.0-alpha.0');
    expect(createPackage.bin).toEqual({
      'create-zavorth': 'bin/create-zavorth.js',
      'create-zavorth': 'bin/create-zavorth.js',
    });
  });

  it('records npm identity, package-name checks, order, and alpha tag', () => {
    expect(gate.normalization.npmIdentity).toEqual(expect.objectContaining({
      command: 'npm whoami',
      npmAuthenticated: true,
      operatorIdentity: 'greyvritra',
      loginState: 'authenticated',
      publishApprovalStillRequired: true,
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
      npmLoginAttempted: false,
    }));
    expect(gate.normalization.packageNameChecks).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        availability: 'available',
        registryResult: '404-not-found',
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        availability: 'available',
        registryResult: '404-not-found',
      }),
    ]);
    expect(gate.normalization.publishOrder.publishOrder).toEqual(['zavorth', 'create-zavorth']);
    expect(gate.normalization.publishTagRecommendation).toEqual(expect.objectContaining({
      publishTagRecommended: 'alpha',
      prereleaseVersionDetected: true,
      latestAllowed: false,
    }));
  });

  it('requires dry-run readiness and prepares publish commands without executing them', () => {
    expect(gate.normalization.rootPackagePublishDryRun).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      command: 'npm publish --dry-run --tag alpha --access public',
      dryRunPerformed: true,
      dryRunPassed: true,
      publishActuallyPerformed: false,
    }));
    expect(gate.normalization.createPackagePublishDryRun).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      command: 'npm publish --dry-run --tag alpha --access public',
      dryRunPerformed: true,
      dryRunPassed: true,
      publishActuallyPerformed: false,
    }));
    expect(gate.normalization.finalPublishCommands).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        workingDirectory: '.',
        command: 'npm publish --access public --tag alpha',
        preparedButNotExecuted: true,
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        workingDirectory: 'packages/create-zavorth',
        command: 'npm publish --access public --tag alpha',
        preparedButNotExecuted: true,
      }),
    ]);
    expect(gate.isReadyAwaitingOperatorApproval()).toBe(true);
  });

  it('keeps dangerous actions blocked and final approval required', () => {
    expect(gate.normalization.finalState).toEqual(expect.objectContaining({
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      globalInstallPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      runtimeBehaviorChanged: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
      publishApprovalStillRequired: true,
    }));
    expect(gate.blockedActionPerformed()).toBe(false);
  });

  it('documents the gate and updates handoff docs without source identity or bat UX', () => {
    const doc = read(DOC);
    const doc271 = read(DOC_271);
    const namingDecision = read(NAMING_DECISION);

    expect(doc).toContain('Status: `zavorth-publish-ready-awaiting-operator-approval`');
    expect(doc).toContain('operatorIdentity: `greyvritra`');
    expect(doc).toContain('npm view zavorth name version');
    expect(doc).toContain('npm publish --dry-run --tag alpha --access public');
    expect(doc).toContain('npm publish --access public --tag alpha');
    expect(doc).toContain('npmPublishActuallyPerformed=false');
    expect(doc).toContain('createPackagePublishActuallyPerformed=false');
    expect(doc).not.toMatch(/ExternalExecutor|external-executor/);
    expect(doc).not.toMatch(/\.bat\b/i);
    expect(doc271).toContain('272 publish approval note');
    expect(namingDecision).toContain('272 - Zavorth Publish Approval Gate');
    assertNoRawSecret(doc);
    assertNoRawSecret(doc271);
    assertNoRawSecret(namingDecision);
  });

  it('serializes without raw secrets or accidental publish state', () => {
    const serialized = JSON.stringify(gate.normalization);

    expect(serialized).not.toContain('npmPublishActuallyPerformed":true');
    expect(serialized).not.toContain('createPackagePublishActuallyPerformed":true');
    expect(serialized).not.toContain('rawSecretSerialized":true');
    expect(serialized).not.toContain('externalExecutorPublicIdentityReintroduced":true');
    assertNoRawSecret(serialized);
  });
});
