#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const canonicalRoot = path.resolve(projectRoot, 'data', 'agent-bridge', 'zavorth-bridge');
const asJson = process.argv.includes('--json');
const ensure = process.argv.includes('--ensure');

const bridgeDirs = [
  'control/requests',
  'control/results',
  'runtime',
  'pending',
  'handoffs',
  'responses',
];

if (ensure) {
  for (const relative of bridgeDirs) {
    fs.mkdirSync(path.join(canonicalRoot, relative), { recursive: true });
  }
}

function readStatus(root) {
  const statusFile = path.join(root, 'runtime', 'bridge-status.json');
  if (!fs.existsSync(statusFile)) {
    return {
      exists: false,
      statusFile,
      updatedAt: null,
      bridgeRoot: null,
      bridgeRootMode: null,
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    return {
      exists: true,
      statusFile,
      updatedAt: parsed.updatedAt || null,
      bridgeRoot: parsed.bridgeRoot || null,
      bridgeRootMode: parsed.bridgeRootMode || null,
    };
  } catch {
    return {
      exists: true,
      statusFile,
      updatedAt: null,
      bridgeRoot: null,
      bridgeRootMode: 'unreadable',
    };
  }
}

const canonicalStatus = readStatus(canonicalRoot);
const snapshot = {
  contractVersion: 'zavorth-bridge-root-doctor/v1',
  generatedAt: new Date().toISOString(),
  status: fs.existsSync(projectRoot) && fs.existsSync(path.join(projectRoot, 'zavorth.yml')) ? 'passed'
    : 'failed',
  canonical: {
    root: canonicalRoot,
    exists: fs.existsSync(canonicalRoot),
    status: canonicalStatus,
  },
  policy: {
    canonicalCoreIsSourceOfTruth: true,
    deletesLegacyAutomatically: false,
  },
  nextSafeAction: canonicalStatus.exists ? 'Bridge can communicate through zavorth-core/Zavorth as the canonical root.'
    : 'Run npm run bridge:doctor -- --ensure, then restart the bridge extension.',
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('Zavorth bridge root doctor');
  console.log(`Status: ${snapshot.status}`);
  console.log(`Canonical: ${snapshot.canonical.root}`);
  console.log(`Canonical heartbeat: ${canonicalStatus.updatedAt || 'missing'}`);
  console.log(`Next: ${snapshot.nextSafeAction}`);
}

if (snapshot.status !== 'passed') {
  process.exitCode = 1;
}
