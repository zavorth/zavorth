#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { PublishHistoryService } from '../src/services/PublishHistoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const historyPath = path.join(projectRoot, 'data', 'runtime', 'publish-history.json');

function formatWhen(value?: string | null) {
  if (!value) {
    return 'sem data';
  }

  return new Date(value).toLocaleString('en-US');
}

function formatDelta(summary?: string | null) {
  return summary ? ` | delta=${summary}` : '';
}

function main() {
  const service = new PublishHistoryService(projectRoot);
  const entries = service.readHistory(historyPath);
  if (!entries.length) {
    console.log('[remote-history] nenhum publish registrado ainda.');
    return;
  }

  const summaries = service.summarize(entries, 8);

  console.log('[remote-history] ultimos publishes');
  for (const summary of summaries) {
    const entry = summary.entry;
    console.log(
      `- ${entry.archive?.id || 'sem-archive'} | ${formatWhen(entry.publishedAt)} | ${entry.branch || 'n/d'} | ${String(
        entry.commit || '',
      ).slice(0, 8)} | docs=${entry.targets?.docs?.productionUrl || entry.targets?.docs?.deploymentUrl || 'n/d'} | console=${
        entry.targets?.remoteConsole?.productionUrl || entry.targets?.remoteConsole?.deploymentUrl || 'n/d'
      }${formatDelta(summary.comparisonToPrevious?.summary)}`,
    );
  }
}

main();
