#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PublishComparisonService, type PublishSnapshotDescriptor } from '../src/services/PublishComparisonService.js';

type PublishHistoryEntry = {
  publishedAt?: string;
  branch?: string;
  commit?: string;
  archive?: {
    id?: string;
    targets?: {
      docs?: string;
      remoteConsole?: string;
    };
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const historyPath = path.join(projectRoot, 'data', 'runtime', 'publish-history.json');
const outputPath = path.join(projectRoot, 'data', 'runtime', 'last-remote-compare.json');
const remoteDistDir = path.join(projectRoot, 'remote-dist');

function getOptionValue(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const matched = argv.find((entry) => entry.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : null;
}

function readHistory(): PublishHistoryEntry[] {
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

function resolveHistoryDescriptor(entry: PublishHistoryEntry): PublishSnapshotDescriptor | null {
  const archiveId = String(entry.archive?.id || '').trim();
  const docsRelative = String(entry.archive?.targets?.docs || '').trim();
  const remoteConsoleRelative = String(entry.archive?.targets?.remoteConsole || '').trim();
  if (!archiveId || !docsRelative || !remoteConsoleRelative) {
    return null;
  }

  return {
    id: archiveId,
    label: `${archiveId} (${String(entry.commit || '').slice(0, 8) || 'sem-commit'})`,
    commit: entry.commit || null,
    publishedAt: entry.publishedAt || null,
    docsPath: path.resolve(projectRoot, docsRelative),
    remoteConsolePath: path.resolve(projectRoot, remoteConsoleRelative),
  };
}

function resolveCurrentPreparedDescriptor(): PublishSnapshotDescriptor | null {
  const docsPath = path.join(remoteDistDir, 'docs');
  const remoteConsolePath = path.join(remoteDistDir, 'remote-console');
  if (!fs.existsSync(docsPath) || !fs.existsSync(remoteConsolePath)) {
    return null;
  }

  return {
    id: 'current-prepared',
    label: 'current-prepared',
    commit: null,
    publishedAt: null,
    docsPath,
    remoteConsolePath,
  };
}

function pickDescriptors(argv: string[]): { from: PublishSnapshotDescriptor; to: PublishSnapshotDescriptor } {
  const history = readHistory();
  const fromId = getOptionValue(argv, '--from');
  const toId = getOptionValue(argv, '--to');
  const againstCurrent = argv.includes('--against-current');
  const historyDescriptors = history
    .map(resolveHistoryDescriptor)
    .filter((entry): entry is PublishSnapshotDescriptor => Boolean(entry));

  if (fromId || toId) {
    const from = historyDescriptors.find((entry) => entry.id === (fromId || ''));
    const to =
      (toId === 'current-prepared' ? resolveCurrentPreparedDescriptor() : null)
      || historyDescriptors.find((entry) => entry.id === (toId || ''));
    if (!from || !to) {
      throw new Error('Nao foi possivel resolver os publishes informados para comparacao.');
    }
    return { from, to };
  }

  if (againstCurrent) {
    const currentPrepared = resolveCurrentPreparedDescriptor();
    if (!currentPrepared || historyDescriptors.length < 1) {
      throw new Error('Nao ha snapshot preparado e publish historico suficientes para comparar.');
    }
    return {
      from: historyDescriptors[0],
      to: currentPrepared,
    };
  }

  if (historyDescriptors.length >= 2) {
    return {
      from: historyDescriptors[1],
      to: historyDescriptors[0],
    };
  }

  const currentPrepared = resolveCurrentPreparedDescriptor();
  if (historyDescriptors.length === 1 && currentPrepared) {
    return {
      from: historyDescriptors[0],
      to: currentPrepared,
    };
  }

  if (historyDescriptors.length === 1) {
    return {
      from: historyDescriptors[0],
      to: {
        ...historyDescriptors[0],
        id: `${historyDescriptors[0].id}-baseline`,
        label: `${historyDescriptors[0].label} (baseline)`,
      },
    };
  }

  throw new Error('Nao ha publishes suficientes para comparar ainda.');
}

function printReport(report: ReturnType<PublishComparisonService['compareSnapshots']>) {
  console.log(`[remote-compare] ${report.summary}`);
  console.log(`[remote-compare] from: ${report.from.label}`);
  console.log(`[remote-compare] to:   ${report.to.label}`);

  for (const target of ['docs', 'remoteConsole'] as const) {
    const section = report.targets[target];
    if (!section) {
      console.log(`[remote-compare] ${target}: indisponivel`);
      continue;
    }

    console.log(
      `[remote-compare] ${target}: +${section.added.length} -${section.removed.length} ~${section.changed.length} =${section.unchangedCount}`,
    );

    const samples = [
      ...section.changed.slice(0, 3).map((entry) => `changed:${entry}`),
      ...section.added.slice(0, 2).map((entry) => `added:${entry}`),
      ...section.removed.slice(0, 2).map((entry) => `removed:${entry}`),
    ];
    if (samples.length > 0) {
      console.log(`[remote-compare] ${target} exemplos: ${samples.join(' | ')}`);
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const descriptors = pickDescriptors(argv);
  const service = new PublishComparisonService();
  const report = service.compareSnapshots(descriptors.from, descriptors.to);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  printReport(report);
  console.log(`[remote-compare] report: ${outputPath}`);
}

main();
