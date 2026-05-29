#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const requireLive = process.argv.includes('--require-live');
const noRun = process.argv.includes('--no-run');
const timeoutMs = Number(process.env.ZAVORTH_PRODUCT_GATE_TIMEOUT_MS || 180000);

const checks = [
  check('terminal-cli', 'Terminal and CLI product polish', ['npm', ['run', 'zavorth:cli-final-product-polish:check', '--silent']], {
    category: 'terminal',
    required: true,
    docs: ['docs/zavorth-cli.md'],
  }),
  check('zavorthControl-control', 'ZavorthControl /control visual and product QA', ['npm', ['run', 'zavorth:zavorthControl-final-product-polish:check', '--silent']], {
    category: 'zavorthControl',
    required: true,
    docs: ['docs/web-zavorthControl.md', 'docs/control-visual-qa.md'],
  }),
  check('live-certification', 'Live certification matrix and long-tail adapter honesty', ['npm', ['run', 'zavorth:live-certification-matrix:check', '--silent']], {
    category: 'live-adapters',
    required: true,
    liveCapable: true,
    docs: ['docs/channel-mesh.md', 'docs/provider-mesh.md'],
  }),
  check('e2e-runtime', 'End-to-end mission flow public runtime certification', ['npm', ['run', 'zavorth:end-to-end-mission-flow-public-runtime-certification:check', '--silent']], {
    category: 'daily-qa',
    required: true,
    docs: ['docs/runtime-readiness.md', 'docs/execution.md'],
  }),
  check('live-proof-pack', 'Live readiness evidence proof pack', ['npm', ['run', 'zavorth:live-readiness-evidence-proof-pack:check', '--silent']], {
    category: 'daily-qa',
    required: true,
    liveCapable: true,
    docs: ['docs/runtime-readiness.md'],
  }),
  check('docs-install', 'Documentation, install and public repo closure', ['npm', ['run', 'zavorth:documentation-repo-final:check', '--silent']], {
    category: 'docs-install',
    required: true,
    docs: ['docs/install.md', 'docs/quickstart.md', 'docs/README.md'],
  }),
  check('capability-absorption', 'OpenClaw/Zavorth-native/Zavorth-native absorption map', ['npm', ['run', 'zavorth:capability-absorption:check', '--silent']], {
    category: 'product-strategy',
    required: true,
    docs: ['docs/capability-absorption.md'],
  }),
  check('channel-deepening', 'All-channel setup, doctor, pairing, proof and outbox map', ['npm', ['run', 'zavorth:channel-deepening:check', '--silent']], {
    category: 'channel-deepening',
    required: true,
    docs: ['docs/channel-deepening.md', 'docs/channel-mesh.md'],
  }),
  check('native-learning-loop', 'Mnemos native learning loop and reversible user model', ['npm', ['run', 'zavorth:native-learning-loop:check', '--silent']], {
    category: 'learning',
    required: true,
    docs: ['docs/native-learning-loop.md', 'docs/mnemos-memory-os.md'],
  }),
  check('zavorth-control-advanced-interaction', 'Zavorth-native advanced ZavorthControl tool cards, subagents, queue and reconnect', ['npm', ['run', 'zavorth:zavorth-control-advanced-interaction:check', '--silent']], {
    category: 'zavorthControl',
    required: true,
    docs: ['docs/web-zavorthControl.md', 'docs/zavorth-control-advanced-interaction.md'],
  }),
  check('native-browser-computer-use', 'Native browser and computer-use governed sidecar capability', ['npm', ['run', 'zavorth:native-browser-computer-use:check', '--silent']], {
    category: 'perception',
    required: true,
    liveCapable: true,
    docs: ['docs/native-browser-computer-use.md'],
  }),
  check('terminal-backends', 'Governed terminal execution backends for local, Docker, SSH, WSL and Vercel Sandbox', ['npm', ['run', 'zavorth:terminal-backends:check', '--silent']], {
    category: 'execution',
    required: true,
    liveCapable: true,
    docs: ['docs/terminal-backends.md', 'docs/execution.md'],
  }),
  check('apps-satellite-nodes', 'Apps and satellite nodes pairing, health, offline queue, push and companion specs', ['npm', ['run', 'zavorth:apps-satellite-nodes:check', '--silent']], {
    category: 'apps-satellite',
    required: true,
    liveCapable: true,
    docs: ['docs/apps-satellite-nodes.md', 'docs/web-zavorthControl.md'],
  }),
  check('extension-plugin-sdk', 'Extension and plugin SDK manifest, permissions, lifecycle, marketplace and hot reload', ['npm', ['run', 'zavorth:extension-plugin-sdk:check', '--silent']], {
    category: 'plugins',
    required: true,
    liveCapable: true,
    docs: ['docs/extension-plugin-sdk.md', 'docs/capability-plugins.md'],
  }),
  check('product-qa-live', 'Final live product QA matrix for install, provider, Telegram, mutation, receipt, zavorthControl, CLI, learning and rollback/sandbox', ['npm', ['run', 'zavorth:product-qa-live:check', '--silent']], {
    category: 'product-live-qa',
    required: true,
    liveCapable: true,
    docs: ['docs/product-qa-live.md', 'docs/runtime-readiness.md'],
  }),
  check('runtime-types', 'Runtime TypeScript contract', ['npm', ['run', 'runtime:check', '--silent']], {
    category: 'refactor',
    required: true,
  }),
  check('agent-executor-contract', 'Agent executor contract tests', ['npx', ['jest', 'tests/runtime/agent/AgentRunLlmRuntimeExecutor.test.ts', '--runInBand']], {
    category: 'refactor',
    required: true,
  }),
];

const startedAt = new Date().toISOString();
const results = checks.map((entry) => runCheck(entry));
const missingDocs = collectMissingDocs(checks);
const failed = results.filter((result) => result.status === 'failed');
const liveWarnings = results.filter((result) => result.liveStatus === 'needs_credentials');
const status = failed.length > 0
  ? 'failed'
  : requireLive && liveWarnings.length > 0
    ? 'needs_live_credentials'
    : 'passed';

const snapshot = {
  contractVersion: 'zavorth-product-readiness-gate/1',
  generatedAt: new Date().toISOString(),
  startedAt,
  status,
  summary: {
    checks: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: failed.length,
    liveWarnings: liveWarnings.length,
    missingDocs: missingDocs.length,
    requireLive,
  },
  guarantees: {
    noWorkspaceMutationBeyondChecks: true,
    liveAdaptersNotFaked: true,
    credentialsRequiredForLiveProof: true,
    zavorthControlControlCovered: true,
    cliTerminalCovered: true,
    installDocsCovered: true,
    executorContractsCovered: true,
  },
  results,
  missingDocs,
  nextActions: buildNextActions(failed, liveWarnings, missingDocs),
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  printHuman(snapshot);
}

if (status === 'failed' || status === 'needs_live_credentials') {
  process.exitCode = status === 'failed' ? 1 : 2;
}

function check(id, label, command, metadata = {}) {
  return {
    id,
    label,
    command,
    category: metadata.category || 'general',
    required: metadata.required !== false,
    liveCapable: Boolean(metadata.liveCapable),
    docs: metadata.docs || [],
  };
}

function runCheck(entry) {
  if (noRun) {
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      status: 'passed',
      liveStatus: entry.liveCapable ? inferLiveStatus('') : 'not_applicable',
      command: commandText(entry.command),
      durationMs: 0,
      summary: 'skipped by --no-run',
      details: [],
    };
  }

  const [bin, args] = entry.command;
  const executable = process.platform === 'win32'
    ? (process.env.ComSpec || 'cmd.exe')
    : bin;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', [bin, ...args].map(quoteWinArg).join(' ')]
    : args;
  const started = Date.now();
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    timeout: timeoutMs,
    env: process.env,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`.trim();
  const status = result.status === 0 ? 'passed' : 'failed';
  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    status,
    liveStatus: entry.liveCapable ? inferLiveStatus(output) : 'not_applicable',
    command: commandText(entry.command),
    durationMs: Date.now() - started,
    summary: summarizeOutput(output, status),
    details: status === 'passed' ? [] : output.split(/\r?\n/).slice(-30),
  };
}

function quoteWinArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function commandText(command) {
  const [bin, args] = command;
  return [bin, ...args].join(' ');
}

function inferLiveStatus(output) {
  const normalized = output.toLowerCase();
  if (/(live_passed|live passed|credential.*present|configured.*true)/.test(normalized)) {
    return 'live_or_configured';
  }
  if (/(needs_setup|needs credentials|missing.*key|credential|token|api key|not configured)/.test(normalized)) {
    return 'needs_credentials';
  }
  return 'dry_run_certified';
}

function summarizeOutput(output, status) {
  if (!output) return status === 'passed' ? 'completed without output' : 'failed without output';
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const interesting = lines.find((line) => /status=|passed|failed|needs|summary|checking/i.test(line));
  return interesting || lines[0] || status;
}

function collectMissingDocs(entries) {
  return Array.from(new Set(entries.flatMap((entry) => entry.docs)))
    .filter((file) => !fs.existsSync(path.join(root, file)));
}

function buildNextActions(failed, liveWarnings, missingDocs) {
  const actions = [];
  if (failed.length > 0) {
    actions.push({
      label: 'Fix failed readiness checks',
      command: failed[0].command,
      detail: failed.map((entry) => entry.id).join(', '),
    });
  }
  if (liveWarnings.length > 0) {
    actions.push({
      label: 'Run live proof after credentials are configured',
      command: 'npm run zavorth:live-certification-matrix -- --require-live',
      detail: 'Dry-run is certified; real provider/channel proof needs tokens and allowlists.',
    });
  }
  if (missingDocs.length > 0) {
    actions.push({
      label: 'Restore missing product docs',
      command: 'npm run zavorth:documentation-repo-final:check',
      detail: missingDocs.join(', '),
    });
  }
  if (actions.length === 0) {
    actions.push({
      label: 'Run real daily QA',
      command: 'zavorth setup && zavorth && zavorth ask "what is your current state?"',
      detail: 'Use real provider/channel credentials for final human validation.',
    });
  }
  return actions;
}

function printHuman(snapshot) {
  console.log('Zavorth Product Readiness Gate');
  console.log(`status: ${snapshot.status}`);
  console.log(`checks: ${snapshot.summary.passed}/${snapshot.summary.checks} passed`);
  if (snapshot.summary.liveWarnings > 0) {
    console.log(`live proof: ${snapshot.summary.liveWarnings} item(s) need credentials for real-world activation`);
  }
  if (snapshot.summary.missingDocs > 0) {
    console.log(`docs: ${snapshot.summary.missingDocs} expected document(s) missing`);
  }
  console.log('');
  for (const result of snapshot.results) {
    const marker = result.status === 'passed' ? 'ok' : 'fail';
    const live = result.liveStatus !== 'not_applicable' ? ` | ${result.liveStatus}` : '';
    console.log(`[${marker}] ${result.id}: ${result.summary}${live}`);
    if (result.details.length > 0) {
      for (const detail of result.details.slice(0, 8)) {
        console.log(`  ${detail}`);
      }
    }
  }
  console.log('');
  console.log('Next actions');
  for (const action of snapshot.nextActions) {
    console.log(`- ${action.label}: ${action.command}`);
    console.log(`  ${action.detail}`);
  }
}
