#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const base = read('assets/dashboard/styles/base.css');
const components = read('assets/dashboard/styles/components.css');
const pages = read('assets/dashboard/styles/pages.css');
const chat = read('assets/dashboard/styles/chat.css');
const html = read('assets/dashboard/index.html');

const requiredTokens = [
  '--b-space-1',
  '--b-control-md',
  '--b-card-pad-md',
  '--b-row-min',
  '--b-component-border',
  '--b-component-bg',
  '--b-component-hover-border',
  '--b-label-size',
];

const requiredClasses = [
  '.zv-surface',
  '.zv-section',
  '.zv-card',
  '.zv-action',
  '.zv-chip',
  '.zv-status',
  '.zv-list',
  '.zv-row',
  '.zv-data-table',
  '.zv-empty',
  '.zv-toolbar',
];

const requiredLegacyAlignment = [
  '.summary-card',
  '.entity-card',
  '.data-table',
  '.badge',
  '.dashboard-card',
  '.dashboard-strip',
  '.echo-action-row',
  '.inbox-flow-strip',
];

const failures = [];

for (const token of requiredTokens) {
  if (!base.includes(token)) failures.push(`missing token ${token}`);
}

for (const className of requiredClasses) {
  if (!components.includes(className)) failures.push(`missing canonical class ${className}`);
}

for (const selector of requiredLegacyAlignment) {
  const haystack = selector.includes('echo') || selector.includes('inbox') ? chat : pages + chat + html;
  if (!haystack.includes(selector)) failures.push(`missing aligned selector ${selector}`);
}

if (!components.includes(':where(.core-card, .summary-card, .entity-card')) {
  failures.push('legacy card selectors are not aligned to the component contract');
}

if (!pages.includes('var(--b-component-bg)') || !pages.includes('var(--b-component-border)')) {
  failures.push('sector pages are not using component contract tokens');
}

if (!chat.includes('var(--b-control-sm)') && !components.includes('.echo-action-row button')) {
  failures.push('chat action controls are not covered by the component contract');
}

if (failures.length) {
  console.error('[dashboard-design-system] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[dashboard-design-system] passed');
console.log(`tokens=${requiredTokens.length} canonicalClasses=${requiredClasses.length} legacySelectors=${requiredLegacyAlignment.length}`);
