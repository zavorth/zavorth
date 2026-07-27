import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const json = args.includes('--json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;

const readinessChecks = [
  {
    id: 'product-modes',
    label: 'modos de produto',
    suite: 'product-modes',
    covers: [
      'ZavorthProductMode chat|assistant|builder|operator',
      'runtime.mode.get/set por HTTP e WS',
      'payload canonical com productMode',
    ],
  },
  {
    id: 'mode-escalation',
    label: 'escalonamento por necessidade',
    suite: 'mode-escalation',
    covers: [
      'ModeEscalationRequest',
      'escopos once|session|host',
      'preflight com fallback e resourceImpact',
    ],
  },
  {
    id: 'control-ui',
    label: 'ZavorthControl principal',
    suite: 'control-ui',
    covers: [
      '/zavorthControl como entrada principal',
      'session via gateway WS/API',
      'mode, memory, approvals, tool cards e legacy banners',
    ],
  },
  {
    id: 'telegram-web-consistency',
    label: 'paridade Telegram/web',
    suite: 'telegram-web-consistency',
    covers: [
      'continuidade de transcript',
      'approval/session state compartilhado',
      'surface consistency para web e Telegram',
    ],
  },
  {
    id: 'memory-hybrid',
    label: 'hybrid memory',
    suite: 'memory-hybrid',
    covers: [
      'ledger autoritactive',
      'MemoryVectorStore como recall de apoio',
      'fallback ledger-only without embeddings',
    ],
  },
];

const startedAt = new Date();
const results = [];

if (!skipBuild) {
  const build = run('build', npmCommand, ['run', 'build', '--silent']);
  results.push({
    id: 'build',
    label: 'build TypeScript + surface syntax',
    status: build.status === 0 ? 'passed' : 'failed',
    exitCode: build.status,
    covers: ['tsc', 'check-surface-syntax'],
  });
  if (build.status !== 0) {
    finish(results, startedAt);
  }
}

for (const check of readinessChecks) {
  const result = run(
    check.id,
    nodeCommand,
    ['scripts/product-next-check.mjs', `--suite=${check.suite}`, '--skip-build'],
  );
  results.push({
    id: check.id,
    label: check.label,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    suite: check.suite,
    covers: check.covers,
  });
  if (result.status !== 0) {
    finish(results, startedAt);
  }
}

const legacy = run('legacy-compat', nodeCommand, ['scripts/legacy-containment-check.mjs']);
results.push({
  id: 'legacy-compat',
  label: 'compatibilidade legada',
  status: legacy.status === 0 ? 'passed' : 'failed',
  exitCode: legacy.status,
  suite: 'legacy-compat',
  covers: [
    '/app e /classic removidos da surface public',
    'links principais apontando para /zavorthControl',
    'docs e launchers alinhados',
  ],
});

finish(results, startedAt);

function run(id, command, commandArgs) {
  if (!json) {
    console.log(`\n[product-experience] ${id}`);
  }
  const result = process.platform === 'win32' && command === npmCommand
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `npm ${commandArgs.map(escapeWindowsArg).join(' ')}`],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        shell: false,
        stdio: json ? 'pipe' : 'inherit',
      },
    )
    : spawnSync(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      stdio: json ? 'pipe' : 'inherit',
    });
  if (result.error) {
    if (!json) {
      console.error(`[product-experience] failure ao run ${id}: ${result.error.message}`);
    }
    return { status: 1 };
  }
  return { status: typeof result.status === 'number' ? result.status : 1 };
}

function escapeWindowsArg(value) {
  const normalized = String(value);
  if (!/[ \t"]/u.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

function finish(results, startedAt) {
  const failed = results.filter((entry) => entry.status !== 'passed');
  const payload = {
    ok: failed.length === 0,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    summary: {
      status: failed.length === 0 ? 'ready' : 'blocked',
      passed: results.length - failed.length,
      failed: failed.length,
      total: results.length,
    },
    checks: results,
    commands: {
      modes: 'npm run qa:product:modes',
      escalation: 'npm run qa:mode-escalation',
      controlUi: 'npm run qa:control-ui',
      telegramWebConsistency: 'npm run qa:telegram-web-consistency',
      memoryHybrid: 'npm run qa:memory-hybrid',
      legacy: 'npm run qa:legacy-compat',
      all: 'npm run qa:product-experience',
    },
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (payload.ok) {
    console.log('\n[product-experience] ready: modos, escalation, ZavorthControl, Telegram/web, hybrid memory e legado passaram.');
  } else {
    console.error('\n[product-experience] blocked: algum gate failed.');
  }
  process.exit(payload.ok ? 0 : 1);
}
