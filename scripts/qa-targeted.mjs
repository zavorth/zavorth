import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AREA_SCRIPTS = {
  cli: ['test:cli'],
  web: ['test:web:smoke'],
  gateway: ['test:gateway:smoke'],
  telegram: ['test:telegram:smoke'],
  channels: ['test:channels:smoke'],
  nodes: ['test:nodes:smoke'],
  'product-modes': ['qa:product:modes'],
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function usage() {
  console.log(`Usage:
  npm run qa:targeted -- --area <name> [--area <name> ...] [--script <npm-script> ...] [--structural] [--public-runtime] [--skip-typecheck]

Areas:
  ${Object.keys(AREA_SCRIPTS).join(', ')}
`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error) {
    console.error(`[qa:targeted] Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpmScript(name, extraArgs = []) {
  if (name === 'release:alpha' || name === 'release:beta') {
    console.error(
      '[qa:targeted] Refusing to run release promotion flows. Use release:alpha/release:beta explicitly when promotion is intended.',
    );
    process.exit(1);
  }

  const npmEntrypoint = process.env.npm_execpath;
  if (!npmEntrypoint) {
    console.error('[qa:targeted] npm_execpath is not available in this environment.');
    process.exit(1);
  }

  run(process.execPath, [npmEntrypoint, 'run', name, ...extraArgs]);
}

const args = process.argv.slice(2);
const selectedAreas = [];
const selectedScripts = [];
let structural = false;
let publicRuntime = false;
let skipTypecheck = false;

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];
  if (current === '--area') {
    const area = args[index + 1];
    if (!area) {
      console.error('[qa:targeted] Missing value after --area.');
      usage();
      process.exit(1);
    }
    selectedAreas.push(area);
    index += 1;
    continue;
  }

  if (current === '--script') {
    const script = args[index + 1];
    if (!script) {
      console.error('[qa:targeted] Missing value after --script.');
      usage();
      process.exit(1);
    }
    selectedScripts.push(script);
    index += 1;
    continue;
  }

  if (current === '--structural') {
    structural = true;
    continue;
  }

  if (current === '--public-runtime') {
    publicRuntime = true;
    continue;
  }

  if (current === '--skip-typecheck') {
    skipTypecheck = true;
    continue;
  }

  if (current === '--help' || current === '-h') {
    usage();
    process.exit(0);
  }

  console.error(`[qa:targeted] Unknown argument: ${current}`);
  usage();
  process.exit(1);
}

const scripts = new Set();
for (const area of selectedAreas) {
  const mapped = AREA_SCRIPTS[area];
  if (!mapped) {
    console.error(`[qa:targeted] Unknown area: ${area}`);
    usage();
    process.exit(1);
  }
  for (const script of mapped) {
    scripts.add(script);
  }
}

for (const script of selectedScripts) {
  scripts.add(script);
}

if (!skipTypecheck) {
  const tscEntrypoint = path.join(
    repoRoot,
    'node_modules',
    'typescript',
    'bin',
    'tsc',
  );
  run(process.execPath, [
    tscEntrypoint,
    '--noEmit',
    '--pretty',
    'false',
    '--incremental',
    'false',
  ]);
}

if (structural) {
  scripts.add('qa:architecture');
}

for (const script of scripts) {
  runNpmScript(script);
}

if (publicRuntime) {
  runNpmScript('ops:qa', ['--', '--require-pass']);
}

if (scripts.size === 0 && !publicRuntime) {
  if (skipTypecheck) {
    console.error('[qa:targeted] Nothing to run.');
    usage();
    process.exit(1);
  }
  console.log(
    '[qa:targeted] Completed lightweight validation with typecheck only. Add --area/--script/--structural/--public-runtime to broaden coverage.',
  );
}
