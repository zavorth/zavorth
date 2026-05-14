import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID,
  createZavorthRenamePlanningPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthRenameExpectedState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/269-zavorth-rename-planning-pack.md';
const DOC_268 = 'docs/268-zavorth-naming-reservation-gate.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthRenamePlanningPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const EXPECTED_STATES: ZavorthRenameExpectedState[] = [
  'decision=zavorth-rename-plan-ready',
  'renameReady=true',
  'implementationAllowed=false',
  'manualReservationRequired=true',
  'legalClearanceRequired=true',
  'compatibilityRequired=true',
  'createPackageRenamed=false',
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
  expect(serialized).not.toContain('_authToken');
  expect(serialized).not.toContain('raw user message body' + ' that must never migrate');
}

describe('Zavorth rename planning pack', () => {
  const pack = createZavorthRenamePlanningPackFixture();

  it('documents the 269 planning pack without executing rename', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `zavorth-rename-plan-ready`');
    expect(content).toContain('ZavorthRenamePlanningPack.ts');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    expect(content).toContain('Produto novo: Zavorth');
    expect(content).toContain('CLI desejado: `zavorth`');
    expect(content).toContain('packageJsonRenamed=false');
    expect(content).toContain('npmPublishActuallyPerformed=false');
    expect(content).toContain('externalExecutorPublicIdentityReintroduced=false');
    assertNoRawSecretOrContent(content);
  });

  it('exports the 269 boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthRenamePlanningPack/v1');
    expect(boundary).toContain('ZavorthAffectedFileInventoryItem/v1');
    expect(boundary).toContain('ZavorthCompatibilityStrategyItem/v1');
    expect(boundary).toContain('ZavorthFuturePackPlanItem/v1');
    expect(boundary).toContain('ZavorthRenameRisk/v1');
    expect(boundary).toContain('ZavorthRenameBlockedAction/v1');
    expect(index).toContain("from './ZavorthRenamePlanningPack.js'");
    expect(index).toContain('ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_RENAME_PLANNING_PACK_RUNTIME_ID);
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('keeps actual package and create package names unchanged', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.name).not.toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('./bin/zavorth.js');
    expect(rootPackage.bin.zavorth).toBeUndefined();
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.name).not.toBe('create-zavorth');
    expect(createPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBeUndefined();
  });

  it('records the future Zavorth identity and current Zavorth identity', () => {
    expect(pack.normalization.packId).toBe('269');
    expect(pack.normalization.decision).toBe('zavorth-rename-plan-ready');
    expect(pack.normalization.productNameBefore).toBe('Zavorth');
    expect(pack.normalization.productNameAfter).toBe('Zavorth');
    expect(pack.normalization.cliNameBefore).toBe('zavorth');
    expect(pack.normalization.cliNameAfter).toBe('zavorth');
    expect(pack.normalization.packageNameBefore).toBe('zavorth');
    expect(pack.normalization.packageNameAfter).toBe('zavorth');
    expect(pack.normalization.createPackageBefore).toBe('create-zavorth');
    expect(pack.normalization.createPackageAfter).toBe('create-zavorth');
    expect(pack.normalization.desiredCommands).toEqual([
      'npm create zavorth',
      'npx zavorth setup',
      'zavorth setup',
      'zavorth go',
      'zavorth doctor',
    ]);
  });

  it('chooses internal codename retained for Zavorth', () => {
    expect(pack.normalization.zavorthLegacyPolicy).toBe('internal-codename-retained');
    expect(pack.normalization.compatibilityStrategy).toEqual(expect.arrayContaining([
      expect.objectContaining({
        legacySurface: 'zavorth CLI bin',
        futureSurface: 'zavorth CLI bin',
        compatibilityPolicy: 'deprecate-with-message',
      }),
      expect.objectContaining({
        legacySurface: 'create-zavorth package/bin',
        futureSurface: 'create-zavorth package/bin',
        compatibilityPolicy: 'preserve-as-alias',
      }),
      expect.objectContaining({
        legacySurface: 'npm run setup/go/doctor',
        compatibilityPolicy: 'keep-repo-local',
      }),
    ]));
  });

  it('inventories package, bin, docs, runtime, and tests', () => {
    const paths = pack.normalization.affectedFileInventory.map((item) => item.path);

    expect(paths).toEqual(expect.arrayContaining([
      'package.json',
      'package-lock.json',
      'bin/zavorth.js',
      'bin/zavorth.js',
      'bin/create-zavorth.js',
      'bin/create-zavorth.js',
      'packages/create-zavorth/package.json',
      'packages/create-zavorth/package.json',
      'README.md',
      'docs/02-quickstart.md',
      'docs/09-operations.md',
      'docs/10-troubleshooting.md',
      'docs/34-zavorth-cli.md',
      'src/zavorth-cli.ts',
      'src/zavorth-cli.ts',
      'src/runtime/external-agents/*',
      'tests/runtime/external-agents/*',
      'tests/docs/CommandCenterProductDocs.test.ts',
      'tests/cli/*',
      'tests/services/*',
    ]));
    expect(pack.normalization.affectedFileInventory.some((item) => item.category === 'package-distribution')).toBe(true);
    expect(pack.normalization.affectedFileInventory.some((item) => item.category === 'docs-public-surface')).toBe(true);
    expect(pack.normalization.affectedFileInventory.some((item) => item.category === 'runtime-tests')).toBe(true);
  });

  it('plans 270, 271, and 272 without allowing execution now', () => {
    expect(pack.normalization.futurePackPlan).toEqual([
      expect.objectContaining({
        packId: '270',
        title: 'Zavorth Rename Implementation Pack',
        executionAllowedNow: false,
      }),
      expect.objectContaining({
        packId: '271',
        title: 'Zavorth Install Smoke Pack',
        executionAllowedNow: false,
      }),
      expect.objectContaining({
        packId: '272',
        title: 'Zavorth Publish Approval Gate',
        executionAllowedNow: false,
      }),
    ]);
  });

  it('keeps all real rename, publish, reservation, and runtime actions blocked', () => {
    expect(pack.normalization.finalState).toEqual({
      decision: 'zavorth-rename-plan-ready',
      renameReady: true,
      implementationAllowed: false,
      manualReservationRequired: true,
      legalClearanceRequired: true,
      compatibilityRequired: true,
      packageJsonRenamed: false,
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      runtimeBehaviorChanged: false,
      cliBinChanged: false,
      createPackageRenamed: false,
      githubOrgCreated: false,
      domainPurchased: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    });
    expect(pack.implementationAllowed()).toBe(false);
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionId: 'rename-package-json', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'change-bin', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'rename-create-package', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'publish-npm', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'purchase-domain', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'create-github-org', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'file-trademark', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'remove-aliases', blocked: true, performedByPack: false }),
      expect.objectContaining({ actionId: 'runtime-behavior-change', blocked: true, performedByPack: false }),
    ]));
  });

  it('records manual reservation and legal/domain/GitHub/npm requirements', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(serialized).toContain('manualReservationRequired');
    expect(serialized).toContain('legalClearanceRequired');
    expect(serialized).toContain('domain-legal-unreserved');
    expect(serialized).toContain('publish-before-reservation');
    expect(serialized).toContain('Manual domain reservation and legal clearance must precede publish approval.');
    expect(serialized).toContain('272 must re-check npm names and require explicit operator approval before publish.');
  });

  it('updates docs 268 and naming decision with the 269 planning state', () => {
    const doc268 = read(DOC_268);
    const namingDecision = read(NAMING_DECISION);

    expect(doc268).toContain('Post-269 planning note');
    expect(doc268).toContain('internal-codename-retained');
    expect(namingDecision).toContain('269 - Zavorth Rename Planning Pack');
    expect(namingDecision).toContain('zavorth-rename-plan-ready');
    assertNoRawSecretOrContent(doc268);
    assertNoRawSecretOrContent(namingDecision);
  });

  it('serializes without raw secrets or source runtime identity reintroduction', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(serialized).toContain('Zavorth');
    expect(serialized).toContain('Zavorth');
    expect(serialized).not.toContain('externalExecutorPublicIdentityReintroduced":true');
    expect(serialized).not.toContain('npmPublishActuallyPerformed":true');
    expect(serialized).not.toContain('packageJsonRenamed":true');
    assertNoRawSecretOrContent(serialized);
  });
});
