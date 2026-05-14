#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'web-research-live-plane-files',
    label: 'Web research live plane files exist',
    target: 'Contract, service, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/WebResearchLivePlaneContract.ts',
      'src/services/WebResearchLivePlaneService.ts',
      'src/adapters/web/WebResearchLiveAdapters.ts',
      'tests/services/WebResearchLivePlaneService.test.ts',
      'scripts/web-research-live-plane.ts',
      'scripts/web-research-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-contract',
    label: 'Contract defines Phase 8 vocabulary',
    target: 'Contract captures targets, capabilities, gates, receipts and next phase handoff',
    files: ['src/contracts/WebResearchLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_WEB_RESEARCH_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-04.live-phase-8',
      'brave',
      'exa',
      'searxng',
      'tavily',
      'firecrawl',
      'browserExtractionMarkedLiveByNoNetworkPlan: false',
      'Phase 9 - File, Document, Diff And Prose Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-adapters',
    label: 'Adapters implement search, Firecrawl, readability and browser capture',
    target: 'Provider search, Firecrawl, readability and browser capture adapters are present',
    files: ['src/adapters/web/WebResearchLiveAdapters.ts'],
    needles: [
      'SearchProviderLiveAdapter',
      'FirecrawlWebExtractLiveAdapter',
      'ReadabilityWebExtractLiveAdapter',
      'BrowserCaptureWebExtractLiveAdapter',
      'brave',
      'searxng',
      'playwright',
    ],
  }),
  ruleContainsAll({
    id: 'search-provider-choice',
    label: 'SearchQueryService can choose configured providers',
    target: 'search.query honors providerHints provider selection',
    files: ['src/services/SearchQueryService.ts'],
    needles: [
      'requestedProviderId',
      'providerHints',
      'searchProvider',
      'preferredProvider',
    ],
  }),
  ruleContainsAll({
    id: 'web-extract-live-service',
    label: 'WebExtractService executes live extraction artifacts',
    target: 'web.extract has real fetch/readability/crawl/browser paths with policy and artifacts',
    files: ['src/services/WebExtractService.ts'],
    needles: [
      'executeLive',
      'WebExtractPolicyDecision',
      'storeExtractionArtifact',
      'storeBinaryArtifact',
      'browserLaunchAllowed',
      'robotsPolicy',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-service',
    label: 'Service closes Phase 8 gates',
    target: 'Service maps seven web/search targets with citation artifacts and browser truthfulness',
    files: ['src/services/WebResearchLivePlaneService.ts'],
    needles: [
      'WebResearchLivePlaneService',
      'WEB_RESEARCH_TARGETS',
      'brave',
      'exa',
      'firecrawl',
      'web-readability',
      'browserCaptureCannotBeNoNetworkPlan',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-tests',
    label: 'Tests prove Phase 8 behavior',
    target: 'Tests cover provider choice, readability artifact, Firecrawl artifact and browser capture artifact',
    files: ['tests/services/WebResearchLivePlaneService.test.ts'],
    needles: [
      'closes Phase 8 research, web extraction and browser gates',
      'chooses among multiple configured search providers',
      'stores readability extraction as a web artifact',
      'stores Firecrawl crawl output as a web artifact',
      'runs browser capture only through an explicit live adapter path',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-package',
    label: 'Package exposes Phase 8 scripts',
    target: 'Phase 8 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'web-research-live-plane',
      'web-research-live-plane:check',
      'qa:web-research-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-sdk',
    label: 'SDK exposes Phase 8 contract and service',
    target: 'Phase 8 can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'WebResearchLivePlane',
    ],
  }),
  ruleContainsAll({
    id: 'web-research-live-doc',
    label: 'Docs record Phase 8 closure',
    target: 'Phase 8 documentation explains search, extraction, browser and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Phase 8',
      'Research, Web Extraction And Browser Live Plane',
      'staging-live',
      'browser',
      'Browser extraction never gets marked live by a no-network plan',
    ],
  }),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[web-research-live-plane] checking Phase 8');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[web-research-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
