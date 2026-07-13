const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENV_PROFILES = [
  { id: 'github', keys: ['GITHUB_TOKEN', 'GH_TOKEN'], plugin: 'github', tip: 'Set GITHUB_TOKEN or run: gh auth login' },
  { id: 'openai', keys: ['OPENAI_API_KEY'], plugin: null, tip: 'Set OPENAI_API_KEY for OpenAI providers' },
  { id: 'anthropic', keys: ['ANTHROPIC_API_KEY'], plugin: null, tip: 'Set ANTHROPIC_API_KEY for Claude providers' },
  { id: 'xai', keys: ['XAI_API_KEY', 'GROK_API_KEY'], plugin: null, tip: 'Set XAI_API_KEY for xAI/Grok providers' },
  { id: 'linear', keys: ['LINEAR_API_KEY'], plugin: 'linear', tip: 'Set LINEAR_API_KEY for Linear bridge' },
  { id: 'notion', keys: ['NOTION_API_KEY', 'NOTION_TOKEN'], plugin: 'notion', tip: 'Set NOTION_API_KEY for Notion bridge' },
  { id: 'gmail', keys: ['GMAIL_CLIENT_ID', 'GOOGLE_CLIENT_ID'], plugin: 'gmail', tip: 'Configure Google OAuth for Gmail bridge' },
  { id: 'slack', keys: ['SLACK_WEBHOOK_URL', 'SLACK_BOT_TOKEN'], plugin: 'notify-outbox', tip: 'Set SLACK_WEBHOOK_URL for notify-outbox deliver' },
  { id: 'discord', keys: ['DISCORD_WEBHOOK_URL'], plugin: 'notify-outbox', tip: 'Set DISCORD_WEBHOOK_URL for notify-outbox deliver' },
  { id: 'searxng', keys: ['SEARXNG_URL', 'SEARXNG_BASE_URL'], plugin: 'web-search', tip: 'Set SEARXNG_URL for local web search' },
  { id: 'exa', keys: ['EXA_API_KEY'], plugin: 'web-search', tip: 'Set EXA_API_KEY for Exa search' },
];

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('doctor.run', async ({ input }) => {
    try {
      const deep = Boolean(input && (input.deep === true || input.mode === 'deep'));
      const report = buildReport(workspace, { deep });
      return {
        output: report,
        receipts: ['workspace-doctor.receipt'],
      };
    } catch (error) {
      logger.warn('doctor.run failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          checks: [],
          nextSteps: ['Retry doctor.run; if it keeps failing, check filesystem permissions on the workspace.'],
        },
      };
    }
  });

  ctx.bindCapability('doctor.env', async () => {
    try {
      return { output: buildEnvProfile() };
    } catch (error) {
      logger.warn('doctor.env failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          profiles: [],
        },
      };
    }
  });

  logger.info('workspace-doctor registered', { workspace });
}

function buildReport(workspace, options) {
  const checks = [];
  const push = (check) => checks.push(check);

  push(checkNode());
  push(checkCommand('git', ['--version'], 'Git is required for PR/CI workflows'));
  push(checkCommand('gh', ['--version'], 'Install GitHub CLI: https://cli.github.com/'));
  push(checkCommand('docker', ['version', '--format', '{{.Server.Version}}'], 'Optional: Docker for sandboxed runs'));
  push(checkPath('workspace', workspace, true));
  push(checkPath('.zavorth', path.join(workspace, '.zavorth'), false));
  push(checkPath('plugins/', path.join(workspace, 'plugins'), false));
  push(checkPath('package.json', path.join(workspace, 'package.json'), true));
  push(checkGitRepo(workspace));
  push(checkPluginCount(workspace));

  const env = buildEnvProfile();
  push({
    id: 'env-keys',
    ok: true,
    severity: 'info',
    message: `${env.presentCount}/${env.profiles.length} integration profiles have at least one key set`,
    detail: {
      present: env.profiles.filter((p) => p.present).map((p) => p.id),
      missingOptional: env.profiles.filter((p) => !p.present).map((p) => p.id),
    },
  });

  if (options.deep) {
    push(checkFileReadable(path.join(workspace, 'config', 'plugin-marketplace-curated.json'), 'Plugin marketplace catalog'));
    push(checkFileReadable(path.join(workspace, 'docs', 'plugin-os.md'), 'Plugin OS docs'));
  }

  const failed = checks.filter((c) => c.ok === false && c.severity === 'error');
  const warnings = checks.filter((c) => c.ok === false || c.severity === 'warn');
  const nextSteps = buildNextSteps(checks, env);

  return {
    ok: failed.length === 0,
    healthy: failed.length === 0 && warnings.filter((c) => c.severity === 'error').length === 0,
    workspace,
    checkedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      pass: checks.filter((c) => c.ok).length,
      warn: checks.filter((c) => c.severity === 'warn').length,
      error: failed.length,
    },
    checks,
    env,
    nextSteps,
    message:
      failed.length === 0
        ? 'Workspace looks ready. Review nextSteps for optional upgrades.'
        : 'Some required checks failed — follow nextSteps to unblock onboarding.',
  };
}

function buildEnvProfile() {
  const profiles = ENV_PROFILES.map((profile) => {
    const presentKeys = profile.keys.filter((key) => Boolean(String(process.env[key] || '').trim()));
    return {
      id: profile.id,
      plugin: profile.plugin,
      present: presentKeys.length > 0,
      presentKeys,
      // Never return secret values — only key names.
      tip: profile.tip,
    };
  });
  return {
    ok: true,
    profiles,
    presentCount: profiles.filter((p) => p.present).length,
    note: 'Values are never returned; only key presence.',
  };
}

function buildNextSteps(checks, env) {
  const steps = [];
  for (const check of checks) {
    if (!check.ok && check.tip) {
      steps.push(check.tip);
    }
  }
  for (const profile of env.profiles) {
    if (!profile.present && ['github', 'xai', 'openai', 'anthropic'].includes(profile.id)) {
      steps.push(profile.tip);
    }
  }
  if (steps.length === 0) {
    steps.push('Enable the Daily Ops pack plugins if not already on: task-board, pr-ship, ci-watch, secrets-guardian, session-recall, notify-outbox.');
    steps.push('Try: doctor.env to see optional SaaS keys you may want later.');
  }
  return unique(steps).slice(0, 12);
}

function checkNode() {
  return {
    id: 'node',
    ok: true,
    severity: 'info',
    message: `Node ${process.version}`,
    detail: { version: process.version, platform: process.platform, arch: process.arch },
  };
}

function checkCommand(bin, args, tip) {
  try {
    const result = spawnSync(bin, args, {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
      env: process.env,
    });
    if (result.error && (result.error.code === 'ENOENT' || /not found/iu.test(String(result.error.message)))) {
      return {
        id: bin,
        ok: false,
        severity: bin === 'docker' ? 'warn' : bin === 'gh' ? 'warn' : 'error',
        message: `${bin} not found on PATH`,
        tip,
      };
    }
    const out = String(result.stdout || result.stderr || '').trim().split(/\r?\n/u)[0] || `${bin} available`;
    return {
      id: bin,
      ok: result.status === 0 || bin === 'docker',
      severity: result.status === 0 ? 'info' : 'warn',
      message: out.slice(0, 200),
      tip: result.status === 0 ? null : tip,
    };
  } catch (error) {
    return {
      id: bin,
      ok: false,
      severity: 'warn',
      message: error instanceof Error ? error.message : String(error),
      tip,
    };
  }
}

function checkPath(id, target, required) {
  const exists = fs.existsSync(target);
  return {
    id: `path:${id}`,
    ok: exists || !required,
    severity: exists ? 'info' : required ? 'error' : 'warn',
    message: exists ? `Found ${id}` : `Missing ${id}`,
    tip: exists ? null : required ? `Create or open a valid workspace containing ${id}` : `Optional path missing: ${id}`,
    detail: { path: target },
  };
}

function checkGitRepo(workspace) {
  const gitDir = path.join(workspace, '.git');
  const ok = fs.existsSync(gitDir);
  return {
    id: 'git-repo',
    ok,
    severity: ok ? 'info' : 'warn',
    message: ok ? 'Git repository detected' : 'Not a git repository (PR/CI plugins will be limited)',
    tip: ok ? null : 'Run git init or open a cloned repository for pr-ship / ci-watch',
  };
}

function checkPluginCount(workspace) {
  const pluginsRoot = path.join(workspace, 'plugins');
  if (!fs.existsSync(pluginsRoot)) {
    return {
      id: 'plugin-count',
      ok: false,
      severity: 'warn',
      message: 'plugins/ directory not found',
      tip: 'Ensure you are in the Zavorth project root',
    };
  }
  let count = 0;
  try {
    for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'examples') continue;
      if (fs.existsSync(path.join(pluginsRoot, entry.name, 'manifest.json'))) {
        count += 1;
      }
    }
  } catch {
    count = 0;
  }
  return {
    id: 'plugin-count',
    ok: count > 0,
    severity: count > 0 ? 'info' : 'warn',
    message: `${count} first-party plugin package(s) with manifests`,
    detail: { count },
  };
}

function checkFileReadable(filePath, label) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return {
      id: `file:${path.basename(filePath)}`,
      ok: true,
      severity: 'info',
      message: `${label} readable`,
    };
  } catch {
    return {
      id: `file:${path.basename(filePath)}`,
      ok: false,
      severity: 'warn',
      message: `${label} not readable`,
      tip: `Expected file at ${filePath}`,
    };
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

module.exports = { register };
