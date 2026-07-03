import fs from 'fs';
import path from 'path';
import type {
  ZavorthDoctorPremiumCheck,
  ZavorthDoctorPremiumSnapshot,
  ZavorthDoctorPremiumStatus,
} from './ZavorthDoctorPremiumTypes.js';
import {
  fileExists,
  parseMajor,
  readEnvFile,
  redactValue,
} from './checks/ZavorthDoctorCheckUtils.js';

export type BuildZavorthDoctorPremiumInput = {
  projectRoot: string;
  now?: () => Date;
};

export function buildZavorthDoctorPremiumSnapshot(
  input: BuildZavorthDoctorPremiumInput,
): ZavorthDoctorPremiumSnapshot {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const env = readEnvFile(projectRoot);
  const checks = [
    checkNodeRuntime(),
    checkWorkspace(projectRoot),
    checkProvider(projectRoot, env),
    checkGateway(projectRoot, env),
    checkZavorthControl(projectRoot),
    checkTelegram(env),
    checkSandboxAndEffectBoundary(projectRoot),
    checkTrustAndSecrets(projectRoot, env),
    checkLocalStorage(projectRoot),
    checkGatewayConnectivity(env),
    checkSqliteIntegrity(projectRoot),
  ];
  const summary = {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
    total: checks.length,
  };
  const status: ZavorthDoctorPremiumStatus = summary.fail > 0 ? 'fail' : summary.warn > 0 ? 'warn' : 'pass';

  return {
    contractVersion: 'zavorth-doctor-premium/1',
    generatedAt: (input.now || (() => new Date()))().toISOString(),
    projectRoot,
    status,
    summary,
    checks,
    nextActions: buildNextActions(checks),
    safety: {
      noSecretInOutput: true,
      noRuntimeStart: true,
      fixRequiresExplicitFlag: true,
    },
  };
}

function checkGatewayConnectivity(env: Record<string, string>): ZavorthDoctorPremiumCheck {
  const endpointKeys = ['SLACK_WEBHOOK_URL', 'DISCORD_WEBHOOK_URL', 'WHATSAPP_BRIDGE_URL', 'MATRIX_BASE_URL', 'TEAMS_WEBHOOK_URL'];
  const configured = endpointKeys.flatMap((key) => {
    const value = String(env[key] || process.env[key] || '').trim();
    return value ? [{ key, value }] : [];
  });
  const invalid = configured.filter(({ value }) => {
    try { const url = new URL(value); return url.protocol !== 'https:' && url.protocol !== 'http:'; } catch { return true; }
  });
  return {
    id: 'gateway-connectivity', title: 'Gateway connectivity',
    status: invalid.length ? 'fail' : 'pass',
    summary: invalid.length ? `Invalid gateway endpoint(s): ${invalid.map(({ key }) => key).join(', ')}.` : configured.length ? `${configured.length} configured gateway endpoint(s) have valid HTTP(S) URLs.` : 'No outbound gateway endpoint is configured.',
    impact: invalid.length ? 'Configured channel delivery cannot reach its declared endpoint.' : 'Endpoint syntax is safe for a later governed delivery health check.',
    fixCommand: invalid.length ? 'Correct the invalid gateway URL in .env, then rerun zavorth doctor.' : null,
    canAutoFix: false,
    evidence: configured.map(({ key }) => `${key}=${invalid.some((item) => item.key === key) ? 'invalid' : 'valid'}`),
  };
}

function checkSqliteIntegrity(projectRoot: string): ZavorthDoctorPremiumCheck {
  const dataRoot = path.join(projectRoot, 'data');
  const databases = fs.existsSync(dataRoot) ? fs.readdirSync(dataRoot, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && /\.(?:db|sqlite)$/i.test(entry))
    .map((entry) => path.join(dataRoot, entry)) : [];
  if (databases.length === 0) return { id: 'sqlite-integrity', title: 'SQLite integrity', status: 'pass', summary: 'No local SQLite database exists yet.', impact: 'The database integrity check will run automatically after a local database is created.', fixCommand: null, canAutoFix: false, evidence: ['databases=0'] };
  try {
    const Database = require('better-sqlite3');
    const failures = databases.flatMap((databasePath) => {
      const db = new Database(databasePath, { readonly: true });
      try { const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string }; return row.integrity_check === 'ok' ? [] : [path.basename(databasePath)]; } finally { db.close(); }
    });
    return { id: 'sqlite-integrity', title: 'SQLite integrity', status: failures.length ? 'fail' : 'pass', summary: failures.length ? `Integrity check failed: ${failures.join(', ')}.` : `${databases.length} SQLite database(s) passed integrity_check.`, impact: failures.length ? 'Local state may be corrupted and should be restored from a known-good backup.' : 'Local agent state is structurally readable.', fixCommand: failures.length ? 'Restore the affected database from backup before using governed writes.' : null, canAutoFix: false, evidence: databases.map((databasePath) => `database=${path.basename(databasePath)}`) };
  } catch (error) {
    return { id: 'sqlite-integrity', title: 'SQLite integrity', status: 'warn', summary: 'SQLite integrity check could not run.', impact: 'Database health is not verified until the SQLite driver is available.', fixCommand: 'npm install, then rerun zavorth doctor.', canAutoFix: false, evidence: [`reason=${error instanceof Error ? error.message.slice(0, 96) : 'unknown'}`] };
  }
}

function checkLocalStorage(projectRoot: string): ZavorthDoctorPremiumCheck {
  const storageRoot = path.join(projectRoot, 'data');
  try {
    fs.accessSync(projectRoot, fs.constants.R_OK | fs.constants.W_OK);
    if (fs.existsSync(storageRoot)) {
      fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
    }
    return {
      id: 'local-storage',
      title: 'Local storage',
      status: 'pass',
      summary: fs.existsSync(storageRoot) ? 'Project and local data storage are readable and writable.' : 'Project is writable; local data storage will be created on demand.',
      impact: 'Memory, audit receipts and local channel outboxes can persist safely.',
      fixCommand: null,
      canAutoFix: false,
      evidence: [`projectRoot=read-write`, `data=${fs.existsSync(storageRoot) ? 'read-write' : 'created-on-demand'}`],
    };
  } catch {
    return {
      id: 'local-storage',
      title: 'Local storage',
      status: 'fail',
      summary: 'Project or local data storage is not writable.',
      impact: 'Memory, audit receipts and channel outboxes may fail to persist.',
      fixCommand: 'Grant the current user write permission to the Zavorth project and data directory, then rerun zavorth doctor.',
      canAutoFix: false,
      evidence: ['storage=not-writable'],
    };
  }
}

function checkNodeRuntime(): ZavorthDoctorPremiumCheck {
  const major = parseMajor(process.version);
  const ok = major >= 20;
  return {
    id: 'node-runtime',
    title: 'Node runtime',
    status: ok ? 'pass' : 'fail',
    summary: ok ? `Node ${process.version} is supported.` : `Node ${process.version} is too old for Zavorth daily runtime.`,
    impact: ok ? 'CLI, zavorthControl and local runtime can execute TypeScript/Node tooling.' : 'Setup, zavorthControl and provider tooling may fail before the agent starts.',
    fixCommand: ok ? null : 'Install Node 22 LTS or newer, then rerun zavorth doctor.',
    canAutoFix: false,
    evidence: [`node=${process.version}`],
  };
}

function checkWorkspace(projectRoot: string): ZavorthDoctorPremiumCheck {
  const required = ['package.json', 'src', 'scripts'];
  const missing = required.filter((entry) => !fileExists(projectRoot, entry));
  return {
    id: 'workspace',
    title: 'Workspace',
    status: missing.length === 0 ? 'pass' : 'fail',
    summary: missing.length === 0 ? 'Zavorth workspace shape detected.' : `Missing workspace entries: ${missing.join(', ')}`,
    impact: missing.length === 0 ? 'Commands can resolve project files and scripts.' : 'CLI may be running outside the Zavorth root.',
    fixCommand: missing.length === 0 ? null : 'cd "<zavorth-root>"',
    canAutoFix: false,
    evidence: [`root=${projectRoot}`],
  };
}

function checkProvider(projectRoot: string, env: Record<string, string>): ZavorthDoctorPremiumCheck {
  const provider = env.ZAVORTH_DEFAULT_PROVIDER || env.DEFAULT_LLM_PROVIDER || '';
  const keyCandidates = [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
    'DEEPSEEK_API_KEY',
  ];
  const configuredKeys = keyCandidates.filter((key) => Boolean(env[key] || process.env[key]));
  const status: ZavorthDoctorPremiumStatus = provider ? configuredKeys.length > 0 || provider === 'local' ? 'pass' : 'warn' : 'warn';
  return {
    id: 'provider',
    title: 'Model provider',
    status,
    summary: provider
      ? `Provider selected: ${provider}${configuredKeys.length > 0 ? ` (${configuredKeys.map((key) => `${key}=${redactValue(env[key] || process.env[key] || '')}`).join(', ')})` : ''}`
      : 'No default provider selected yet.',
    impact: status === 'pass'
      ? 'The LLM path has enough configuration to start normal agent work.'
      : 'Natural language may not reach a live LLM until setup is completed.',
    fixCommand: 'zavorth setup',
    canAutoFix: false,
    evidence: [
      `envFile=${fileExists(projectRoot, '.env') ? 'present' : 'missing'}`,
      `provider=${provider || 'missing'}`,
    ],
  };
}

function checkGateway(projectRoot: string, env: Record<string, string>): ZavorthDoctorPremiumCheck {
  const hasToken = Boolean(env.ZAVORTH_WEB_AUTH_TOKEN || env.ZAVORTH_GATEWAY_TOKEN || process.env.ZAVORTH_WEB_AUTH_TOKEN || process.env.ZAVORTH_GATEWAY_TOKEN);
  const hasGatewayCode = fileExists(projectRoot, 'src/host.ts') || fileExists(projectRoot, 'src/index.ts');
  return {
    id: 'gateway',
    title: 'Runtime gateway',
    status: hasGatewayCode ? hasToken ? 'pass' : 'warn' : 'fail',
    summary: hasGatewayCode
      ? hasToken ? 'Gateway code and local token source detected.' : 'Gateway code detected, but no local auth token was found.'
      : 'Gateway entrypoint was not found.',
    impact: hasToken ? 'CLI and zavorthControl can authenticate against local runtime when it is running.' : 'ZavorthControl/API may ask for token or reject local requests.',
    fixCommand: hasGatewayCode ? 'zavorth zavorthControl repair' : 'npm run runtime:check',
    canAutoFix: false,
    evidence: [`token=${hasToken ? 'present' : 'missing'}`],
  };
}

function checkZavorthControl(projectRoot: string): ZavorthDoctorPremiumCheck {
  const hasZavorthControl = fileExists(projectRoot, 'src/ai-gateway/app/(zavorthControl)/zavorthControl')
    || fileExists(projectRoot, 'src/ai-gateway/app/(zavorthControl)/zavorthControl');
  return {
    id: 'zavorthControl',
    title: 'ZavorthControl',
    status: hasZavorthControl ? 'pass' : 'warn',
    summary: hasZavorthControl ? 'ZavorthControl source is present.' : 'ZavorthControl source was not found in the expected app path.',
    impact: hasZavorthControl ? 'zavorth open can route the operator to the visual control plane.' : 'The CLI can work, but visual control may be unavailable.',
    fixCommand: hasZavorthControl ? 'zavorth open' : 'npm run ai-gateway:check',
    canAutoFix: false,
  };
}

function checkTelegram(env: Record<string, string>): ZavorthDoctorPremiumCheck {
  const hasToken = Boolean(env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const hasAllowlist = Boolean(env.TELEGRAM_ALLOWED_USER_IDS || process.env.TELEGRAM_ALLOWED_USER_IDS);
  return {
    id: 'telegram',
    title: 'Telegram channel',
    status: hasToken && hasAllowlist ? 'pass' : hasToken ? 'warn' : 'warn',
    summary: hasToken
      ? hasAllowlist ? 'Telegram token and user allowlist detected.' : 'Telegram token detected without user allowlist.'
      : 'Telegram is not configured.',
    impact: hasToken && hasAllowlist
      ? 'Remote ChatOps can be used with an operator boundary.'
      : 'Telegram should not be treated as ready for safe daily use yet.',
    fixCommand: 'zavorth channels telegram',
    canAutoFix: false,
  };
}

function checkSandboxAndEffectBoundary(projectRoot: string): ZavorthDoctorPremiumCheck {
  const required = [
    'src/security/EffectPolicyKernel.ts',
    'src/tools/governance/ToolEffectMapper.ts',
    'src/runtime/rehearsal/RehearsalRunner.ts',
    'src/runtime/commit/CommitExecutor.ts',
    'scripts/effect-boundary-invariants-check.mjs',
  ];
  const missing = required.filter((entry) => !fileExists(projectRoot, entry));
  return {
    id: 'effect-boundary',
    title: 'Effect Boundary',
    status: missing.length === 0 ? 'pass' : 'fail',
    summary: missing.length === 0 ? 'Effect Boundary contracts and invariant check are present.' : `Missing effect boundary files: ${missing.join(', ')}`,
    impact: missing.length === 0
      ? 'LLM tool use can stay intelligent while side effects are governed.'
      : 'Side-effect governance may regress into unsafe execution or overblocking.',
    fixCommand: 'npm run effect-boundary:check',
    canAutoFix: false,
  };
}

function checkTrustAndSecrets(projectRoot: string, env: Record<string, string>): ZavorthDoctorPremiumCheck {
  const secretLikeKeys = Object.keys(env).filter((key) =>
    /(TOKEN|SECRET|API_KEY|PASSWORD)/i.test(key) && !/MAX_TOKENS?/i.test(key));
  const hasSecurityDocs = fileExists(projectRoot, 'docs/security.md');
  const status: ZavorthDoctorPremiumStatus = !hasSecurityDocs ? 'fail' : secretLikeKeys.length > 0 ? 'warn' : 'pass';
  return {
    id: 'trust-secrets',
    title: 'Trust and secrets',
    status,
    summary: secretLikeKeys.length > 0
      ? `${secretLikeKeys.length} secret-like .env key(s) detected; output is redacted.`
      : 'No secret-like .env keys detected by the premium doctor.',
    impact: secretLikeKeys.length > 0
      ? 'Secrets in .env can be read by tools that can inspect workspace files; prefer secret refs when available.'
      : 'Secret exposure risk from .env appears low.',
    fixCommand: secretLikeKeys.length > 0 ? 'zavorth doctor security' : null,
    canAutoFix: false,
    evidence: secretLikeKeys.map((key) => `${key}=${redactValue(env[key])}`),
  };
}

function buildNextActions(checks: ZavorthDoctorPremiumCheck[]): ZavorthDoctorPremiumSnapshot['nextActions'] {
  const failing = checks.find((check) => check.status === 'fail' && check.fixCommand);
  const warning = checks.find((check) => check.status === 'warn' && check.fixCommand);
  return [
    failing ? { label: `Fix ${failing.title}`, command: failing.fixCommand as string, detail: failing.impact } : null,
    warning ? { label: `Review ${warning.title}`, command: warning.fixCommand as string, detail: warning.impact } : null,
    { label: 'Run setup', command: 'zavorth setup', detail: 'guided provider/channel/trust setup' },
    { label: 'Open ZavorthControl', command: 'zavorth open' },
  ].filter(Boolean) as ZavorthDoctorPremiumSnapshot['nextActions'];
}
