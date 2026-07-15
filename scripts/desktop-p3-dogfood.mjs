#!/usr/bin/env node
/**
 * Priority-3 desktop dogfood — structural + module contract checks for:
 * vibe coding, memory graph, cost savings, session export.
 * Does not require a live Electron window.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desktopSrc = path.join(root, 'apps', 'zavorth-desktop', 'src');
const desktopRoot = path.join(root, 'apps', 'zavorth-desktop');

let failed = 0;
function ok(msg) {
  console.log(`ok  ${msg}`);
}
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

function read(rel) {
  const full = path.join(desktopSrc, rel);
  if (!fs.existsSync(full)) {
    fail(`missing file ${rel}`);
    return '';
  }
  ok(`file ${rel}`);
  return fs.readFileSync(full, 'utf8');
}

function must(text, needles, label) {
  for (const n of needles) {
    if (!text.includes(n)) fail(`${label}: missing "${n}"`);
    else ok(`${label}: has "${n}"`);
  }
}

// --- Surface presence ---
const cost = read('views/panels/CostSavingsPanel.tsx');
const graph = read('views/panels/MemoryGraphPanel.tsx');
const exportPanel = read('views/panels/SessionExportPanel.tsx');
const vibe = read('vibe/VibeCodingPanel.tsx');
const analytics = read('views/panels/UsageAnalyticsPanel.tsx');
const memory = read('views/panels/MemoryPanel.tsx');
const api = read('apiClient.ts');
const nav = read('navigation/navConfig.ts');
const cc = read('command-center/commandCenter.ts');
const preview = read('views/WebPreviewView.tsx');
const previewStore = read('store/preview.ts');
const vibeHints = read('vibe/vibeScaffoldHints.ts');
const i18n = read('i18n.ts');

must(cost, ['loadCostSavingsDashboard', 'estimatedSavingsUsd', 'byModel'], 'CostSavingsPanel');
must(graph, ['loadMemoryGraph', 'svg', 'nodes', 'edges'], 'MemoryGraphPanel');
must(exportPanel, ['exportSessionTranscript', 'redact'], 'SessionExportPanel');
must(vibe, ['preview', 'terminal', 'scaffold', 'requestRightRailOpen'], 'VibeCodingPanel');
must(analytics, ['CostSavingsPanel', 'SessionExportPanel', 'savings', 'export'], 'UsageAnalytics');
must(memory, ['MemoryGraph', 'graph'], 'MemoryPanel');
must(
  api,
  [
    '/api/v2/cost-savings',
    '/api/v2/memory-graph',
    '/api/v2/session-export',
    'loadCostSavingsDashboard',
    'loadMemoryGraph',
    'exportSessionTranscript',
  ],
  'apiClient',
);
must(nav, ['vibe'], 'navConfig');
must(cc, ['vibe', 'scaffold', 'cost', 'savings'], 'commandCenter');
must(preview, ['iframe', 'DEFAULT_PREVIEW_URL', '$previewUrl'], 'WebPreview');
must(previewStore, ['$previewUrl', 'DEFAULT_PREVIEW_URL'], 'preview store');
must(vibeHints, ['localhost:5173', 'DEFAULT_PREVIEW_URL'], 'vibe scaffold defaults');
must(i18n, ['costSavings.tab', 'memoryGraph.tab', 'sessionExport.tab', 'vibe.title'], 'i18n EN keys');

// --- Backend routes ---
const routes = fs.readFileSync(path.join(root, 'src', 'services', 'ZavorthControlPlatformRoutes.ts'), 'utf8');
for (const route of ['/api/v2/cost-savings', '/api/v2/memory-graph', '/api/v2/session-export']) {
  const count = routes.split(`pathname === '${route}'`).length - 1;
  if (count !== 1) fail(`route handler count for ${route}: ${count} (want 1)`);
  else ok(`unique route ${route}`);
}

// --- Unit tests for pure helpers ---
const vitest = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'vitest',
    'run',
    'tests/costSavingsFormat.test.ts',
    'tests/memoryGraphLayout.test.ts',
    'tests/vibeScaffoldHints.test.ts',
    'tests/priority3Surfaces.test.ts',
  ],
  { cwd: desktopRoot, encoding: 'utf8', shell: true },
);
if (vitest.status !== 0) {
  fail('vitest P3 unit tests failed');
  console.error(vitest.stdout || '');
  console.error(vitest.stderr || '');
} else {
  ok('vitest P3 unit tests passed');
  const tail = (vitest.stdout || '').split('\n').slice(-8).join('\n');
  if (tail.trim()) console.log(tail);
}

// --- No Hermes branding in new surfaces ---
const scan = [cost, graph, exportPanel, vibe, analytics].join('\n');
if (/hermes-example|hermes-plugin|@hermes\//i.test(scan)) {
  fail('Hermes branding found in P3 surfaces');
} else {
  ok('no Hermes branding in P3 surfaces');
}

if (failed > 0) {
  console.error(`\nDesktop P3 dogfood FAILED (${failed})`);
  process.exit(1);
}
console.log('\nDesktop P3 dogfood OK');
