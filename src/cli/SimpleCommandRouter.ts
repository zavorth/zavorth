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

/**
 * Everyday intent aliases (phase 2–3).
 * Prefer short human verbs; keep typos; map jargon to anyone-path tokens.
 */
const SIMPLE_COMMAND_ALIASES: Record<string, string[]> = {
  // Talk
  cha: ['chat'],
  talk: ['chat'],
  converse: ['chat'],
  falar: ['ask'],
  dizer: ['ask'],
  // Setup
  setu: ['setup'],
  setuo: ['setup'],
  setups: ['setup'],
  init: ['setup'],
  configurar: ['setup'],
  // Health / ready
  staus: ['ready'],
  stats: ['ready'],
  health: ['ready'],
  saude: ['ready'],
  saúde: ['ready'],
  // Doctor
  check: ['doctor'],
  diagnose: ['doctor'],
  doctro: ['doctor'],
  docotr: ['doctor'],
  // Open dashboard
  panel: ['open'],
  zavorthControl: ['open'],
  opne: ['open'],
  // Run → ask (natural request)
  run: ['ask'],
  // Providers / channels typos
  provders: ['providers'],
  provs: ['providers'],
  channles: ['channels'],
  chanels: ['channels'],
  // Connect intent
  conectar: ['connect'],
  conect: ['connect'],
  ligar: ['connect'],
  // Learn intent
  aprender: ['learn'],
  aprendizado: ['learn'],
  digest: ['learn'],
  digesto: ['learn'],
  // Fabric short names (phase 2 collapse)
  where: ['reach'],
  onde: ['reach'],
  'reach-fabric': ['reach'],
  'power-fabric': ['power'],
  'product-fabric': ['product'],
  'proof-ledger': ['proof'],
  // Stay online / health family
  'stay-online': ['ready'],
  stayonline: ['ready'],
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

  // Natural CLI rewrite (shared policies with slash) — passthrough after normalize.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { naturalizeCliArgv } = require('./CliNaturalConvention.js') as typeof import('./CliNaturalConvention.js');
    const naturalized = naturalizeCliArgv(rawArgs);
    if (naturalized.rewritten) {
      return { kind: 'passthrough', args: naturalized.argv };
    }
  } catch {
    // Convention module optional during partial loads
  }

  return { kind: 'passthrough', args: rawArgs };
}
