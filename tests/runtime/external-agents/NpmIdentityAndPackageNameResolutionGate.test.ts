import fs from 'node:fs';
import path from 'node:path';

import {
  createNpmIdentityAndPackageNameResolutionGateFixture,
  createNpmIdentityAndPackageNameResolutionSource,
  NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  NpmIdentityAndPackageNameResolutionExpectedState,
  NpmPublishNamingStrategyDecision,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/266-npm-identity-and-package-name-resolution-gate.md';
const DOC_265 = 'docs/265-coordinated-npm-publish-approval-gate.md';
const BOUNDARY = 'src/runtime/external-agents/NpmIdentityAndPackageNameResolutionGate.ts';
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

const EXPECTED_STATES: NpmIdentityAndPackageNameResolutionExpectedState[] = [
  'npmPublishActuallyPerformed=false',
  'npmAuthTokenRead=false',
  'npmAuthTokenSerialized=false',
  'npmLoginAttempted=false',
  'npmIdentityState=not-authenticated',
  'rootPackageName=zavorth',
  'createPackageName=create-zavorth',
  'packageNameAvailability=taken',
  'createPackageNameAvailability=available',
  'publishNamingStrategy=operator-login-required',
  'finalOperatorApprovalRequired=true',
];

const ALLOWED_STRATEGIES: NpmPublishNamingStrategyDecision[] = [
  'publish-under-public-names',
  'publish-under-scope-required',
  'operator-login-required',
  'blocked-name-conflict',
];

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('raw user message body' + ' that must never migrate');
  expect(serialized).not.toContain('unredacted private message' + ' fixture');
}

describe('NPM identity and package-name resolution gate', () => {
  const pack = createNpmIdentityAndPackageNameResolutionGateFixture();

  it('documents the 266 diagnostic gate and keeps publish blocked', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `operator-login-required`');
    expect(content).toContain('NpmIdentityAndPackageNameResolutionGate.ts');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    expect(content).toContain('npm view zavorth name version');
    expect(content).toContain('npm view create-zavorth name version');
    expect(content).toContain('npm publish --access public --tag alpha');
    expect(content).toContain('npm pkg set name=@<scope>/zavorth');
    expect(content).toContain('npmPublishActuallyPerformed=false');
    assertNoRawSecretOrContent(content);
  });

  it('exports the 266 boundary and exposes expected contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('NpmIdentityAndPackageNameResolutionGate/v1');
    expect(boundary).toContain('NpmIdentityCheck/v1');
    expect(boundary).toContain('NpmPackageNameAvailability/v1');
    expect(boundary).toContain('NpmMaintainerRightsCheck/v1');
    expect(boundary).toContain('NpmPublishNamingStrategy/v1');
    expect(boundary).toContain('NpmPublishOperatorAction/v1');
    expect(index).toContain("from './NpmIdentityAndPackageNameResolutionGate.js'");
    expect(index).toContain('NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID');
    expect(pack.normalization.runtimeId).toBe(NPM_IDENTITY_AND_PACKAGE_NAME_RESOLUTION_GATE_RUNTIME_ID);
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('keeps package names evaluated separately with coherent versions', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; version: string };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; version: string };

    expect(rootPackage.name).toBe('zavorth');
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.version).toBe(rootPackage.version);
    expect(pack.normalization.rootPackageNameAvailability.packageName).toBe('zavorth');
    expect(pack.normalization.createPackageNameAvailability.packageName).toBe('create-zavorth');
    expect(pack.normalization.rootPackageNameAvailability.packageNameAvailability).toBe('taken');
    expect(pack.normalization.createPackageNameAvailability.packageNameAvailability).toBe('available');
    expect(pack.normalization.rootPackageNameAvailability.registryVersion).toBe('0.3.9');
    expect(pack.normalization.createPackageNameAvailability.registryVersion).toBeNull();
  });

  it('records unauthenticated npm identity without reading or serializing tokens', () => {
    expect(pack.normalization.npmIdentityCheck).toEqual({
      nativeContract: 'NpmIdentityCheck/v1',
      npmWhoamiChecked: true,
      npmIdentityState: 'not-authenticated',
      npmIdentityAvailable: false,
      npmWhoamiResult: 'ENEEDAUTH',
      operatorActionRequired: 'npm-login',
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
      npmLoginAttempted: false,
      npmPublishActuallyPerformed: false,
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
      maintainerEmailCopiedIntoPublicDocs: false,
      receiptsRedacted: true,
    });
  });

  it('does not confirm maintainer rights while npm is unauthenticated', () => {
    expect(pack.normalization.rootPackageNameAvailability.maintainerRightsCheck).toEqual({
      nativeContract: 'NpmMaintainerRightsCheck/v1',
      packageName: 'zavorth',
      maintainerRights: 'unknown',
      checkedBy: 'not-authenticated-cannot-confirm',
      reason: 'npm whoami returned ENEEDAUTH, so maintainer rights cannot be confirmed safely in this gate.',
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
    });
    expect(pack.normalization.createPackageNameAvailability.maintainerRightsCheck).toEqual({
      nativeContract: 'NpmMaintainerRightsCheck/v1',
      packageName: 'create-zavorth',
      maintainerRights: 'unknown',
      checkedBy: 'package-not-found',
      reason: 'Package name was not found by npm view; first publish still requires authenticated operator approval.',
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
    });
  });

  it('selects only an allowed naming strategy and requires operator login now', () => {
    const strategy = pack.normalization.publishNamingStrategy;

    expect(ALLOWED_STRATEGIES).toContain(strategy.publishNamingStrategy);
    expect(strategy.publishNamingStrategy).toBe('operator-login-required');
    expect(strategy.publishUnderPublicNamesAllowed).toBe(false);
    expect(strategy.scopedPackageNameChangeApplied).toBe(false);
    expect(strategy.publicNameCommandsPreparedButNotExecuted).toEqual([
      'npm publish --access public --tag alpha',
      'cd packages/create-zavorth && npm publish --access public --tag alpha',
    ]);
    expect(strategy.scopedNameCommandTemplatesPreparedButNotExecuted).toContain('npm pkg set name=@<scope>/zavorth');
    expect(strategy.reasons).toContain('npm whoami returned ENEEDAUTH; operator must run npm login before rights can be confirmed.');
    expect(strategy.npmPublishActuallyPerformed).toBe(false);
  });

  it('does not authorize direct public-name publish when zavorth is taken without confirmed rights', () => {
    const authenticatedWithoutRights = createNpmIdentityAndPackageNameResolutionGateFixture({
      npmIdentityState: 'authenticated',
      npmWhoamiResult: 'authenticated-redacted',
      rootPackageNameAvailability: 'taken',
      rootMaintainerRights: 'unknown',
      createPackageNameAvailability: 'available',
    });

    expect(authenticatedWithoutRights.normalization.publishNamingStrategy.publishNamingStrategy).toBe('publish-under-scope-required');
    expect(authenticatedWithoutRights.normalization.publishNamingStrategy.publishUnderPublicNamesAllowed).toBe(false);
    expect(authenticatedWithoutRights.publishAllowed()).toBe(false);
  });

  it('lists manual operator actions but performs none of them', () => {
    expect(pack.normalization.operatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nativeContract: 'NpmPublishOperatorAction/v1',
        actionId: 'npm-login',
        required: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'confirm-maintainer-rights',
        required: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'choose-npm-scope',
        required: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'approve-final-publish',
        required: true,
        performedByGate: false,
      }),
    ]));
  });

  it('keeps all execution and auth mutation gates closed', () => {
    expect(pack.normalization.executionGate).toEqual({
      npmIdentityAndPackageNameResolutionGateCreated: true,
      npmPublishActuallyPerformed: false,
      createZavorthPublishActuallyPerformed: false,
      npmAuthTokenRead: false,
      npmAuthTokenSerialized: false,
      npmLoginAttempted: false,
      finalOperatorApprovalRequired: true,
      packageNameChanged: false,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      rawImportDefaultDisabled: true,
      limitedProductionSendStillGated: true,
      adapterRemovalGlobalAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
    });
    expect(pack.publishAllowed()).toBe(false);
  });

  it('blocks prohibited publish, auth, naming, runtime, migration, and execution regressions', () => {
    const blockedCases: Array<keyof ReturnType<typeof createNpmIdentityAndPackageNameResolutionSource>> = [
      'npmPublishAttempted',
      'createZavorthPublishAttempted',
      'npmAuthTokenRead',
      'npmAuthTokenSerialized',
      'npmLoginAttempted',
      'packageNameChanged',
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
      const regression = createNpmIdentityAndPackageNameResolutionGateFixture({ [key]: true });
      expect(regression.normalization.publishNamingStrategy.publishNamingStrategy).toBe('blocked-name-conflict');
      expect(regression.publishAllowed()).toBe(false);
      assertNoRawSecretOrContent(JSON.stringify(regression.normalization));
    });
  });

  it('updates 265 from package readiness blocker to identity/name resolution blocker', () => {
    const doc265 = read(DOC_265);

    expect(doc265).toContain('docs/266-npm-identity-and-package-name-resolution-gate.md');
    expect(doc265).toContain('npm identity/name resolution');
    expect(doc265).toContain('package dry-run readiness remains green');
    assertNoRawSecretOrContent(doc265);
  });

  it('keeps public surfaces free of source identity and local launcher promotion', () => {
    PUBLIC_SURFACES.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\\.bat\\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      assertNoRawSecretOrContent(content);
    });
  });

  it('serializes without raw secrets or auth tokens', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(serialized).toContain('operator-login-required');
    expect(serialized).toContain('npmAuthTokenRead');
    expect(serialized).not.toContain('_authToken');
    expect(serialized).not.toContain('//registry.npmjs.org/:_authToken');
    assertNoRawSecretOrContent(serialized);
  });
});
