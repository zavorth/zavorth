#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  ruleTelegramNoDirectSchedulerMutation(),
  ruleSharedSurfaceWiring(),
  ruleWorkspaceCheck(),
  ruleNoPublicExternalNames(),
];
const failed = rules.filter((item) => item.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-scheduled-task-surfaces] checking Connector registry');
  printRules(rules, '[zavorth-scheduled-task-surfaces]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskSurfaceContract.ts',
    'src/services/ZavorthScheduledTaskSurfaceService.ts',
    'tests/domain/agent/ScheduledTaskSurfaceService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-surface-files', 'Connector registry files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthScheduledTaskSurfaceContract.ts', ['ZAVORTH_SCHEDULED_TASK_SURFACE_CONTRACT_VERSION', 'noLegacyDirectSchedulerMutation', '/unschedule <id>']],
    ['src/services/ZavorthScheduledTaskSurfaceService.ts', ['ZavorthScheduledTaskPersistenceService', 'checkpoint-4-governed-scheduled-task-surfaces', 'approvalEnvelopeRequiredForMutation']],
    ['src/services/ZavorthAutomationActionService.ts', ['ZavorthScheduledTaskSurfaceService', 'Persistencia: ZavorthScheduledTaskPersistenceService']],
    ['src/telegram/controllers/TelegramSchedulerController.ts', ['ZavorthScheduledTaskSurfaceService', 'Agendamento governado criado', 'Relatorio governado agendado']],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack.ts', ["case '/schedule'", "case '/unschedule'", 'handleSchedule', 'handleReport']],
    ['src/services/SharedSurfaceCommandContract.ts', ["commandType: '/schedule'", "commandType: '/schedules'", "commandType: '/unschedule'", "commandType: '/report'"]],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskSurfaceContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskSurfaceService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-surface-markers', 'Connector registry markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'surface, Telegram, shared command and SDK markers exist', missing);
}

function ruleTelegramNoDirectSchedulerMutation() {
  const text = read('src/telegram/controllers/TelegramSchedulerController.ts');
  const directCalls = [
    '.scheduleTask(',
    '.removeTask(',
  ].filter((needle) => text.includes(`schedulerService${needle}`));
  return rule('telegram-no-direct-scheduler-mutation', 'Telegram schedule commands use governed surface service', directCalls.length === 0, directCalls.length === 0 ? 'no direct scheduler mutation' : directCalls.join(', '), 'no schedulerService.scheduleTask/removeTask direct calls', directCalls);
}

function ruleSharedSurfaceWiring() {
  const contract = read('src/services/SharedSurfaceCommandContract.ts');
  const operations = read('src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack.ts');
  const wired = ['/schedule', '/schedules', '/unschedule', '/report'].filter((command) =>
    contract.includes(`commandType: '${command}'`) && operations.includes(`case '${command}'`));
  return rule('shared-surface-schedule-commands', 'Shared surfaces expose schedule lifecycle commands', wired.length === 4, `${wired.length}/4`, '/schedule, /schedules, /unschedule and /report are shared-service commands', wired.length === 4 ? [] : wired);
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-scheduled-task-surfaces-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Connector registry scheduled surfaces gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function ruleNoPublicExternalNames() {
  const files = [
    'src/contracts/ZavorthScheduledTaskSurfaceContract.ts',
    'src/services/ZavorthScheduledTaskSurfaceService.ts',
    'scripts/zavorth-scheduled-task-surfaces-check.mjs',
  ];
  const forbidden = [
    ['Open', 'Claw'].join(''),
    ['Claude', ' Code'].join(''),
    ['Anti', 'gravity'].join(''),
  ];
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const word of forbidden) {
      if (text.includes(word)) hits.push(`${file}: ${word}`);
    }
  }
  return rule('no-public-external-names', 'Connector registry public core remains neutral', hits.length === 0, hits.length === 0 ? 'neutral' : `${hits.length} hit(s)`, 'no external product names in public core files', hits);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}
