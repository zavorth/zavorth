#!/usr/bin/env node
/**
 * Desktop product smoke check (no Electron window required).
 * Verifies Priority 3 surfaces, navigation wiring, and key modules resolve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desktop = path.join(root, 'apps', 'zavorth-desktop', 'src');

const required = [
  'views/panels/CostSavingsPanel.tsx',
  'views/panels/MemoryGraphPanel.tsx',
  'views/panels/SessionExportPanel.tsx',
  'views/panels/MemoryPanel.tsx',
  'views/panels/UsageAnalyticsPanel.tsx',
  'vibe/VibeCodingPanel.tsx',
  'views/WebPreviewView.tsx',
  'apiClient.ts',
  'navigation/navConfig.ts',
  'command-center/commandCenter.ts',
];

const contentChecks = [
  {
    file: 'apiClient.ts',
    mustInclude: [
      'loadCostSavingsDashboard',
      'loadMemoryGraph',
      'exportSessionTranscript',
      '/api/v2/cost-savings',
      '/api/v2/memory-graph',
      '/api/v2/session-export',
    ],
  },
  { file: 'views/panels/MemoryPanel.tsx', mustInclude: ['graph', 'MemoryGraph'] },
  { file: 'views/panels/UsageAnalyticsPanel.tsx', mustInclude: ['CostSavings', 'savings', 'SessionExport'] },
  { file: 'vibe/VibeCodingPanel.tsx', mustInclude: ['preview', 'terminal', 'scaffold'] },
  { file: 'navigation/navConfig.ts', mustInclude: ['vibe'] },
];

let failed = 0;

for (const rel of required) {
  const full = path.join(desktop, rel);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${rel}`);
    failed += 1;
  } else {
    console.log(`ok file: ${rel}`);
  }
}

for (const check of contentChecks) {
  const full = path.join(desktop, check.file);
  if (!fs.existsSync(full)) {
    console.error(`MISSING content target: ${check.file}`);
    failed += 1;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  for (const needle of check.mustInclude) {
    if (!text.includes(needle)) {
      console.error(`FAIL ${check.file}: missing "${needle}"`);
      failed += 1;
    } else {
      console.log(`ok content: ${check.file} has "${needle}"`);
    }
  }
}

// Core API routes
const routesPath = path.join(root, 'src', 'services', 'ZavorthControlPlatformRoutes.ts');
const routes = fs.readFileSync(routesPath, 'utf8');
for (const route of ['/api/v2/cost-savings', '/api/v2/memory-graph', '/api/v2/session-export']) {
  const count = routes.split(route).length - 1;
  if (count < 1) {
    console.error(`FAIL routes: missing ${route}`);
    failed += 1;
  } else if (route === '/api/v2/memory-graph' && count > 2) {
    // one pathname check is enough; >2 might mean duplicate handlers
    console.warn(`WARN routes: ${route} appears ${count} times`);
  } else {
    console.log(`ok route: ${route}`);
  }
}

// Plugin expansion smoke
const pluginsDir = path.join(root, 'plugins');
const providerCount = fs.readdirSync(pluginsDir).filter((n) => n.startsWith('provider-')).length;
const platformCount = fs.readdirSync(pluginsDir).filter((n) => n.startsWith('platform-')).length;
const exampleCount = fs.existsSync(path.join(pluginsDir, 'examples'))
  ? fs
      .readdirSync(path.join(pluginsDir, 'examples'))
      .filter((n) => fs.statSync(path.join(pluginsDir, 'examples', n)).isDirectory()).length
  : 0;

console.log(`providers: ${providerCount}, platforms: ${platformCount}, examples: ${exampleCount}`);
if (providerCount < 10) {
  console.error('FAIL: expected >= 10 provider-* plugins');
  failed += 1;
}
if (platformCount < 8) {
  console.error('FAIL: expected >= 8 platform-* plugins');
  failed += 1;
}
if (exampleCount < 10) {
  console.error('FAIL: expected >= 10 example plugins');
  failed += 1;
}

// No Hermes-branded artifacts
const badNames = [];
function walk(dir, depth = 0) {
  if (depth > 4) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = path.join(dir, name);
    if (/hermes-example|hermes-plugin/i.test(name)) badNames.push(full);
    try {
      if (fs.statSync(full).isDirectory()) walk(full, depth + 1);
    } catch {
      // ignore
    }
  }
}
walk(path.join(root, 'plugins'));
walk(path.join(root, 'packages'));
if (badNames.length) {
  console.error('FAIL: Hermes-branded paths found:', badNames);
  failed += 1;
} else {
  console.log('ok: no hermes-example / hermes-plugin package names');
}

if (failed > 0) {
  console.error(`\nDesktop/product smoke FAILED (${failed} issue(s))`);
  process.exit(1);
}
console.log('\nDesktop/product smoke OK');
