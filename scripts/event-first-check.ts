#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  file: string;
  line: number;
  pattern: string;
  reason: string;
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const root = process.cwd();

const checkedFiles = [
  'src/zavorth-cli.ts',
  'src/core/MinimalRuntimeKernel.ts',
  'src/core/MinimalCapabilityRegistry.ts',
  'src/core/MinimalRuntimeProfileRegistry.ts',
  'src/core/MinimalRuntimeEventBus.ts',
  'src/core/MinimalRuntimeContractService.ts',
  'src/core/MinimalRuntimeModeGovernor.ts',
  'src/core/MinimalCapabilityActivationPlanner.ts',
  'src/core/MinimalCapabilityActivationLedger.ts',
  'src/core/MinimalCapabilityActivationReplayService.ts',
  'src/core/MinimalDesktopResourceHistoryCompactor.ts',
  'src/core/MinimalRuntimeArtifactRetentionCatalog.ts',
  'src/core/MinimalRuntimeRetentionService.ts',
  'src/core/MinimalSidecarManager.ts',
  'src/services/RuntimeResourceBudgetService.ts',
  'scripts/minimal-kernel.ts',
  'scripts/capability-registry-doctor.ts',
  'scripts/runtime-profile-doctor.ts',
  'scripts/sidecar-manager-doctor.ts',
  'scripts/runtime-event-doctor.ts',
  'scripts/runtime-contract-doctor.ts',
  'scripts/capability-activation-doctor.ts',
  'scripts/capability-activation-ledger-doctor.ts',
  'scripts/capability-activation-replay-doctor.ts',
  'scripts/runtime-retention-doctor.ts',
  'scripts/runtime-resource-doctor.ts',
];

const forbiddenPatterns = [
  { label: 'setInterval', pattern: /\bsetInterval\s*\(/ },
  { label: 'setTimeout', pattern: /\bsetTimeout\s*\(/ },
  { label: 'setImmediate', pattern: /\bsetImmediate\s*\(/ },
  { label: 'fs.watch', pattern: /\bfs\.watch\s*\(/ },
  { label: 'watch import/use', pattern: /\bchokidar\b|\bwatch\s*\(/ },
];

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function read(relativePath: string): string | null {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

const violations: Violation[] = [];

for (const relativeFile of checkedFiles) {
  const source = read(relativeFile);
  if (source === null) {
    violations.push({
      file: toPosix(relativeFile),
      line: 0,
      pattern: 'missing-file',
      reason: 'Expected event-first core file does not exist.',
    });
    continue;
  }
  source.split(/\r...\n/).forEach((line, index) => {
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(line)) {
        violations.push({
          file: toPosix(relativeFile),
          line: index + 1,
          pattern: forbidden.label,
          reason: 'Polling/watchers in the minimal core must be registered through MinimalRuntimeScheduler.',
        });
      }
    }
  });
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  status: violations.length === 0 ? 'passed' : 'failed',
  checkedFiles,
  allowedTimerOwner: 'src/core/MinimalRuntimeScheduler.ts',
  violations,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log('[event-first] checando timers/watchers soltos no core minimo');
  if (violations.length === 0) {
    console.log('[event-first] ok core minimo without polling solto');
  }
  for (const violation of violations.slice(0, 20)) {
    console.log(`- ${violation.file}:${violation.line} ${violation.pattern} | ${violation.reason}`);
  }
}

if (violations.length > 0) {
  process.exitCode = 1;
}
