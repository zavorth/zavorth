import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NAMING_RESERVATION_GATE_RUNTIME_ID,
  createZavorthNamingReservationGateFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/285-zavorth-naming-reservation-gate.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNamingReservationGate.ts';
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

describe('Zavorth naming reservation gate', () => {
  const pack = createZavorthNamingReservationGateFixture();

  it('exports the pack 285 boundary and contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNamingReservationGate/v1');
    expect(boundary).toContain('ZavorthNpmFinding/v1');
    expect(boundary).toContain('ZavorthGithubFinding/v1');
    expect(boundary).toContain('ZavorthDomainFinding/v1');
    expect(boundary).toContain('ZavorthTrademarkFinding/v1');
    expect(index).toContain("from './ZavorthNamingReservationGate.js'");
    expect(pack.normalization.packId).toBe('285');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_NAMING_RESERVATION_GATE_RUNTIME_ID);
  });

  it('records Zavorth as candidate while Zavorth stays active', () => {
    expect(pack.normalization.activeProductName).toBe('Zavorth');
    expect(pack.normalization.candidateName).toBe('Zavorth');
    expect(pack.normalization.candidatePackageName).toBe('zavorth');
    expect(pack.normalization.candidateCreatePackageName).toBe('create-zavorth');
    expect(pack.normalization.pronunciation).toBe('za-vorth');
    expect(pack.normalization.decision).toBe('zavorth-ready-for-manual-reservation');
    expect(pack.normalization.finalState.publicIdentityChanged).toBe(false);
  });

  it('keeps package names, bins, create package and installers unchanged', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.name).not.toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('bin/zavorth.js');
    expect(rootPackage.bin.zavorth).toBeUndefined();
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.name).not.toBe('create-zavorth');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBeUndefined();
    expect(fs.existsSync(path.join(process.cwd(), 'packages/create-zavorth'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'bin/zavorth.js'))).toBe(false);
  });

  it('records npm and GitHub availability without performing reservations', () => {
    expect(pack.normalization.npmPackageAvailable).toBe(true);
    expect(pack.normalization.npmCreatePackageAvailable).toBe(true);
    expect(pack.normalization.npmFindings).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        viewCommand: 'npm view zavorth name version',
        viewResult: '404-not-found',
        exactMatchFound: false,
        availability: 'available',
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        viewCommand: 'npm view create-zavorth name version',
        viewResult: '404-not-found',
        exactMatchFound: false,
        availability: 'available',
      }),
    ]);
    expect(pack.normalization.githubOrgOrUserAvailable).toBe(true);
    expect(pack.normalization.githubGreyvritraRepoAvailable).toBe(true);
    expect(pack.normalization.githubFindings.strongSoftwareConflictFound).toBe(false);
    expect(pack.normalization.finalState.githubReservationPerformed).toBe(false);
  });

  it('keeps registrar and legal clearance mandatory', () => {
    expect(pack.normalization.domainRegistrarCheckRequired).toBe(true);
    expect(pack.normalization.legalClearanceRequired).toBe(true);
    expect(pack.normalization.domainFindings).toHaveLength(8);
    pack.normalization.domainFindings.forEach((finding) => {
      expect(finding.registrarCheckRequired).toBe(true);
      expect(finding.note).toBe('dns-empty-is-not-availability-proof');
      expect(finding.activeProductConflictFound).toBe(false);
    });
    expect(pack.normalization.trademarkFindings).toEqual(expect.objectContaining({
      searchedSources: ['USPTO', 'WIPO', 'EUIPO', 'INPI Brasil'],
      trademarkSearchPerformed: true,
      exactZavorthConflictFound: false,
      legalClearanceRequired: true,
      disclaimer: 'not legal advice; official/legal clearance still required',
    }));
  });

  it('records web and registry checks without strong product conflicts', () => {
    expect(pack.normalization.webFindings.strongAiSoftwareSecurityDevtoolConflictFound).toBe(false);
    expect(pack.normalization.webFindings.conflictRisk).toBe('low');
    expect(pack.normalization.registryFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ registry: 'PyPI', exactMatchFound: false }),
      expect.objectContaining({ registry: 'Crates.io', exactMatchFound: false }),
      expect.objectContaining({ registry: 'RubyGems', exactMatchFound: false }),
      expect.objectContaining({ registry: 'Docker Hub', exactMatchFound: false }),
      expect.objectContaining({ registry: 'Homebrew', exactMatchFound: false }),
      expect.objectContaining({ registry: 'VS Code Marketplace', exactMatchFound: false }),
      expect.objectContaining({ registry: 'JetBrains Marketplace', exactMatchFound: false }),
    ]));
  });

  it('blocks publish, rename, domain, GitHub and dangerous runtime actions', () => {
    expect(pack.renameAllowed()).toBe(false);
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.manualReservationRequired()).toBe(true);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      renamePerformed: false,
      npmPublishPerformed: false,
      domainPurchasePerformed: false,
      githubReservationPerformed: false,
      packageNameChanged: false,
      installerChanged: false,
      versionOrDistTagChanged: false,
      runtimePersistentStartPerformed: false,
      providerToolCommandMessageExecuted: false,
      rawHistoryImported: false,
      globalAdapterRemoved: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionId: 'publish-npm', performed: false }),
      expect.objectContaining({ actionId: 'change-package-name', performed: false }),
      expect.objectContaining({ actionId: 'change-cli-bin', performed: false }),
      expect.objectContaining({ actionId: 'change-installer', performed: false }),
      expect.objectContaining({ actionId: 'create-github-org-or-repo', performed: false }),
      expect.objectContaining({ actionId: 'buy-domain', performed: false }),
      expect.objectContaining({ actionId: 'file-trademark', performed: false }),
    ]));
  });

  it('documents the gate, prior rejected names, commands, sources and no-op guarantees', () => {
    const doc = read(DOC);
    const namingDecision = read(NAMING_DECISION);
    const serialized = JSON.stringify(pack.normalization);

    expect(doc).toContain('285 - Zavorth Naming Reservation Gate');
    expect(doc).toContain('Decisao: `zavorth-ready-for-manual-reservation`');
    expect(doc).toContain('Kyron/Cyron');
    expect(doc).toContain('Nexor');
    expect(doc).toContain('Warden');
    expect(doc).toContain('Kitsune/Vulpix/VULP');
    expect(doc).toContain('Zenor/Zentro/Vyrion/Maverix');
    expect(doc).toContain('npm view zavorth name version');
    expect(doc).toContain('https://github.com/zavorth');
    expect(doc).toContain('registrarCheckRequired=true');
    expect(doc).toContain('legalClearanceRequired=true');
    expect(doc).toContain('npmPublishPerformed=false');
    expect(namingDecision).toContain('Zavorth is recorded as a future naming candidate only');
    expect(namingDecision).toContain('Zavorth remains the public');
    assertNoRawSecret(`${doc}\n${namingDecision}\n${serialized}`);
  });
});
