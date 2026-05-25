export type ZavorthSimpleCommandPlan =
  | {
    kind: 'passthrough';
    args: string[];
  }
  | {
    kind: 'npm-script';
    scripts: string[];
    label: string;
  }
  | {
    kind: 'qa-guide';
    topic: 'all' | 'setup' | 'daily';
  };

import { renderCliScreen } from './ZavorthCliVisualSystem.js';

const SIMPLE_COMMAND_ALIASES: Record<string, string[]> = {
  cha: ['chat'],
  talk: ['chat'],
  converse: ['chat'],
  setu: ['setup'],
  setuo: ['setup'],
  setups: ['setup'],
  init: ['setup'],
  staus: ['ready'],
  stats: ['status'],
  health: ['status'],
  check: ['doctor'],
  diagnose: ['doctor'],
  doctro: ['doctor'],
  docotr: ['doctor'],
  panel: ['open'],
  dashboard: ['open'],
  opne: ['open'],
  run: ['ask'],
  provders: ['providers'],
  provs: ['providers'],
  channles: ['channels'],
  chanels: ['channels'],
};

const SIMPLE_TEST_SUITES: Record<string, { label: string; scripts: string[] }> = {
  all: {
    label: 'Zavorth daily safe test',
    scripts: [
      'runtime:check',
      'zavorth:setup-studio-command:check',
      'zavorth:setup-studio-premium:check',
      'zavorth:doctor-premium:check',
      'zavorth:cli-home:check',
      'zavorth:cli-hatch:check',
      'zavorth:cli-quickstart:check',
      'zavorth:cli-help-premium:check',
      'zavorth:cli-hud:check',
    ],
  },
  setup: {
    label: 'Zavorth setup test',
    scripts: [
      'zavorth:setup-studio-command:check',
      'zavorth:setup-studio-premium:check',
    ],
  },
  cli: {
    label: 'Zavorth CLI test',
    scripts: [
      'zavorth:cli-home:check',
      'zavorth:cli-hatch:check',
      'zavorth:cli-quickstart:check',
      'zavorth:cli-help-premium:check',
      'zavorth:cli-hud:check',
    ],
  },
  runtime: {
    label: 'Zavorth runtime typecheck',
    scripts: ['runtime:check'],
  },
  security: {
    label: 'Zavorth security pre-push check',
    scripts: ['security:prepush'],
  },
};

export function resolveZavorthSimpleCommand(rawArgs: string[]): ZavorthSimpleCommandPlan {
  const command = String(rawArgs[0] || '').trim().toLowerCase();
  const rest = rawArgs.slice(1);

  if (!command) {
    return { kind: 'passthrough', args: rawArgs };
  }

  if (command === 'test' || command === 'tests') {
    const suite = String(rest[0] || 'all').trim().toLowerCase();
    const selected = SIMPLE_TEST_SUITES[suite] || SIMPLE_TEST_SUITES.all;
    return {
      kind: 'npm-script',
      label: selected.label,
      scripts: selected.scripts,
    };
  }

  if (command === 'qa') {
    const topic = String(rest[0] || 'all').trim().toLowerCase();
    return {
      kind: 'qa-guide',
      topic: topic === 'setup' || topic === 'daily' ? topic : 'all',
    };
  }

  const alias = SIMPLE_COMMAND_ALIASES[command];
  if (alias) {
    return {
      kind: 'passthrough',
      args: [...alias, ...rest],
    };
  }

  return { kind: 'passthrough', args: rawArgs };
}

export function renderZavorthQaGuide(topic: 'all' | 'setup' | 'daily' = 'all'): string {
  const setupLines = [
    '1. Run: zavorth setup',
    '2. Confirm the orange wordmark and first-light journey feel consistent.',
    '3. Pick a provider, edit the model, capture a key, then run the live provider test if you have credentials.',
    '4. Configure Telegram or another surface, then run the channel live test if you have credentials.',
    '5. Apply setup only after the preview is clear.',
  ];
  const dailyLines = [
    '1. Run: zavorth',
    '2. Run: zavorth ready',
    '3. Run: zavorth ask "what is your current state?"',
    '4. Run: zavorth open',
    '5. Run: zavorth doctor',
  ];
  const testLines = [
    'zavorth test',
    'zavorth test setup',
    'zavorth test cli',
    'zavorth test runtime',
    'zavorth test security',
  ];

  const panels = [
    ...(topic === 'daily' ? [] : [{ title: 'Setup QA', tone: 'brand' as const, lines: setupLines }]),
    ...(topic === 'setup' ? [] : [{ title: 'Daily-use QA', tone: 'success' as const, lines: dailyLines }]),
    { title: 'Simple test commands', tone: 'muted' as const, lines: testLines },
  ];

  return renderCliScreen({
    eyebrow: 'QA',
    title: 'Zavorth QA Guide',
    summary: 'Simple commands first. Maintainer scripts stay available behind the scenes.',
    panels,
  });
}
