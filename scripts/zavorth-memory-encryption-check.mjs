#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'memory-encryption-files',
    label: 'Memory encryption surfaces exist',
    target: 'service, CLI, runtime route, desktop surface, docs and tests are present',
    files: [
      'src/services/ZavorthMemoryEncryptionStatusService.ts',
      'src/cli/ZavorthMemoryEncryptionCommand.ts',
      'src/services/DashboardCoreRouteService.ts',
      'src/zavorth-control/app/api/experience/memory/encryption/route.ts',
      'apps/zavorth-desktop/src/apiClient.ts',
      'apps/zavorth-desktop/src/App.tsx',
      'scripts/zavorth-memory-encryption.ts',
      'tests/services/ZavorthMemoryEncryptionStatusService.test.ts',
      'docs/memory-encryption.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'memory-encryption-service-contract',
    label: 'Service exposes status, migration and rollback',
    target: 'advanced memory encryption can be inspected, previewed, applied and rolled back',
    files: ['src/services/ZavorthMemoryEncryptionStatusService.ts'],
    needles: [
      'ZavorthMemoryEncryptionStatusService',
      'fullFileEncryptionProof',
      'contentEncrypted: true',
      'previewMigration',
      'applyMigration',
      'rollbackMigration',
      'formatStatusText',
      'formatMigrationText',
    ],
  }),
  ruleContainsAcross({
    id: 'memory-encryption-cli-contract',
    label: 'CLI exposes human and JSON commands',
    target: 'operator can inspect or migrate memory without opening the UI',
    files: ['src/cli/ZavorthMemoryEncryptionCommand.ts', 'src/zavorth-cli.ts', 'package.json'],
    needles: [
      'zavorth memory encryption status',
      'zavorth memory encryption preview --mode required',
      'zavorth memory encryption apply --mode required',
      'zavorth memory encryption rollback --backup <path>',
      'runZavorthMemoryEncryptionCommand',
      'zavorth:memory-encryption:check',
    ],
  }),
  ruleContainsAcross({
    id: 'memory-encryption-desktop-contract',
    label: 'Desktop projects memory protection honestly',
    target: 'desktop can display status and run explicit preview/apply actions',
    files: ['apps/zavorth-desktop/src/apiClient.ts', 'apps/zavorth-desktop/src/App.tsx'],
    needles: [
      'MemoryEncryptionStatus',
      'loadMemoryEncryptionStatus',
      'runMemoryEncryptionMigration',
      'Advanced memory protection',
      'Memory protection',
    ],
  }),
  ruleContainsAll({
    id: 'memory-encryption-docs-contract',
    label: 'Docs describe safe default and advanced mode',
    target: 'user docs explain field encryption, optional full-file encryption and rollback',
    files: ['docs/memory-encryption.md'],
    needles: [
      'zavorth memory encryption status',
      'ZAVORTH_MEMORY_SQLCIPHER_MODE',
      'ZAVORTH_MEMORY_SQLCIPHER_KEY',
      'rollback',
      'Advanced memory protection',
    ],
  }),
  runtimeStatusRule(),
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
  console.log('[zavorth-memory-encryption] checking memory protection');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-memory-encryption] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 10)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runtimeStatusRule() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-encryption-check-'));
  const dbPath = path.join(tempRoot, 'memory.sqlite');
  try {
    const result = spawnSync(process.execPath, [
      path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      'scripts/zavorth-memory-encryption.ts',
      'status',
      '--json',
      '--db',
      dbPath,
      '--mode',
      'off',
    ], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    });
    if (result.status !== 0) {
      return {
        id: 'memory-encryption-runtime-status',
        label: 'Runtime status command passes',
        status: 'failed',
        observed: `exit ${result.status ?? 'unknown'}`,
        target: 'status command reports safe field encryption without writing secrets',
        details: compactDetails(result.stderr, result.stdout),
      };
    }
    const status = JSON.parse(result.stdout);
    return {
      id: 'memory-encryption-runtime-status',
      label: 'Runtime status command passes',
      status: status.safeForDailyUse && status.contentEncrypted ? 'passed' : 'failed',
      observed: `safe=${status.safeForDailyUse}, contentEncrypted=${status.contentEncrypted}, mode=${status.atRestEncryptionMode}`,
      target: 'status command reports safe field encryption without writing secrets',
      details: [
        `advanced=${status.fullFileEncryptionStatus}`,
        `driver=${status.fullFileEncryptionDriverPackage || 'none'}`,
        `proof=${status.fullFileEncryptionProof?.reason || 'none'}`,
      ],
    };
  } catch (error) {
    return {
      id: 'memory-encryption-runtime-status',
      label: 'Runtime status command passes',
      status: 'failed',
      observed: 'exception',
      target: 'status command reports safe field encryption without writing secrets',
      details: [error instanceof Error ? error.message : String(error)],
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
}

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r...\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
