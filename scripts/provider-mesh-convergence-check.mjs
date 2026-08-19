#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getConvergenceConfig } from './convergenceConfig.mjs';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const config = getConvergenceConfig();

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
    for (const needle of input.needles || []) {
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

function providerDetailWarning() {
  const files = [
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-models-panel.tsx',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-page.model-actions.ts',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/provider-detail-model-sections-compatible.tsx',
    'src/zavorth-control/app/(dashboard)/dashboard/providers/[id]/useProviderDetailPageModel.ts',
  ];
  const missingMarkers = files
    .filter((file) => exists(file))
    .filter((file) => !/modelPicker|pickerRoute|ModelPicker/u.test(read(file) || ''))
    .map((file) => `${file}: provider detail still appears connection/local-catalog driven`);
  if (missingMarkers.length === 0) {
    return null;
  }
  return {
    id: 'provider-detail-model-picker-followup',
    label: 'provider detail model panels are follow-up convergence work',
    status: 'warning',
    observed: `${missingMarkers.length} provider detail file(s) without direct picker marker`,
    target: 'provider detail can be migrated after the canonical API/CLI/zavorthControl/runtime path stays green',
    details: missingMarkers,
  };
}

function workspaceHardeningWarning() {
  const packageJson = JSON.parse(read('package.json') || '{"scripts":{}}');
  const scriptCount = Object.keys(packageJson.scripts || {}).length;
  const counts = {
    packageScripts: scriptCount,
    telegramAny: countAnyInTree('src/telegram', (file) => true),
    surfaceAny: countAnyInTree('src/domain/surface', (file) => true),
    servicesRootAny: countAnyInTree('src/services', (file) => {
      const relative = toPosix(path.relative(path.join(root, 'src/services'), file));
      return relative.split('/').length === 1 && /\.tsx...$/u.test(relative);
    }),
  };
  const details = [];
  if (counts.packageScripts > 100) {
    details.push(`package.json scripts: ${counts.packageScripts}/100`);
  }
  if (counts.telegramAny > 303) {
    details.push(`src/telegram any: ${counts.telegramAny}/303`);
  }
  if (counts.surfaceAny > 494) {
    details.push(`src/domain/surface any: ${counts.surfaceAny}/494`);
  }
  if (counts.servicesRootAny > 768) {
    details.push(`src/services/*.ts any: ${counts.servicesRootAny}/768`);
  }
  if (details.length === 0) {
    return null;
  }
  return {
    id: 'workspace-hardening-known-blocker',
    label: 'workspace:check remains blocked by global hardening thresholds',
    status: 'warning',
    observed: `${details.length} architecture hardening threshold(s) above budget`,
    target: 'full workspace gate should be green before productization/stable claims',
    details,
  };
}

function countAnyInTree(relativeDir, includeFile) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return 0;
  }
  return listFiles(absoluteDir)
    .filter((file) => /\.(ts|tsx)$/u.test(file))
    .filter(includeFile)
    .reduce((sum, file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return sum + (contents.match(/\bany\b/g) || []).length;
    }, 0);
}

function listFiles(absoluteDir) {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(absolute);
    }
    return [absolute];
  });
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

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

// Execute checks
const evaluatedRules = config.rules.map(rule => {
  if (rule.files && !rule.needles) {
    return ruleFilesExist(rule);
  }
  return ruleContainsAll(rule);
});

const evaluatedWarnings = config.warnings
  .map(warning => {
    if (warning.id === 'provider-detail-model-picker-followup') {
      return providerDetailWarning();
    }
    if (warning.id === 'workspace-hardening-known-blocker') {
      return workspaceHardeningWarning();
    }
    return null;
  })
  .filter(Boolean);

const failed = evaluatedRules.filter((entry) => entry.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: config.rules.length,
    passed: config.rules.length - failed.length,
    failed: failed.length,
    warnings: evaluatedWarnings.length,
  },
  rules: evaluatedRules,
  warnings: evaluatedWarnings,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[provider-mesh-convergence] checking canonical Provider Mesh convergence');
  for (const entry of evaluatedRules) {
    const marker = entry.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-mesh-convergence] ${marker} ${entry.label}: ${entry.observed} | ${entry.target}`);
    for (const detail of entry.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
  for (const warning of evaluatedWarnings) {
    console.log(`[provider-mesh-convergence] warn ${warning.label}: ${warning.observed} | ${warning.target}`);
    for (const detail of warning.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}