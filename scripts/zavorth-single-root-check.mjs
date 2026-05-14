#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const externalRootMarker = ['prompts', 'main'].join('-');
const maxFileSize = 5 * 1024 * 1024;
const skippedDirectoryNames = new Set([
  '.git',
  '.next',
  'coverage',
  'data',
  'memory',
  'node_modules',
]);
const skippedFileNames = new Set([
  '.env',
]);

const findings = [];

function shouldSkipDirectory(dirPath) {
  const name = path.basename(dirPath);
  return skippedDirectoryNames.has(name);
}

function shouldSkipFile(filePath) {
  const name = path.basename(filePath);
  return skippedFileNames.has(name);
}

function walk(currentPath) {
  let entries = [];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(absolutePath)) {
        walk(absolutePath);
      }
      continue;
    }
    if (!entry.isFile() || shouldSkipFile(absolutePath)) {
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(absolutePath);
    } catch {
      continue;
    }
    if (stat.size > maxFileSize) {
      continue;
    }
    let contents;
    try {
      contents = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      continue;
    }
    const index = contents.toLowerCase().indexOf(externalRootMarker);
    if (index !== -1) {
      const relativePath = path.relative(projectRoot, absolutePath);
      const line = contents.slice(0, index).split(/\r?\n/u).length;
      findings.push({ file: relativePath, line });
    }
  }
}

walk(projectRoot);

const snapshot = {
  contractVersion: 'zavorth-single-root-check/v1',
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? 'passed' : 'failed',
  projectRoot,
  policy: {
    canonicalRoot: path.join(projectRoot, 'data', 'agent-bridge', 'zavorth-bridge'),
    externalBridgeRootsAllowed: false,
    explicitBridgeRootOverrideAllowed: true,
  },
  findings,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth single-root check');
  console.log(`Status: ${snapshot.status}`);
  console.log(`Canonical bridge root: ${snapshot.policy.canonicalRoot}`);
  if (findings.length > 0) {
    console.log('Findings:');
    for (const finding of findings) {
      console.log(`- ${finding.file}:${finding.line}`);
    }
  }
}

if (snapshot.status !== 'passed') {
  process.exitCode = 1;
}
