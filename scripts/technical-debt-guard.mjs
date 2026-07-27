#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const sensitiveRoots = [
  'src/services',
  'src/execution',
  'src/telegram',
  'src/cli',
  'src/domain/gateway',
  'src/domain/surface',
];

const requiredRoutingContracts = [
  {
    file: 'src/telegram/CommandParser.ts',
    includes: [
      'normalizeTelegramCommandToken',
      'resolveCommandAlias',
      'isKnownCommand',
    ],
  },
  {
    file: 'src/telegram/TelegramPriorityCommandService.ts',
    includes: [
      'parseRemoteModeCommand',
      'parseRuntimeMaintenanceCommand',
      'parsePromptCommand',
      'parseControlCommand',
    ],
  },
  {
    file: 'tests/telegram/TelegramCommandRoutingService.test.ts',
    includes: [
      'dispatchPrivateCommand',
      'dispatchGroupCommand',
    ],
  },
  {
    file: 'tests/telegram/TelegramPriorityCommandService.test.ts',
    includes: [
      'priority command contract',
    ],
  },
];

const failures = [];

for (const relativeRoot of sensitiveRoots) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) {
    continue;
  }
  for (const file of walkTsFiles(absoluteRoot)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('@ts-ignore')) {
      failures.push(`${path.relative(root, file)}: contains @ts-ignore em area sensitive`);
    }
  }
}

for (const contract of requiredRoutingContracts) {
  const absolute = path.join(root, contract.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${contract.file}: contrato de routing missing`);
    continue;
  }
  const content = fs.readFileSync(absolute, 'utf8');
  for (const expected of contract.includes) {
    if (!content.includes(expected)) {
      failures.push(`${contract.file}: contrato de routing without "${expected}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('[technical-debt-guard] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[technical-debt-guard] ok: without @ts-ignore em areas sensitive e routing critical coberto por contratos.');

function* walkTsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'dist-ops'].includes(entry.name)) {
        continue;
      }
      yield* walkTsFiles(absolute);
      continue;
    }
    if (entry.isFile() && absolute.endsWith('.ts') && !absolute.endsWith('.d.ts')) {
      yield absolute;
    }
  }
}
