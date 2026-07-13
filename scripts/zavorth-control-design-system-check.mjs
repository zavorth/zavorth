#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const normalize = (value) => value.replace(/\r\n?/g, '\n');

const files = {
  sourceIndex: 'apps/zavorth-control-vite-shell/index.html',
  app: 'apps/zavorth-control-vite-shell/src/app.ts',
  pages: 'apps/zavorth-control-vite-shell/src/pages.ts',
  reactIslands: 'apps/zavorth-control-vite-shell/src/react/DashboardReactIslands.tsx',
  preference: 'apps/zavorth-control-vite-shell/src/model-preference-actions.ts',
  runtimeBridge: 'apps/zavorth-control-vite-shell/src/runtime-bridge.ts',
  runtimeRefresh: 'apps/zavorth-control-vite-shell/src/runtime-refresh.ts',
  baseCss: 'apps/zavorth-control-vite-shell/public/styles/base.css',
  componentCss: 'apps/zavorth-control-vite-shell/public/styles/components.css',
  pagesCss: 'apps/zavorth-control-vite-shell/public/styles/pages.css',
  runtimeIndex: 'src/zavorth-control/public/zavorth-control-vite-shell/index.html',
  runtimePagesCss: 'src/zavorth-control/public/zavorth-control-vite-shell/styles/pages.css',
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing current Control asset: ${file}`);
}

if (failures.length === 0) {
  const contents = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, read(file)]),
  );
  const css = `${contents.baseCss}\n${contents.componentCss}\n${contents.pagesCss}`;

  const required = [
    ['sourceIndex', 'type="module" src="/src/app.ts"'],
    ['app', 'initControlApp'],
    ['reactIslands', 'model-preference-form'],
    ['reactIslands', 'listUserSelectionProviders'],
    ['reactIslands', 'listUserSelectionChannels'],
    ['pages', 'bindModelPreferenceEvents'],
    ['preference', "API_BASE = '/api/providers/preference'"],
    ['preference', 'daily-route-result__head'],
    ['runtimeBridge', 'updateProviderActivation'],
    ['runtimeRefresh', '/api/providers/activation'],
    ['runtimeIndex', 'assets/index-'],
  ];

  for (const [key, marker] of required) {
    if (!contents[key].includes(marker)) failures.push(`missing ${key} marker: ${marker}`);
  }

  for (const token of [
    '--b-bg',
    '--b-surface',
    '--b-component-border',
    '--b-signal',
  ]) {
    if (!css.includes(token)) failures.push(`missing current design token: ${token}`);
  }

  const publicText = `${contents.pages}\n${contents.reactIslands}\n${contents.preference}`;
  for (const forbidden of ['Auto / Gemini', 'Show Gemini provider', 'âœ…', 'âŒ', 'ðŸ']) {
    if (publicText.includes(forbidden)) failures.push(`forbidden stale/garbled copy: ${forbidden}`);
  }

  if (normalize(contents.pagesCss) !== normalize(contents.runtimePagesCss)) {
    failures.push('canonical pages.css is not synchronized to the runtime Control shell');
  }
}

if (failures.length > 0) {
  console.error('[zavorth-control-design-system] failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[zavorth-control-design-system] passed (current Vite architecture)');
