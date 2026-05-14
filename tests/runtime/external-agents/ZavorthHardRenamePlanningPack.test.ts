import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_HARD_RENAME_PLANNING_PACK_RUNTIME_ID,
  createZavorthHardRenamePlanningPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/286-zavorth-hard-rename-planning-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthHardRenamePlanningPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain(['_auth', 'Token'].join(''));
}

describe('Zavorth hard rename planning pack', () => {
  const pack = createZavorthHardRenamePlanningPackFixture();

  it('exports the pack 286 boundary and expected state', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthHardRenamePlanningPack/v1');
    expect(boundary).toContain('ZavorthHardRenameAffectedSurface/v1');
    expect(boundary).toContain('ZavorthHardRenameExecutionStep/v1');
    expect(index).toContain("from './ZavorthHardRenamePlanningPack.js'");
    expect(pack.normalization.packId).toBe('286');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_HARD_RENAME_PLANNING_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-hard-rename-plan-ready');
  });

  it('plans a hard rename to Zavorth with no Zavorth alias or codename retention', () => {
    expect(pack.normalization.currentPublicIdentity).toBe('Zavorth');
    expect(pack.normalization.targetPublicIdentity).toBe('Zavorth');
    expect(pack.normalization.currentPackageName).toBe('zavorth');
    expect(pack.normalization.targetPackageName).toBe('zavorth');
    expect(pack.normalization.currentCreatePackageName).toBe('create-zavorth');
    expect(pack.normalization.targetCreatePackageName).toBe('create-zavorth');
    expect(pack.normalization.currentCliBin).toBe('zavorth');
    expect(pack.normalization.targetCliBin).toBe('zavorth');
    expect(pack.normalization.legacyAliasPolicy).toBe('no-public-alias');
    expect(pack.normalization.zavorthCodenameRetained).toBe(false);
    expect(pack.normalization.zavorthPublicCompatibilityPlanned).toBe(false);
    expect(pack.plansZavorthAlias()).toBe(false);
  });

  it('records GitHub reservation and pending npm reservation', () => {
    expect(pack.normalization.githubReservationObserved).toBe(true);
    expect(pack.normalization.githubReservationSource).toBe('operator-reported-manual-reservation');
    expect(pack.normalization.githubOrgUrl).toBe('https://github.com/zavorth');
    expect(pack.normalization.npmReservationRequired).toBe(true);
  });

  it('does not execute rename, package, bin, installer or publish changes', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('bin/zavorth.js');
    expect(rootPackage.bin.zavorth).toBeUndefined();
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBeUndefined();
    expect(fs.existsSync(path.join(process.cwd(), 'bin/zavorth.js'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'packages/create-zavorth'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.ps1'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.sh'))).toBe(false);
    expect(pack.renamePerformed()).toBe(false);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      zavorthRenamePerformed: false,
      packageNameChanged: false,
      binChanged: false,
      installerChanged: false,
      npmPublishPerformed: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    }));
  });

  it('maps every required impact surface', () => {
    expect(pack.normalization.affectedSurfaces.map((surface) => surface.category)).toEqual([
      'package-distribution',
      'cli',
      'create-package',
      'installer',
      'runtime-contracts-services',
      'docs',
      'tests',
      'generated-build-artifacts',
      'out-of-scope-historical',
    ]);
    pack.normalization.affectedSurfaces.forEach((surface) => {
      expect(surface.noLegacyAlias).toBe(true);
      expect(surface.actionForImplementation).toBeTruthy();
    });
  });

  it('uses the requested future execution order', () => {
    expect(pack.normalization.executionOrder.map((step) => step.step)).toEqual([
      'reserve-npm-or-publish-direct',
      'rename-package-metadata',
      'rename-bins',
      'rename-create-package',
      'rename-installer',
      'rename-cli-outputs',
      'rename-public-classes-files',
      'clean-build-artifacts',
      'build',
      'public-identity-scan',
      'install-smoke-local',
      'new-publish-gate',
    ]);
    pack.normalization.executionOrder.forEach((step) => {
      expect(step.mustNotKeepZavorthAlias).toBe(true);
    });
  });

  it('blocks all real changes in this planning pack', () => {
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'rename-files', performed: false }),
      expect.objectContaining({ action: 'change-package-json-name', performed: false }),
      expect.objectContaining({ action: 'create-zavorth-bin', performed: false }),
      expect.objectContaining({ action: 'remove-current-bin', performed: false }),
      expect.objectContaining({ action: 'change-installer', performed: false }),
      expect.objectContaining({ action: 'publish-npm', performed: false }),
      expect.objectContaining({ action: 'create-create-zavorth-package', performed: false }),
      expect.objectContaining({ action: 'start-runtime', performed: false }),
      expect.objectContaining({ action: 'execute-provider-tool-command-message', performed: false }),
    ]));
  });

  it('documents the plan and keeps Zavorth as plan only while Zavorth remains active', () => {
    const doc = read(DOC);
    const namingDecision = read(NAMING_DECISION);
    const serialized = JSON.stringify(pack.normalization);

    expect(doc).toContain('286 - Zavorth Hard Rename Planning Pack');
    expect(doc).toContain('legacyAliasPolicy="no-public-alias"');
    expect(doc).toContain('zavorthCodenameRetained=false');
    expect(doc).toContain('zavorthPublicCompatibilityPlanned=false');
    expect(doc).toContain('zavorthRenamePerformed=false');
    expect(doc).toContain('packageNameChanged=false');
    expect(doc).toContain('npmPublishPerformed=false');
    expect(doc).toContain('Zavorth continua identidade ativa neste estado do repo');
    expect(namingDecision).toContain('Zavorth is now planned as a hard rename target');
    expect(namingDecision).toContain('Zavorth remains the active');
    assertNoRawSecret(`${doc}\n${namingDecision}\n${serialized}`);
  });
});
