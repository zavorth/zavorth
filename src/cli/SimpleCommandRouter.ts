export type ZavorthSimpleCommandPlan =
  | {
    kind: 'passthrough';
    args: string[];
  }
  | {
    kind: 'npm-script';
    scripts: string[];
    label: string;
  };

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
  zavorthControl: ['open'],
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

  const alias = SIMPLE_COMMAND_ALIASES[command];
  if (alias) {
    return {
      kind: 'passthrough',
      args: [...alias, ...rest],
    };
  }

  return { kind: 'passthrough', args: rawArgs };
}
