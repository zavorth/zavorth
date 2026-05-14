import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  createCreateZavorthPackageBridgePackFixture,
  createCreateZavorthPackageBridgeSource,
  normalizeCreateZavorthPackageBridgePack,
  CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  CreateZavorthPackageBridgeExpectedState,
  CreateZavorthPackageBridgeSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/264-create-zavorth-package-bridge-pack.md';
const DOC_263 = 'docs/263-post-absorption-publish-create-and-stability-gate.md';
const BOUNDARY = 'src/runtime/external-agents/CreateZavorthPackageBridgePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const ROOT_HELPER = 'bin/create-zavorth.js';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';
const CREATE_PACKAGE_BIN = 'packages/create-zavorth/bin/create-zavorth.js';
const CREATE_PACKAGE_README = 'packages/create-zavorth/README.md';

const PUBLIC_DOCS = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/34-zavorth-cli.md',
  'package.json',
];

const EXPECTED_STATES: CreateZavorthPackageBridgeExpectedState[] = [
  'npmCreateZavorth=package-bridge-ready',
  'createZavorthPackagePrepared=true',
  'createZavorthPublishActuallyPerformed=false',
  'npmPublishActuallyPerformed=false',
  'defaultRuntimeZavorthOwned=true',
  'publicExternalExecutorIdentityLeak=false',
  'batFilesNotProductPath=true',
  'rawSecretSerialized=false',
  'runtimePersistentStart=false',
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

function runNode(args: string[]): string {
  return execFileSync('node', args, { cwd: process.cwd(), encoding: 'utf8' });
}

describe('Create Zavorth package bridge pack', () => {
  let source: CreateZavorthPackageBridgeSource;
  let pack: ReturnType<typeof createCreateZavorthPackageBridgePackFixture>;

  beforeAll(() => {
    source = createCreateZavorthPackageBridgeSource();
    pack = createCreateZavorthPackageBridgePackFixture();
  });

  it('documents 264 as a package bridge rather than a vague future design', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `create-zavorth-package-bridge-ready`');
    expect(content).toContain('CreateZavorthPackageBridgePack.ts');
    expect(content).toContain('npmCreateZavorth=package-bridge-ready');
    expect(content).toContain('createZavorthPackagePrepared=true');
    expect(content).toContain('createZavorthPublishActuallyPerformed=false');
    expect(content).toContain('packages/create-zavorth/package.json');
    expect(content).toContain('npm publish --prefix packages/create-zavorth --access public');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    assertNoRawSecretOrContent(content);
  });

  it('exports the 264 boundary and creates a ready fixture', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('CreateZavorthPackageBridgePack/v1');
    expect(boundary).toContain('CreateZavorthPackageBridge/v1');
    expect(index).toContain("from './CreateZavorthPackageBridgePack.js'");
    expect(index).toContain('CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('create-zavorth-package-bridge-ready');
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('creates a minimal publishable create-zavorth package with the correct bin', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      bin: Record<string, string>;
    };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as {
      name: string;
      version: string;
      private: boolean;
      bin: Record<string, string>;
      files: string[];
    };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('./bin/zavorth.js');
    expect(rootPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0-alpha.0',
      private: false,
    }));
    expect(createPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createPackage.files).toEqual(['bin/', 'README.md', 'package.json']);
    expect(read(CREATE_PACKAGE_README)).toContain('npm create zavorth');
  });

  it('supports help and dry-run from both the root helper and the package bridge', () => {
    const rootHelp = runNode([ROOT_HELPER, '--help']);
    const rootDryRun = runNode([ROOT_HELPER, '--dry-run', '--json', 'root-sample']);
    const packageHelp = runNode([CREATE_PACKAGE_BIN, '--help']);
    const packageDryRun = runNode([CREATE_PACKAGE_BIN, '--dry-run', '--json', 'package-sample']);
    const rootPlan = JSON.parse(rootDryRun) as {
      mode: string;
      projectName: string;
      safety: Record<string, boolean>;
    };
    const packagePlan = JSON.parse(packageDryRun) as {
      mode: string;
      packageName: string;
      projectName: string;
      safety: Record<string, boolean>;
    };

    expect(rootHelp).toContain('create-zavorth');
    expect(packageHelp).toContain('npm create zavorth');
    expect(rootPlan.mode).toBe('dry-run');
    expect(rootPlan.projectName).toBe('root-sample');
    expect(packagePlan.mode).toBe('dry-run');
    expect(packagePlan.packageName).toBe('create-zavorth');
    expect(packagePlan.projectName).toBe('package-sample');
    [rootPlan.safety, packagePlan.safety].forEach((safety) => {
      expect(safety.secretsWritten).toBe(false);
      expect(safety.runtimeStarted).toBe(false);
      expect(safety.providerExecuted).toBe(false);
      expect(safety.toolCommandExecuted).toBe(false);
      expect(safety.messageSent).toBe(false);
      expect(safety.npmPublishActuallyPerformed).toBe(false);
    });
  });

  it('records the bridge as package-ready and publish-gated', () => {
    expect(pack.normalization.bridge).toEqual({
      nativeContract: 'CreateZavorthPackageBridge/v1',
      npmCreateZavorth: 'package-bridge-ready',
      createZavorthPackagePrepared: true,
      packageDirectory: 'packages/create-zavorth',
      packageName: 'create-zavorth',
      packageVersion: '1.1.0-alpha.0',
      packagePrivate: false,
      packageBinName: 'create-zavorth',
      packageBinEntrypoint: './bin/create-zavorth.js',
      rootHelperStillAvailable: './bin/create-zavorth.js',
      supportsHelp: true,
      supportsDryRun: true,
      writesSecrets: false,
      runtimePersistentStart: false,
      providerToolCommandExecuted: false,
      messageActuallySent: false,
      externalExecutorRequired: false,
      packageBridgePublishPlan: [
        'cd packages/create-zavorth && npm pack --dry-run',
        'node packages/create-zavorth/bin/create-zavorth.js --help',
        'node packages/create-zavorth/bin/create-zavorth.js --dry-run',
        'npm publish --prefix packages/create-zavorth --access public',
      ],
      rawSecretSerialized: false,
    });
    expect(pack.publishAllowed()).toBe(false);
  });

  it('updates the 263 doc from blocked create status to a package bridge follow-up', () => {
    const content = read(DOC_263);

    expect(content).toContain('Post-264 Create Package Bridge Follow-up');
    expect(content).toContain('docs/264-create-zavorth-package-bridge-pack.md');
    expect(content).toContain('npmCreateZavorth=package-bridge-ready');
    assertNoRawSecretOrContent(content);
  });

  it('keeps public docs clear that npm create needs the separate package publish', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\\.bat\\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      assertNoRawSecretOrContent(content);
    });

    expect(read('README.md')).toContain('packages/create-zavorth');
    expect(read('docs/02-quickstart.md')).toContain('packages/create-zavorth');
    expect(read('docs/34-zavorth-cli.md')).toContain('packages/create-zavorth');
  });

  it('keeps exact execution guarantees closed', () => {
    expect(pack.normalization.executionGate).toEqual({
      createZavorthPackageBridgePackCreated: true,
      npmCreateZavorth: 'package-bridge-ready',
      createZavorthPackagePrepared: true,
      createZavorthPublishActuallyPerformed: false,
      npmPublishActuallyPerformed: false,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      rawSecretSerialized: false,
      runtimePersistentStart: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      messageActuallySent: false,
      adapterRemovalGlobalAllowed: false,
    });
  });

  it('blocks publish, runtime, public identity, raw import, and adapter regressions', () => {
    const blockedCases: Array<keyof CreateZavorthPackageBridgeSource> = [
      'npmPublishAttempted',
      'createZavorthPublishAttempted',
      'globalInstallAttempted',
      'runtimePersistentStartAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'messageSendAttempted',
      'externalExecutorRequirementIntroduced',
      'docsPromoteBatFiles',
      'publicExternalExecutorIdentityExposed',
      'rawSqliteImportEnabled',
      'adapterGlobalRemovalAttempted',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeCreateZavorthPackageBridgePack({
        generatedAt: '2026-05-02T03:30:00.000Z',
        runtimeId: CREATE_ZAVORTH_PACKAGE_BRIDGE_PACK_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as CreateZavorthPackageBridgeSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.createZavorthPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.defaultRuntimeZavorthOwned).toBe(true);
      expect(normalization.executionGate.publicExternalExecutorIdentityLeak).toBe(false);
      expect(normalization.executionGate.batFilesNotProductPath).toBe(true);
      expect(normalization.executionGate.runtimePersistentStart).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps serialized output redacted and terminal at 264', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.terminalGate).toBe('do-not-advance-beyond-264-without-operator-decision');
    assertNoRawSecretOrContent(serialized);
  });
});
