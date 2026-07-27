#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'file-document-diff-live-plane-files',
    label: 'File/document/diff live plane files exist',
    target: 'Contract, service, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/FileDocumentDiffLivePlaneContract.ts',
      'src/contracts/ArtifactDiffContract.ts',
      'src/services/FileDocumentDiffLivePlaneService.ts',
      'src/services/FileTransferService.ts',
      'src/services/DocumentExtractService.ts',
      'src/services/ArtifactDiffService.ts',
      'src/services/DocumentWorkflowDecisionService.ts',
      'src/adapters/files/FileDocumentDiffLiveAdapters.ts',
      'tests/services/FileDocumentDiffLivePlaneService.test.ts',
      'scripts/file-document-diff-live-plane.ts',
      'scripts/file-document-diff-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-contract',
    label: 'Contract defines Certification matrix vocabulary',
    target: 'Contract captures targets, capabilities, gates, receipts and next phase handoff',
    files: ['src/contracts/FileDocumentDiffLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_FILE_DOCUMENT_DIFF_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-04.live-gate-9',
      'file-transfer',
      'document-extract',
      'diffs',
      'open-prose',
      'lobster',
      'fileTransferMarkedLiveByPlanOnly: false',
      'documentExtractMarkedLiveByDryPlaceholder: false',
      'Intent model0 - Diagnostics, QA And Migration Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-adapters',
    label: 'Adapters implement file transfer, document text and diff engine',
    target: 'local adapters handle bytes, extraction and unified diff creation',
    files: ['src/adapters/files/FileDocumentDiffLiveAdapters.ts'],
    needles: [
      'LocalFileTransferAdapter',
      'LocalDocumentTextExtractionAdapter',
      'LocalArtifactDiffAdapter',
      'copyFile',
      'createTwoFilesPatch',
      'baseline-literal-text',
    ],
  }),
  ruleContainsAll({
    id: 'file-transfer-live-service',
    label: 'FileTransferService executes real bytes under policy',
    target: 'file.transfer has live copy/move path with approved roots and confirmWrite',
    files: ['src/services/FileTransferService.ts'],
    needles: [
      'executeLive',
      'confirmWrite',
      'allowMoveDelete',
      'allowedRoots',
      'bytesTransferred',
      'LocalFileTransferAdapter',
    ],
  }),
  ruleContainsAll({
    id: 'document-extract-live-service',
    label: 'DocumentExtractService extracts real documents',
    target: 'document.extract reads real local files, extracts text/metadata/tables and stores artifacts',
    files: ['src/services/DocumentExtractService.ts'],
    needles: [
      'extractLive',
      'JSZip',
      'extractDocx',
      'extractHtmlTables',
      'pdf',
      'docx',
      'storeExtractionArtifact',
    ],
  }),
  ruleContainsAll({
    id: 'artifact-diff-live-service',
    label: 'ArtifactDiffService creates diff artifacts',
    target: 'artifact.diff writes real text/x-diff artifacts with hunk summaries',
    files: ['src/services/ArtifactDiffService.ts'],
    needles: [
      'createDiffArtifact',
      'ArtifactDiffService',
      'LocalArtifactDiffAdapter',
      'text/x-diff',
      'changedLines',
      'hunks',
    ],
  }),
  ruleContainsAll({
    id: 'document-workflow-decisions',
    label: 'open-prose and lobster are explicitly routed',
    target: 'Special prose/document surfaces have a Zavorth-native workflow decision',
    files: ['src/services/DocumentWorkflowDecisionService.ts'],
    needles: [
      'open-prose',
      'lobster',
      'document.extract',
      'artifact.diff',
      'workflow-decision-live',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-service',
    label: 'Service closes Certification matrix gates',
    target: 'Service maps five targets with policy, extraction, diff and workflow receipts',
    files: ['src/services/FileDocumentDiffLivePlaneService.ts'],
    needles: [
      'FileDocumentDiffLivePlaneService',
      'FILE_DOCUMENT_DIFF_TARGETS',
      'workspace-write-policy',
      'pdf-docx-baseline',
      'table-extraction',
      'artifact-diff',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-readiness',
    label: 'Live readiness promotes Certification matrix runtime families',
    target: 'file.transfer, document.extract and artifact.diff point at Certification matrix live activation',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'file.transfer',
      'document.extract',
      'artifact.diff',
      'Certification matrix - File, Document, and Diff Live Activation',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-normalization',
    label: 'Capability normalization points artifact.diff at live service',
    target: 'artifact.diff uses the Certification matrix ArtifactDiffService target',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'artifact.diff',
      'src/services/ArtifactDiffService.ts',
      'src/contracts/ArtifactDiffContract.ts',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-tests',
    label: 'Tests prove Certification matrix behavior',
    target: 'Tests cover snapshot, real bytes, extraction, diff and workflow decisions',
    files: ['tests/services/FileDocumentDiffLivePlaneService.test.ts'],
    needles: [
      'closes Certification matrix file, document, diff and prose gates',
      'copies real bytes under approved workspace policy',
      'extracts text, metadata and tables from a real HTML document',
      'creates a real unified diff artifact',
      'routes open-prose and lobster through explicit workflow decisions',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-package',
    label: 'Package exposes Certification matrix scripts',
    target: 'Certification matrix can be run through package scripts',
    files: ['package.json'],
    needles: [
      'file-document-diff-live-plane',
      'file-document-diff-live-plane:check',
      'qa:file-document-diff-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-sdk',
    label: 'SDK exposes Certification matrix contract and service',
    target: 'Certification matrix can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts'],
    needles: [
      'FileDocumentDiffLivePlane',
      'ArtifactDiff',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-sdk-service',
    label: 'SDK exposes Certification matrix services',
    target: 'Certification matrix services can be imported from SDK index',
    files: ['src/sdk/index.ts'],
    needles: [
      'FileDocumentDiffLivePlaneService',
      'ArtifactDiffService',
    ],
  }),
  ruleContainsAll({
    id: 'file-document-diff-live-doc',
    label: 'Docs record Certification matrix closure',
    target: 'Certification matrix documentation explains file bytes, extraction, diff and workflow decisions',
    files: ['docs/README.md'],
    needles: [
      'Certification matrix',
      'File, Document, Diff And Prose Live Plane',
      'file.transfer',
      'document.extract',
      'artifact.diff',
      'open-prose',
      'lobster',
      'staging-live',
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
  console.log('[file-document-diff-live-plane] checking Certification matrix');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[file-document-diff-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
