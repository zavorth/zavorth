#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const files = {
  preview: 'scripts/dashboard-browser-preview.ts',
  packageJson: 'package.json',
};

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertContains(label, content, needle) {
  if (!content.includes(needle)) {
    throw new Error(`${label} missing required marker: ${needle}`);
  }
}

function assertOrder(label, content, before, after) {
  const beforeIndex = content.indexOf(before);
  const afterIndex = content.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex > afterIndex) {
    throw new Error(`${label} order mismatch: expected ${before} before ${after}`);
  }
}

function main() {
  const preview = read(files.preview);
  const packageJson = JSON.parse(read(files.packageJson));
  const scripts = packageJson.scripts || {};
  const workspaceCheck = String(scripts['workspace:check'] || '');

  assertContains(files.preview, preview, 'const normalizeDashboardCopy = (value) => {');
  assertContains(files.preview, preview, 'const normalizeVisibleDashboardCopy = (root) => {');
  assertContains(files.preview, preview, 'document.createTreeWalker(root, NodeFilter.SHOW_TEXT)');
  assertContains(files.preview, preview, 'input[placeholder], textarea[placeholder], [aria-label], [title]');
  assertContains(files.preview, preview, 'normalizeVisibleDashboardCopy(document.getElementById("dashboard-preview-root"))');
  assertOrder(
    files.preview,
    preview,
    'injectPreviewOnboardingAndApprovals(vm);',
    'normalizeVisibleDashboardCopy(document.getElementById("dashboard-preview-root"))',
  );

  const requiredPairs = [
    ['Peca ao Zavorth', 'Ask Zavorth'],
    ['Enviar', 'Send'],
    ['Missao atual', 'Current mission'],
    ['Linha do tempo', 'Timeline'],
    ['Ferramentas', 'Tools'],
    ['Permitir', 'Allow'],
    ['Negar', 'Deny'],
    ['Sem approvals aguardando voce agora.', 'No approvals waiting for you right now.'],
    ['Matriz live:', 'Live matrix:'],
    ['Render seguro: sem chamadas de rede no dashboard.', 'Safe render: no dashboard network calls.'],
    ['Ainda nao ha artifacts nesta sessao.', 'There are no artifacts in this session yet.'],
  ];

  for (const [from, to] of requiredPairs) {
    assertContains(files.preview, preview, `["${from}", "${to}"]`);
  }

  assertContains(files.packageJson, JSON.stringify(scripts), 'zavorth:dashboard-language-consistency:check');
  assertContains(files.packageJson, JSON.stringify(scripts), 'qa:zavorth-dashboard-language-consistency');
  assertContains('workspace:check', workspaceCheck, 'zavorth:dashboard-language-consistency:check');
  assertOrder(
    'workspace:check',
    workspaceCheck,
    'zavorth:dashboard-responsive-visual-qa:check',
    'zavorth:dashboard-language-consistency:check',
  );

  console.log('[dashboard-language-consistency] ok Dashboard visible copy normalization is wired');
}

main();
