#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const files = {
  css: 'src/ai-gateway/app/(dashboard)/control/command-center/styles/commandCenter.css',
  visualQa: 'scripts/zavorth-dashboard-visual-qa.ts',
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
  const css = read(files.css).replace(/\r\n/g, '\n');
  const visualQa = read(files.visualQa);
  const packageJson = JSON.parse(read(files.packageJson));
  const workspaceCheck = String(packageJson.scripts?.['workspace:check'] || '');

  assertContains(files.css, css, '.bsk-command-center,\n.bsk-command-center *');
  assertContains(files.css, css, 'box-sizing: border-box;');
  assertContains(files.css, css, 'max-width: 100vw;');
  assertContains(files.css, css, 'overflow-x: hidden;');
  assertContains(files.css, css, '@media (max-width: 860px)');
  assertContains(files.css, css, '.bcc-control-grid {\n    grid-template-columns: minmax(0, 1fr);');
  assertContains(files.css, css, '.bcc-dock__rail {\n    width: 100%;');
  assertContains(files.css, css, 'overflow-x: auto;');
  assertContains(files.css, css, '.bcc-chat-feed {\n    overflow-x: hidden;');
  assertContains(files.css, css, '.bcc-message {\n    max-width: 100%;');

  assertContains(files.visualQa, visualQa, "{ id: 'desktop', width: 1440, height: 1000");
  assertContains(files.visualQa, visualQa, "{ id: 'mobile', width: 390, height: 844");
  assertContains(files.visualQa, visualQa, "{ id: 'auto-subagents', width: 1440, height: 1800");
  assertContains(files.visualQa, visualQa, 'fullPage: true');
  assertContains(files.visualQa, visualQa, 'manifest.json');

  assertContains(files.packageJson, JSON.stringify(packageJson.scripts || {}), 'zavorth:zavorthControl-responsive-visual-qa:check');
  assertContains('workspace:check', workspaceCheck, 'zavorth:zavorthControl-responsive-visual-qa:check');
  assertOrder(
    'workspace:check',
    workspaceCheck,
    'zavorth:zavorthControl-daily-use-polish:check',
    'zavorth:zavorthControl-responsive-visual-qa:check',
  );

  console.log('[zavorth-dashboard-responsive-visual-qa] ok responsive visual QA guard is wired');
}

main();
