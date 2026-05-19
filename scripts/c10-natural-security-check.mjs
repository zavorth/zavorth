#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'c10-harness-and-acceptance',
    label: 'C10 evaluation harness exists',
    target: 'Natural language and security evaluations run through UniversalIntentEvaluationHarness',
    files: [
      'src/runtime/uni/UniversalIntentEvaluationHarness.ts',
      'tests/runtime/uni/c10-natural-security.test.ts',
    ],
  }),
  ruleFilesExist({
    id: 'c10-blueprint-suites-exist',
    label: 'Blueprint C10 suites exist',
    target: 'All named C10 suites from the blueprint are present',
    files: [
      'tests/runtime/uni/maria-flows.test.ts',
      'tests/runtime/uni/builder-flows.test.ts',
      'tests/runtime/uni/operator-flows.test.ts',
      'tests/runtime/uni/permission-scope.test.ts',
      'tests/runtime/uni/trust-posture.test.ts',
      'tests/runtime/uni/clarification-policy.test.ts',
    ],
  }),
  ruleContainsAll({
    id: 'c10-minimum-scenarios',
    label: 'minimum scenarios are encoded',
    target: 'C10 covers documents, receipts, file summary, code diff, sandbox tests, host access, computer use, selfmod, MCP quarantine and permission expiry',
    files: ['src/runtime/uni/UniversalIntentEvaluationHarness.ts'],
    needles: [
      'maria-organize-documents',
      'maria-search-invoices-receipts',
      'maria-summarize-file-scoped',
      'builder-edit-code-diff',
      'builder-run-tests-sandbox',
      'operator-host-access-block',
      'operator-computer-use-insufficient-permission',
      'operator-selfmod-preview-first',
      'operator-external-mcp-quarantine',
      'permission-once-consumed',
      'permission-session-boundary',
      'clarification-ambiguous-mutation',
      'clarification-sensitive-domain-target',
    ],
  }),
  ruleContainsAll({
    id: 'c10-acceptance-criteria',
    label: 'acceptance criteria are explicit',
    target: 'The harness proves NL cannot bypass security and blocked paths have safe next steps',
    files: ['src/runtime/uni/UniversalIntentEvaluationHarness.ts'],
    needles: [
      'naturalLanguageDoesNotBypassSecurity',
      'securityNarrativeIsNotOpaque',
      'everyBlockHasSafeNextStep',
      'no-direct-mutation',
      'plain-language-next-step',
      'auditable-trust-posture',
    ],
  }),
  ruleContainsAcross({
    id: 'c10-exported-and-documented',
    label: 'C10 harness is exported and documented',
    target: 'Runtime code and docs can reference the C10 harness',
    files: [
      'src/runtime/uni/index.ts',
      'docs/README.md',
    ],
    needles: [
      'UniversalIntentEvaluationHarness',
      'Track 27',
      'C10',
      'naturalLanguageDoesNotBypassSecurity',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-c10-gate',
    label: 'package exposes C10 gate',
    target: 'local QA can run c10:natural-security:check and qa:c10-natural-security',
    files: ['package.json'],
    needles: [
      'c10:natural-security:check',
      'qa:c10-natural-security',
      'scripts/c10-natural-security-check.mjs',
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
  console.log('[c10-natural-security] checking C10 evaluations');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[c10-natural-security] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
