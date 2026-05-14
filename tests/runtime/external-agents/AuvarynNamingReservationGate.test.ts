import fs from 'node:fs';
import path from 'node:path';

import {
  AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID,
  createAuvarynNamingReservationGateFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  AuvarynNamingExpectedState,
  NamingReservationDecisionState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/267-auvaryn-naming-reservation-gate.md';
const BOUNDARY = 'src/runtime/external-agents/AuvarynNamingReservationGate.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const DOC_266 = 'docs/266-npm-identity-and-package-name-resolution-gate.md';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const EXPECTED_STATES: AuvarynNamingExpectedState[] = [
  'currentProductName=Zavorth',
  'candidateProductName=Auvaryn',
  'productRenameActuallyPerformed=false',
  'packageRenameActuallyPerformed=false',
  'npmPublishActuallyPerformed=false',
  'domainPurchaseActuallyPerformed=false',
  'githubOrgCreated=false',
  'trademarkFiled=false',
  'finalOperatorApprovalRequired=true',
];

const ALLOWED_DECISIONS: NamingReservationDecisionState[] = [
  'auvaryn-approved-for-rename-planning',
  'auvaryn-needs-manual-reservation',
  'auvaryn-blocked',
  'auvaryn-unknown',
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

describe('Auvaryn naming reservation gate', () => {
  const pack = createAuvarynNamingReservationGateFixture();

  it('documents 267 as a reservation decision gate without rename', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `auvaryn-needs-manual-reservation`');
    expect(content).toContain('AuvarynNamingReservationGate.ts');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    expect(content).toContain('npmAuvarynAvailability=available');
    expect(content).toContain('npmCreateAuvarynAvailability=available');
    expect(content).toContain('githubOrgOrUserAvailability=available');
    expect(content).toContain('registrarCheckRequired');
    expect(content).toContain('dns-empty-is-not-availability-proof');
    expect(content).toContain('not legal advice; official/legal clearance still required');
    expect(content).toContain('268-auvaryn-product-rename-planning-pack');
    assertNoRawSecretOrContent(content);
  });

  it('exports the 267 boundary and required contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('AuvarynNamingReservationGate/v1');
    expect(boundary).toContain('NamingCandidateAvailability/v1');
    expect(boundary).toContain('NamingNpmAvailability/v1');
    expect(boundary).toContain('NamingGithubAvailability/v1');
    expect(boundary).toContain('NamingDomainAvailability/v1');
    expect(boundary).toContain('NamingTrademarkRisk/v1');
    expect(boundary).toContain('NamingReservationDecision/v1');
    expect(boundary).toContain('NamingManualAction/v1');
    expect(index).toContain("from './AuvarynNamingReservationGate.js'");
    expect(index).toContain('AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID');
    expect(pack.normalization.runtimeId).toBe(AUVARYN_NAMING_RESERVATION_GATE_RUNTIME_ID);
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('does not rename Zavorth or package names', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('./bin/zavorth.js');
    expect(rootPackage.name).not.toBe('auvaryn');
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createPackage.name).not.toBe('create-auvaryn');
    expect(pack.normalization.executionGate.productRenameActuallyPerformed).toBe(false);
    expect(pack.normalization.executionGate.packageRenameActuallyPerformed).toBe(false);
    expect(pack.renameAllowed()).toBe(false);
  });

  it('evaluates npm and GitHub separately', () => {
    expect(pack.normalization.npmAvailability).toEqual([
      expect.objectContaining({
        nativeContract: 'NamingNpmAvailability/v1',
        packageName: 'auvaryn',
        availability: 'available',
        exactNpmSearchMatches: 0,
        npmViewResult: '404-not-found',
      }),
      expect.objectContaining({
        nativeContract: 'NamingNpmAvailability/v1',
        packageName: 'create-auvaryn',
        availability: 'available',
        exactNpmSearchMatches: 0,
        npmViewResult: '404-not-found',
      }),
    ]);
    expect(pack.normalization.githubAvailability).toEqual(expect.objectContaining({
      nativeContract: 'NamingGithubAvailability/v1',
      githubOrgOrUserAvailability: 'available',
      githubGreyvritraRepoAvailability: 'available',
      repositorySearchResults: 0,
      userSearchResults: 0,
      githubOrgCreated: false,
      githubRepoCreated: false,
    }));
  });

  it('uses careful domain language and never buys a domain', () => {
    const domain = pack.normalization.domainAvailability;

    expect(domain.nativeContract).toBe('NamingDomainAvailability/v1');
    expect(domain.registrarCheckRequired).toBe(true);
    expect(domain.domainPurchaseActuallyPerformed).toBe(false);
    expect(domain.primaryDomains).toHaveLength(4);
    expect(domain.secondaryDomains).toHaveLength(5);
    [...domain.primaryDomains, ...domain.secondaryDomains].forEach((entry) => {
      expect(entry.note).toBe('dns-empty-is-not-availability-proof');
      expect(entry.dnsState).toBe('noActiveDnsFound');
    });
    expect(domain.domainConflicts).toContain('auvaryn.com appears in a January 2026 newly registered domain list; registrar confirmation required.');
  });

  it('records trademark risk with disclaimer and no filing', () => {
    expect(pack.normalization.trademarkRisk).toEqual({
      nativeContract: 'NamingTrademarkRisk/v1',
      trademarkSearchPerformed: true,
      searchedTerms: ['Auvaryn', 'AUVARYN'],
      trademarkRisk: 'medium',
      notableTrademarkSignals: [
        'No exact AUVARYN conflict was found in public web searches used by this gate.',
        'Similar AURVYN trademark signal exists outside software; official clearance still required.',
      ],
      trademarkDisclaimer: 'not legal advice; official/legal clearance still required',
      trademarkFiled: false,
    });
  });

  it('chooses an allowed decision and recommends planning, not immediate rename', () => {
    const decision = pack.normalization.decision;

    expect(ALLOWED_DECISIONS).toContain(decision.decision);
    expect(decision.decision).toBe('auvaryn-needs-manual-reservation');
    expect(decision.nextRecommendedPack).toBe('268-auvaryn-product-rename-planning-pack');
    expect(decision.productRenameActuallyPerformed).toBe(false);
    expect(decision.packageRenameActuallyPerformed).toBe(false);
    expect(decision.npmPublishActuallyPerformed).toBe(false);
    expect(decision.finalOperatorApprovalRequired).toBe(true);
    expect(decision.rationale.join('\n')).toContain('Avaryn');
  });

  it('lists manual reservations and clearance actions only', () => {
    expect(pack.normalization.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionId: 'review-avaryn-adjacent-conflict',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'create-github-org-or-repo',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'decide-domain-reservation',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'decide-npm-placeholder',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'confirm-trademark-clearance',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
    ]));
  });

  it('keeps all prohibited action flags false', () => {
    expect(pack.normalization.executionGate).toEqual({
      auvarynNamingReservationGateCreated: true,
      currentProductName: 'Zavorth',
      candidateProductName: 'Auvaryn',
      productRenameActuallyPerformed: false,
      packageRenameActuallyPerformed: false,
      npmPublishActuallyPerformed: false,
      domainPurchaseActuallyPerformed: false,
      githubOrgCreated: false,
      trademarkFiled: false,
      finalOperatorApprovalRequired: true,
      packageJsonRenamedToAuvaryn: false,
      cliRenamedToAuvaryn: false,
      npmLoginAttempted: false,
      credentialsSaved: false,
      rawSecretSerialized: false,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawSqliteImportEnabled: false,
      adapterRemovalGlobalAllowed: false,
    });
  });

  it('blocks prohibited rename, publish, reservation, credential, runtime, and migration regressions', () => {
    const prohibited = [
      'productRenameAttempted',
      'packageRenameAttempted',
      'npmPublishAttempted',
      'domainPurchaseAttempted',
      'githubOrgCreateAttempted',
      'trademarkFiledAttempted',
      'npmLoginAttempted',
      'credentialsSaved',
      'publicExternalExecutorIdentityExposed',
      'docsPromoteBatFiles',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'rawSqliteImportEnabled',
      'adapterGlobalRemovalAttempted',
      'rawSecretSerialized',
    ] as const;

    prohibited.forEach((key) => {
      const regression = createAuvarynNamingReservationGateFixture({ [key]: true });
      expect(regression.normalization.decision.decision).toBe('auvaryn-blocked');
      expect(regression.renameAllowed()).toBe(false);
      assertNoRawSecretOrContent(JSON.stringify(regression.normalization));
    });
  });

  it('updates naming decision and 266 follow-up docs', () => {
    const namingDecision = read(NAMING_DECISION);
    const doc266 = read(DOC_266);

    expect(namingDecision).toContain('Auvaryn Naming Reservation Gate');
    expect(namingDecision).toContain('auvaryn-needs-manual-reservation');
    expect(namingDecision).toContain('Do not rename Zavorth yet');
    expect(doc266).toContain('docs/267-auvaryn-naming-reservation-gate.md');
    expect(doc266).toContain('Auvaryn');
    assertNoRawSecretOrContent(namingDecision);
    assertNoRawSecretOrContent(doc266);
  });

  it('serializes without raw secrets or reservation/payment artifacts', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(serialized).toContain('Auvaryn');
    expect(serialized).toContain('Zavorth');
    expect(serialized).not.toContain('domainPurchaseActuallyPerformed":true');
    expect(serialized).not.toContain('npmPublishActuallyPerformed":true');
    expect(serialized).not.toContain('productRenameActuallyPerformed":true');
    assertNoRawSecretOrContent(serialized);
  });
});
