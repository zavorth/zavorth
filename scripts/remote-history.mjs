#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const historyPath = path.join(projectRoot, 'data', 'runtime', 'publish-history.json');

function readHistory() {
  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatWhen(value) {
  if (!value) {
    return 'sem data';
  }

  return new Date(value).toLocaleString('en-US');
}

function main() {
  const entries = readHistory();
  if (!entries.length) {
    console.log('[remote-history] nenhum publish registrado ainda.');
    return;
  }

  console.log('[remote-history] ultimos publishes');
  for (const entry of entries.slice(0, 8)) {
    console.log(
      `- ${entry.archive?.id || 'sem-archive'} | ${formatWhen(entry.publishedAt)} | ${entry.branch || 'n/d'} | ${String(
        entry.commit || '',
      ).slice(0, 8)} | docs=${entry.targets?.docs?.productionUrl || entry.targets?.docs?.deploymentUrl || 'n/d'} | console=${
        entry.targets?.remoteConsole?.productionUrl || entry.targets?.remoteConsole?.deploymentUrl || 'n/d'
      }`,
    );
  }
}

main();
