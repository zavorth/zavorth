#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  file: string;
  line: number;
  specifier: string;
  reason: string;
};

type Rule = {
  id: string;
  label: string;
  files: string[];
  forbiddenSpecifiers: string[];
  allowedDynamicSpecifiers?: string[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const root = process.cwd();

const heavyRuntimeSpecifiers = [
  '@google/generative-ai',
  '@google/stitch-sdk',
  '@heyputer/puter.js',
  '@modelcontextprotocol/sdk',
  'better-sqlite3',
  'discord.js',
  'duck-duck-scrape',
  'grammy',
  'langfuse',
  'mqtt',
  'openai',
  'playwright',
  'ws',
];

const lightCoreFiles = [
  'src/zavorth-cli.ts',
  'src/core/MinimalRuntimeKernel.ts',
  'src/core/MinimalCapabilityRegistry.ts',
  'src/core/MinimalRuntimeProfileRegistry.ts',
  'src/core/MinimalRuntimeEventBus.ts',
  'src/core/MinimalRuntimeScheduler.ts',
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
  'scripts/event-first-check.ts',
  'scripts/runtime-resource-doctor.ts',
];

const rules: Rule[] = [
  {
    id: 'minimal-core-heavy-imports',
    label: 'minimal core must not import heavy runtime dependencies',
    files: lightCoreFiles,
    forbiddenSpecifiers: heavyRuntimeSpecifiers,
  },
  {
    id: 'cli-registry-lazy-import',
    label: 'public CLI must keep the full CLI registry lazy',
    files: ['src/zavorth-cli.ts'],
    forbiddenSpecifiers: ['./cli/ZavorthCli.js', './cli/ZavorthCli'],
    allowedDynamicSpecifiers: ['./cli/ZavorthCli.js', './cli/ZavorthCli'],
  },
];

function toPosix(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

function readFileIfExists(relativePath: string): string | null {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function extractStaticImports(line: string): string[] {
  const imports: string[] = [];
  const fromMatch = line.match(/\bfrom\s+['"]([^'"]+)['"]/);
  if (fromMatch?.[1]) {
    imports.push(fromMatch[1]);
  }
  const sideEffectMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
  if (sideEffectMatch?.[1]) {
    imports.push(sideEffectMatch[1]);
  }
  const requireMatch = line.match(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (requireMatch?.[1]) {
    imports.push(requireMatch[1]);
  }
  return imports;
}

function extractDynamicImports(line: string): string[] {
  const imports: string[] = [];
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of line.matchAll(dynamicPattern)) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function matchesSpecifier(actual: string, forbidden: string): boolean {
  return actual === forbidden || actual.startsWith(`${forbidden}/`);
}

function checkRule(rule: Rule): Violation[] {
  const violations: Violation[] = [];
  const allowedDynamic = new Set(rule.allowedDynamicSpecifiers || []);

  for (const relativeFile of rule.files) {
    const source = readFileIfExists(relativeFile);
    if (source === null) {
      violations.push({
        file: toPosix(relativeFile),
        line: 0,
        specifier: '',
        reason: 'Expected lightweight entry file does not exist.',
      });
      continue;
    }

    const lines = source.split(/\r...\n/);
    lines.forEach((line, index) => {
      for (const specifier of extractStaticImports(line)) {
        const forbidden = rule.forbiddenSpecifiers.find((entry) => matchesSpecifier(specifier, entry));
        if (forbidden) {
          violations.push({
            file: toPosix(relativeFile),
            line: index + 1,
            specifier,
            reason: `${rule.label}: static import of ${forbidden} is forbidden here.`,
          });
        }
      }

      for (const specifier of extractDynamicImports(line)) {
        const forbidden = rule.forbiddenSpecifiers.find((entry) => matchesSpecifier(specifier, entry));
        if (forbidden && !allowedDynamic.has(specifier)) {
          violations.push({
            file: toPosix(relativeFile),
            line: index + 1,
            specifier,
            reason: `${rule.label}: dynamic import of ${forbidden} must be declared as allowed or moved behind a capability manifest.`,
          });
        }
      }
    });
  }

  return violations;
}

const ruleResults = rules.map((rule) => {
  const violations = checkRule(rule);
  return {
    id: rule.id,
    label: rule.label,
    status: violations.length === 0 ? 'passed' : 'failed',
    checkedFiles: rule.files.length,
    forbiddenSpecifiers: rule.forbiddenSpecifiers,
    violations,
  };
});
const violations = ruleResults.flatMap((result) => result.violations);
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: violations.length === 0 ? 'passed' : 'failed',
  rules: ruleResults,
  violations,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  console.log('[lazy-loading] checando imports pesados no core minimo');
  for (const result of ruleResults) {
    console.log(`[lazy-loading] ${result.status === 'passed' ? 'ok' : 'fail'} ${result.label}`);
    for (const violation of result.violations.slice(0, 12)) {
      console.log(`- ${violation.file}:${violation.line} importa ${violation.specifier} | ${violation.reason}`);
    }
  }
}

if (violations.length > 0) {
  process.exitCode = 1;
}
