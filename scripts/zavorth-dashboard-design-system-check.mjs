#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const globals = read('src/ai-gateway/app/globals.css');
const home = read('src/ai-gateway/app/(dashboard)/dashboard/HomePageClient.tsx');
const sidebar = read('src/ai-gateway/shared/constants/sidebarVisibility.ts');

const requiredTokens = [
  '--color-primary',
  '--color-accent',
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--color-text-main',
  '--shadow-soft',
  '--shadow-elevated',
];

const requiredHomeMarkers = [
  'HomePageClient',
  'providerSignal',
  'approvalsSignal',
  'runtimeGuidedFixes',
  '/api/runtime/readiness',
  '/api/system/version',
  'lg:',
  'sm:',
];

const requiredSidebarMarkers = [
  'href: "/dashboard"',
  'href: "/dashboard/providers"',
  'href: "/dashboard/skills"',
  'href: "/dashboard/memory"',
];

const failures = [];

for (const token of requiredTokens) {
  if (!globals.includes(token)) failures.push(`missing token ${token}`);
}

for (const marker of requiredHomeMarkers) {
  if (!home.includes(marker)) failures.push(`missing dashboard marker ${marker}`);
}

for (const marker of requiredSidebarMarkers) {
  if (!sidebar.includes(marker)) failures.push(`missing sidebar marker ${marker}`);
}

if (sidebar.includes('/control')) {
  failures.push('legacy /control route is still exposed in dashboard navigation');
}

if (!globals.includes('@source "../app/(dashboard)"')) {
  failures.push('Tailwind source does not include dashboard route group');
}

if (failures.length) {
  console.error('[dashboard-design-system] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[dashboard-design-system] passed');
console.log(`tokens=${requiredTokens.length} homeMarkers=${requiredHomeMarkers.length} sidebarMarkers=${requiredSidebarMarkers.length}`);
