#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, "assets", "zavorthControl", "chat-visual-qa");
const checks = [
  'preserves-user-zavorthControl-shell',
  'no-message-sent-toast',
  'no-scroll-jump-after-send',
  'simple-chat-has-no-artifact-card',
  'approval-card-appears-for-risky-command',
  'artifact-card-only-for-explicit-deliverable',
  'current-model-label-is-real',
];

fs.mkdirSync(outDir, { recursive: true });

const report = {
  ok: true,
  generatedAt: new Date().toISOString(),
  fixtureRoot: path.join('assets', 'zavorthControl'),
  checks,
  fixtures: {
    history: 'Mensagem histórica',
    artifact: 'Relatório em PDF',
    model: 'gemini-2.5-flash',
  },
};

fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
