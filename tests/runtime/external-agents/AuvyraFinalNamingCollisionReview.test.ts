import fs from 'node:fs';
import path from 'node:path';

import {
  AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID,
  createAuvyraFinalNamingCollisionReviewFixture,
  createAuvyraFinalNamingSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  AuvyraExpectedState,
  AuvyraFinalDecisionState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/268-auvyra-final-naming-collision-review.md';
const BOUNDARY = 'src/runtime/external-agents/AuvyraFinalNamingCollisionReview.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const DOC_267 = 'docs/267-auvaryn-naming-reservation-gate.md';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const EXPECTED_STATES: AuvyraExpectedState[] = [
  'currentProductName=Zavorth',
  'previousCandidateName=Auvaryn',
  'candidateProductName=Auvyra',
  'productRenameActuallyPerformed=false',
  'packageRenameActuallyPerformed=false',
  'cliRenameActuallyPerformed=false',
  'npmPublishActuallyPerformed=false',
  'domainPurchaseActuallyPerformed=false',
  'githubOrgCreated=false',
  'trademarkFiled=false',
  'finalOperatorApprovalRequired=true',
];

const ALLOWED_DECISIONS: AuvyraFinalDecisionState[] = [
  'auvyra-approved-for-rename-planning',
  'auvyra-needs-manual-reservation',
  'auvyra-blocked',
  'auvyra-unknown',
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

describe('Auvyra final naming collision review', () => {
  const pack = createAuvyraFinalNamingCollisionReviewFixture();

  it('documents 268 as a final collision review with no rename', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `auvyra-blocked`');
    expect(content).toContain('AuvyraFinalNamingCollisionReview.ts');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    expect(content).toContain('npmAuvyraAvailability=available');
    expect(content).toContain('npmCreateAuvyraAvailability=available');
    expect(content).toContain('githubOrgOrUserAvailability=available');
    expect(content).toContain('githubGreyvritraRepoAvailability=available');
    expect(content).toContain('Auvyra Core');
    expect(content).toContain('Auvyra TTS');
    expect(content).toContain('select-new-name-candidate');
    assertNoRawSecretOrContent(content);
  });

  it('exports the 268 boundary and required contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('AuvyraFinalNamingCollisionReview/v1');
    expect(boundary).toContain('NamingCandidateAvailability/v1');
    expect(boundary).toContain('NamingNpmAvailability/v1');
    expect(boundary).toContain('NamingGithubAvailability/v1');
    expect(boundary).toContain('NamingDomainAvailability/v1');
    expect(boundary).toContain('NamingCollisionReview/v1');
    expect(boundary).toContain('NamingTrademarkRisk/v1');
    expect(boundary).toContain('NamingFinalDecision/v1');
    expect(boundary).toContain('NamingManualAction/v1');
    expect(index).toContain("from './AuvyraFinalNamingCollisionReview.js'");
    expect(index).toContain('AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID');
    expect(pack.normalization.runtimeId).toBe(AUVYRA_FINAL_NAMING_COLLISION_REVIEW_RUNTIME_ID);
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('does not rename Zavorth, package names, or CLI commands', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.name).not.toBe('auvyra');
    expect(rootPackage.bin.zavorth).toBe('./bin/zavorth.js');
    expect(rootPackage.bin.auvyra).toBeUndefined();
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.name).not.toBe('create-auvyra');
    expect(createPackage.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createPackage.bin['create-auvyra']).toBeUndefined();
    expect(pack.normalization.executionGate.productRenameActuallyPerformed).toBe(false);
    expect(pack.normalization.executionGate.packageRenameActuallyPerformed).toBe(false);
    expect(pack.normalization.executionGate.cliRenameActuallyPerformed).toBe(false);
    expect(pack.renameAllowed()).toBe(false);
  });

  it('evaluates npm and GitHub separately', () => {
    expect(pack.normalization.npmAvailability).toEqual([
      expect.objectContaining({
        nativeContract: 'NamingNpmAvailability/v1',
        packageName: 'auvyra',
        availability: 'available',
        exactNpmSearchMatches: 0,
        typoGuard: 'correct-spelling-auvyra-not-auvrya',
      }),
      expect.objectContaining({
        nativeContract: 'NamingNpmAvailability/v1',
        packageName: 'create-auvyra',
        availability: 'available',
        exactNpmSearchMatches: 0,
        typoGuard: 'correct-spelling-auvyra-not-auvrya',
      }),
    ]);
    expect(pack.normalization.githubAvailability).toEqual(expect.objectContaining({
      nativeContract: 'NamingGithubAvailability/v1',
      githubOrgOrUserAvailability: 'available',
      githubGreyvritraRepoAvailability: 'available',
      repositorySearchResults: 0,
      userSearchResults: 1,
      githubOrgCreated: false,
      githubRepoCreated: false,
    }));
  });

  it('records exact AI/runtime conflicts and blocks rename planning', () => {
    expect(pack.normalization.candidateAvailability.generalSearchRisk).toBe('high');
    expect(pack.normalization.candidateAvailability.devMarketplaceRisk).toBe('high');
    expect(pack.normalization.candidateAvailability.notableConflicts).toEqual(expect.arrayContaining([
      expect.stringContaining('Auvyra Core'),
      expect.stringContaining('Auvyra TTS'),
      expect.stringContaining('Auvyra.com.br'),
      expect.stringContaining('AUVYRA LTD'),
    ]));
    expect(pack.normalization.finalDecision.decision).toBe('auvyra-blocked');
    expect(pack.normalization.finalDecision.nextRecommendedPack).toBe('select-new-name-candidate');
    expect(pack.renameAllowed()).toBe(false);
  });

  it('compares Auvyra against Auvaryn, Avaryn, AURVYN, Veyra, and Vritra', () => {
    const review = pack.normalization.collisionReview;

    expect(review.comparedNames).toEqual(['Auvyra', 'Auvaryn', 'Avaryn', 'AURVYN', 'Veyra', 'Vritra']);
    expect(review.phoneticCollisionRisk).toBe('medium');
    expect(review.visualCollisionRisk).toBe('medium');
    expect(review.cliErgonomics).toBe('strong');
    expect(review.brandDistinctiveness).toBe('weak');
    expect(review.cliExamples).toEqual(['auvyra setup', 'auvyra go', 'auvyra doctor', 'npm create auvyra']);
    expect(review.findings.join('\n')).toContain('Auvyra TTS');
  });

  it('uses careful domain language and never buys a domain', () => {
    const domain = pack.normalization.domainAvailability;

    expect(domain.nativeContract).toBe('NamingDomainAvailability/v1');
    expect(domain.domainRisk).toBe('high');
    expect(domain.domainPurchaseActuallyPerformed).toBe(false);
    expect(domain.domainConflicts).toContain('auvyra.com has active DNS.');
    expect(domain.domainConflicts).toContain('auvyra.com.br is an active exact-name commerce site.');
    [...domain.primaryDomains, ...domain.secondaryDomains].forEach((entry) => {
      expect(entry.registrarCheckRequired).toBe(true);
      expect(entry.note).toBe('dns-empty-is-not-availability-proof');
    });
    expect(domain.primaryDomains).toContainEqual(expect.objectContaining({
      domain: 'auvyra.com',
      dnsState: 'activeDnsFound',
    }));
  });

  it('records trademark risk with disclaimer and no filing', () => {
    expect(pack.normalization.trademarkRisk).toEqual(expect.objectContaining({
      nativeContract: 'NamingTrademarkRisk/v1',
      trademarkSearchPerformed: true,
      searchedTerms: ['Auvyra', 'AUVYRA', 'Avaryn', 'Auvaryn', 'AURVYN'],
      trademarkRisk: 'high',
      trademarkDisclaimer: 'not legal advice; official/legal clearance still required',
      trademarkFiled: false,
    }));
    expect(pack.normalization.trademarkRisk.notableTrademarkSignals.join('\n')).toContain('AUVYRA LTD');
  });

  it('chooses only an allowed decision and recommends no immediate rename', () => {
    const decision = pack.normalization.finalDecision;

    expect(ALLOWED_DECISIONS).toContain(decision.decision);
    expect(decision.decision).toBe('auvyra-blocked');
    expect(decision.productRenameActuallyPerformed).toBe(false);
    expect(decision.packageRenameActuallyPerformed).toBe(false);
    expect(decision.cliRenameActuallyPerformed).toBe(false);
    expect(decision.npmPublishActuallyPerformed).toBe(false);
    expect(decision.finalOperatorApprovalRequired).toBe(true);
    expect(decision.rationale.join('\n')).toContain('Auvyra TTS');
  });

  it('lists manual actions instead of performing reservations', () => {
    expect(pack.normalization.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionId: 'review-exact-ai-runtime-conflicts',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'discard-auvyra-or-get-legal-clearance',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'select-new-name-candidate',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
      expect.objectContaining({
        actionId: 'preserve-zavorth-until-new-candidate',
        requiredBeforeRename: true,
        performedByGate: false,
      }),
    ]));
  });

  it('keeps all prohibited action flags false', () => {
    expect(pack.normalization.executionGate).toEqual({
      auvyraFinalNamingCollisionReviewCreated: true,
      currentProductName: 'Zavorth',
      previousCandidateName: 'Auvaryn',
      candidateProductName: 'Auvyra',
      productRenameActuallyPerformed: false,
      packageRenameActuallyPerformed: false,
      cliRenameActuallyPerformed: false,
      npmPublishActuallyPerformed: false,
      domainPurchaseActuallyPerformed: false,
      githubOrgCreated: false,
      trademarkFiled: false,
      packageJsonRenamedToAuvyra: false,
      cliRenamedToAuvyra: false,
      finalOperatorApprovalRequired: true,
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
      'cliRenameAttempted',
      'npmPublishAttempted',
      'domainPurchaseAttempted',
      'githubOrgCreateAttempted',
      'trademarkFiledAttempted',
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
      const regression = createAuvyraFinalNamingCollisionReviewFixture({ [key]: true });
      expect(regression.normalization.finalDecision.decision).toBe('auvyra-blocked');
      expect(regression.renameAllowed()).toBe(false);
      assertNoRawSecretOrContent(JSON.stringify(regression.normalization));
    });
  });

  it('can approve only a clean source fixture, proving the default block is conflict-driven', () => {
    const cleanSource = createAuvyraFinalNamingCollisionReviewFixture({
      generalSearchRisk: 'low',
      notableConflicts: [],
      devMarketplaceRisk: 'low',
      devMarketplaceConflicts: [],
      domainConflicts: [],
      trademarkRisk: 'low',
      notableTrademarkSignals: ['No exact conflict in this synthetic fixture; official clearance still required.'],
      brandDistinctiveness: 'strong',
      phoneticCollisionRisk: 'low',
      visualCollisionRisk: 'low',
    });

    expect(cleanSource.normalization.finalDecision.decision).toBe('auvyra-approved-for-rename-planning');
    expect(cleanSource.renameAllowed()).toBe(false);
  });

  it('updates naming decision and the 267 follow-up doc', () => {
    const namingDecision = read(NAMING_DECISION);
    const doc267 = read(DOC_267);

    expect(namingDecision).toContain('268 - Auvyra Final Naming Collision Review');
    expect(namingDecision).toContain('auvyra-blocked');
    expect(namingDecision).toContain('Do not rename Zavorth to Auvyra');
    expect(doc267).toContain('Post-268 note');
    expect(doc267).toContain('Auvyra');
    expect(doc267).toContain('auvyra-blocked');
    assertNoRawSecretOrContent(namingDecision);
    assertNoRawSecretOrContent(doc267);
  });

  it('serializes without raw secrets, credentials, or paid reservation artifacts', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(serialized).toContain('Auvyra');
    expect(serialized).toContain('Zavorth');
    expect(serialized).not.toContain('domainPurchaseActuallyPerformed":true');
    expect(serialized).not.toContain('npmPublishActuallyPerformed":true');
    expect(serialized).not.toContain('productRenameActuallyPerformed":true');
    expect(serialized).not.toContain('cliRenameActuallyPerformed":true');
    assertNoRawSecretOrContent(serialized);
  });
});
