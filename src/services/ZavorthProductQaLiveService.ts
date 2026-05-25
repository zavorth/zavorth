import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_PRODUCT_QA_LIVE_CONTRACT_VERSION,
  type ZavorthProductQaLiveAction,
  type ZavorthProductQaLiveInput,
  type ZavorthProductQaLiveReadiness,
  type ZavorthProductQaLiveRow,
  type ZavorthProductQaLiveRowStatus,
  type ZavorthProductQaLiveSnapshot,
  type ZavorthProductQaLiveStatus,
  type ZavorthProductQaLiveSummary,
} from '../contracts/ZavorthProductQaLiveContract.js';

type ProductQaLiveDeps = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  cwd?: string;
  exists?: (file: string) => boolean;
};

const PROVIDER_ENV_GROUPS = [
  ['OPENAI_API_KEY'],
  ['ANTHROPIC_API_KEY'],
  ['GOOGLE_API_KEY'],
  ['GEMINI_API_KEY'],
  ['OPENROUTER_API_KEY'],
  ['GROQ_API_KEY'],
  ['MISTRAL_API_KEY'],
  ['DEEPSEEK_API_KEY'],
  ['XAI_API_KEY'],
  ['ZAVORTH_LLM_PROVIDER'],
  ['ZAVORTH_PROVIDER_READY'],
] as const;

const TELEGRAM_TOKEN_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'ZAVORTH_TELEGRAM_BOT_TOKEN',
] as const;

const TELEGRAM_ALLOWLIST_KEYS = [
  'TELEGRAM_ALLOWED_USER_IDS',
  'TELEGRAM_ALLOWED_CHAT_IDS',
  'ZAVORTH_TELEGRAM_ALLOWED_USERS',
  'ZAVORTH_TELEGRAM_ALLOWED_CHATS',
] as const;

export class ZavorthProductQaLiveService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly exists: (file: string) => boolean;

  public constructor(deps: ProductQaLiveDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.cwd = path.resolve(deps.cwd || process.cwd());
    this.exists = deps.exists || fs.existsSync;
  }

  public execute(input: ZavorthProductQaLiveInput = {}): ZavorthProductQaLiveSnapshot {
    const action = normalizeAction(input.action);
    const workspace = path.resolve(input.workspace || this.cwd);
    const requireLive = Boolean(input.requireLive || action === 'qa.require-live');
    const liveReadiness = this.buildLiveReadiness();
    const matrix = this.buildMatrix(liveReadiness);
    const summary = summarize(matrix);
    const status = resolveStatus(summary, requireLive);

    return {
      contractVersion: ZAVORTH_PRODUCT_QA_LIVE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthProductQaLiveService',
      action,
      status,
      workspace: normalizePath(workspace),
      requireLive,
      matrix,
      summary,
      liveReadiness,
      policy: {
        dryRunDoesNotClaimLiveProvider: true,
        dryRunDoesNotClaimLiveTelegram: true,
        secretsNeverSerialized: true,
        mutationRequiresApproval: true,
        rollbackSandboxRequired: true,
        receiptsRequired: true,
      },
      commands: {
        status: 'npm run zavorth:product-qa-live',
        json: 'npm run zavorth:product-qa-live:json',
        requireLive: 'npm run zavorth:product-qa-live -- --require-live',
        check: 'npm run zavorth:product-qa-live:check --silent',
        productGate: 'npm run zavorth:product-readiness:check --silent',
      },
      nextSafeAction: nextSafeAction(status, matrix),
    };
  }

  public formatSnapshotText(snapshot: ZavorthProductQaLiveSnapshot): string {
    const lines = [
      'Zavorth Product QA Live Matrix',
      '',
      `Status: ${snapshot.status}`,
      `Rows: ${snapshot.summary.passed} passed, ${snapshot.summary.dryRunCertified} dry-run certified, ${snapshot.summary.needsLiveCredentials} need live credentials, ${snapshot.summary.needsOperatorAction} need operator action`,
      `Require live: ${snapshot.requireLive}`,
      '',
      'Matrix:',
      ...snapshot.matrix.map((row) =>
        `- ${row.id}: ${row.status} | ${row.mode} | live=${row.liveProof} | ${row.nextSafeAction}`),
      '',
      'Live readiness:',
      `- Provider: ${snapshot.liveReadiness.providerConfigured ? 'configured' : 'needs credentials'}`,
      `- Telegram token: ${snapshot.liveReadiness.telegramTokenConfigured ? 'configured' : 'missing'}`,
      `- Telegram allowlist: ${snapshot.liveReadiness.telegramAllowlistConfigured ? 'configured' : 'missing'}`,
      `- Dashboard: ${snapshot.liveReadiness.dashboardCovered ? 'covered' : 'missing'}`,
      `- CLI: ${snapshot.liveReadiness.cliCovered ? 'covered' : 'missing'}`,
      `- Sandbox/rollback: ${snapshot.liveReadiness.sandboxCovered ? 'covered' : 'missing'}`,
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ];
    return lines.join('\n');
  }

  private buildLiveReadiness(): ZavorthProductQaLiveReadiness {
    return {
      providerConfigured: PROVIDER_ENV_GROUPS.some((group) => group.some((key) => hasEnv(this.env, key))),
      telegramTokenConfigured: TELEGRAM_TOKEN_KEYS.some((key) => hasEnv(this.env, key)),
      telegramAllowlistConfigured: TELEGRAM_ALLOWLIST_KEYS.some((key) => hasEnv(this.env, key)),
      dashboardCovered: this.hasAll(['scripts/zavorth-dashboard-final-product-polish-check.mjs', 'src/ai-gateway/app/(dashboard)/dashboard/useControlPageClient.ts']),
      cliCovered: this.hasAll(['scripts/zavorth-cli-final-product-polish-check.mjs', 'src/zavorth-cli.ts', 'bin/zavorth.js']),
      sandboxCovered: this.hasAll(['scripts/zavorth-sandbox-lifecycle.ts', 'scripts/zavorth-sandbox-lifecycle-check.mjs']),
      receiptsCovered: this.hasAll(['scripts/zavorth-live-readiness-evidence-proof-pack.ts', 'scripts/zavorth-live-readiness-evidence-proof-pack-check.mjs']),
      learningCovered: this.hasAll(['scripts/zavorth-native-learning-loop.ts', 'scripts/zavorth-native-learning-loop-check.mjs']),
      llmBrainCovered: this.hasAll(['src/contracts/ZavorthLlmBrainContract.ts', 'src/services/ZavorthLlmBrainService.ts']),
      sessionStreamingCovered: this.hasAll(['src/runtime/agent/AgentRunNativeToolLoopService.ts', 'src/runtime/agent/AgentRunService.ts']),
      longTailAdaptersCovered: this.hasAll(['src/adapters/channels/ChannelLongTailLiveClients.ts', 'src/adapters/providers/ProviderLongTailLiveClients.ts']),
    };
  }

  private buildMatrix(readiness: ZavorthProductQaLiveReadiness): ZavorthProductQaLiveRow[] {
    const telegramStatus: ZavorthProductQaLiveRowStatus = readiness.telegramTokenConfigured && readiness.telegramAllowlistConfigured
      ? 'passed'
      : readiness.telegramTokenConfigured
        ? 'needs-operator-action'
        : 'needs-live-credentials';

    return [
      row({
        id: 'fresh-install',
        label: 'Fresh install from public installer',
        status: this.hasAll(['scripts/install.sh', 'scripts/install.ps1', 'scripts/install-zavorth.sh', 'scripts/install-zavorth.ps1', 'docs/install.md', 'bin/zavorth.js'])
          ? 'dry-run-certified'
          : 'blocked',
        mode: 'local-proof',
        liveProof: 'optional',
        evidence: [
          evidence(this.has('scripts/install.sh'), 'Unix installer present'),
          evidence(this.has('scripts/install.ps1'), 'Windows installer present'),
          evidence(this.has('docs/install.md'), 'Install documentation present'),
          evidence(this.has('bin/zavorth.js'), 'Launcher entrypoint present'),
        ],
        commands: [
          'npm run installer-release:check',
          'bash scripts/install.sh --dry-run',
          'powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -DryRun',
        ],
        nextSafeAction: 'Run installer dry-run, then install in a clean user profile or VM.',
      }),
      row({
        id: 'real-provider',
        label: 'Real LLM provider proof',
        status: readiness.providerConfigured ? 'passed' : 'needs-live-credentials',
        mode: 'live-required',
        liveProof: 'required',
        evidence: [
          readiness.providerConfigured
            ? 'Provider credential signal is present; secret value was not serialized.'
            : 'No provider credential signal detected. Dry-run cannot claim real model access.',
        ],
        commands: [
          'zavorth setup',
          'zavorth providers doctor',
          'zavorth ask "what is your current state?"',
        ],
        requiredEnv: PROVIDER_ENV_GROUPS.flat(),
        nextSafeAction: readiness.providerConfigured
          ? 'Run a real prompt and verify provider receipt.'
          : 'Configure a provider key or local provider, then rerun with --require-live.',
      }),
      row({
        id: 'real-telegram',
        label: 'Real Telegram ChatOps proof',
        status: telegramStatus,
        mode: 'live-required',
        liveProof: 'required',
        evidence: [
          readiness.telegramTokenConfigured
            ? 'Telegram bot token signal is present; secret value was not serialized.'
            : 'Telegram bot token is missing.',
          readiness.telegramAllowlistConfigured
            ? 'Telegram allowlist signal is present.'
            : 'Telegram allowlist is missing; live inbound routing must not be trusted.',
        ],
        commands: [
          'zavorth channels telegram doctor',
          'zavorth channels telegram pair',
          'zavorth start telegram',
        ],
        requiredEnv: [...TELEGRAM_TOKEN_KEYS, ...TELEGRAM_ALLOWLIST_KEYS],
        nextSafeAction: telegramStatus === 'passed'
          ? 'Send a Telegram status message and verify a delivery receipt.'
          : 'Configure Telegram token and allowlist before claiming live ChatOps.',
      }),
      row({
        id: 'mutation-approval',
        label: 'Mutation approval and governed action cards',
        status: this.hasAll(['src/ai-gateway/app/api/experience/approvals/[id]/decision/route.ts'])
          && this.hasAny(['src/services/experience/ActionCardService.ts', 'src/services/ActionCardService.ts'])
          ? 'dry-run-certified'
          : 'blocked',
        mode: 'hybrid',
        liveProof: 'optional',
        evidence: [
          evidence(this.has('src/ai-gateway/app/api/experience/approvals/[id]/decision/route.ts'), 'Experience approval decision API present'),
          evidence(this.hasAny(['src/services/experience/ActionCardService.ts', 'src/services/ActionCardService.ts']), 'Action cards service present'),
        ],
        commands: [
          'zavorth approve',
          'zavorth ask "prepare a tiny README edit, but do not apply without approval"',
        ],
        nextSafeAction: 'Create a safe mutation request and approve/reject it through CLI or /dashboard.',
      }),
      row({
        id: 'receipt',
        label: 'Receipts and evidence proof',
        status: readiness.receiptsCovered ? 'dry-run-certified' : 'blocked',
        mode: 'local-proof',
        liveProof: 'not-required',
        evidence: [
          evidence(readiness.receiptsCovered, 'Live readiness evidence proof pack present'),
        ],
        commands: [
          'npm run zavorth:live-readiness-evidence-proof-pack:check --silent',
          'zavorth inspect',
        ],
        nextSafeAction: 'Inspect the latest run receipt after a real prompt.',
      }),
      row({
        id: 'dashboard',
        label: 'Dashboard /dashboard',
        status: readiness.dashboardCovered ? 'dry-run-certified' : 'blocked',
        mode: 'hybrid',
        liveProof: 'optional',
        evidence: [
          evidence(readiness.dashboardCovered, 'Dashboard final product polish check and /dashboard client are present'),
        ],
        commands: [
          'npm run zavorth:dashboard-final-product-polish:check --silent',
          'zavorth open',
        ],
        nextSafeAction: 'Open /dashboard and verify chat, approvals, receipts, learning and dashboard health.',
      }),
      row({
        id: 'cli',
        label: 'CLI terminal daily path',
        status: readiness.cliCovered ? 'dry-run-certified' : 'blocked',
        mode: 'local-proof',
        liveProof: 'not-required',
        evidence: [
          evidence(readiness.cliCovered, 'CLI final polish check, source and launcher are present'),
        ],
        commands: [
          'npm run zavorth:cli-final-product-polish:check --silent',
          'zavorth',
          'zavorth ask "what is your current state?"',
        ],
        nextSafeAction: 'Run the CLI in a clean terminal and verify the chat-first daily path.',
      }),
      row({
        id: 'llm-brain-session',
        label: 'LLM-first session, stream and tool loop',
        status: readiness.llmBrainCovered && readiness.sessionStreamingCovered ? 'dry-run-certified' : 'blocked',
        mode: 'hybrid',
        liveProof: 'optional',
        evidence: [
          evidence(readiness.llmBrainCovered, 'LLM Brain maturity projection present'),
          evidence(readiness.sessionStreamingCovered, 'Native tool loop and run service stream hooks present'),
        ],
        commands: [
          'zavorth chat',
          'zavorth ask "read the README and summarize what you observed"',
        ],
        nextSafeAction: 'Run a long interactive chat and verify lifecycle, assistant, tool, approval and receipt events.',
      }),
      row({
        id: 'learning-candidate',
        label: 'Mnemos learning candidate',
        status: readiness.learningCovered ? 'dry-run-certified' : 'blocked',
        mode: 'hybrid',
        liveProof: 'optional',
        evidence: [
          evidence(readiness.learningCovered, 'Native learning loop service and check are present'),
        ],
        commands: [
          'npm run zavorth:native-learning-loop:check --silent',
          'zavorth learn',
        ],
        nextSafeAction: 'Complete a real successful run, then review the generated learning candidate.',
      }),
      row({
        id: 'long-tail-adapters',
        label: 'Long-tail provider and channel adapters',
        status: readiness.longTailAdaptersCovered ? 'dry-run-certified' : 'blocked',
        mode: 'hybrid',
        liveProof: 'required',
        evidence: [
          evidence(readiness.longTailAdaptersCovered, 'Long-tail channel and provider live adapter families present'),
          'Adapters remain proof-gated: configured credentials and receipts are required before live claims.',
        ],
        commands: [
          'zavorth native catalog',
          'zavorth channels doctor',
          'zavorth providers doctor',
        ],
        nextSafeAction: 'Configure one long-tail provider/channel and capture a real send/read or model-call receipt.',
      }),
      row({
        id: 'rollback-sandbox',
        label: 'Rollback and sandbox validation',
        status: readiness.sandboxCovered ? 'dry-run-certified' : 'blocked',
        mode: 'hybrid',
        liveProof: 'optional',
        evidence: [
          evidence(readiness.sandboxCovered, 'Sandbox lifecycle scripts and checks are present'),
        ],
        commands: [
          'npm run zavorth:sandbox-lifecycle:check --silent',
          'zavorth sandbox list',
        ],
        nextSafeAction: 'Run a sandbox lifecycle check before approving host mutations.',
      }),
    ];
  }

  private has(file: string): boolean {
    return this.exists(path.join(this.cwd, file));
  }

  private hasAll(files: string[]): boolean {
    return files.every((file) => this.has(file));
  }

  private hasAny(files: string[]): boolean {
    return files.some((file) => this.has(file));
  }
}

function normalizeAction(action?: ZavorthProductQaLiveInput['action']): ZavorthProductQaLiveAction {
  switch (action) {
    case 'matrix':
    case 'qa.matrix':
      return 'qa.matrix';
    case 'require-live':
    case 'qa.require-live':
      return 'qa.require-live';
    case 'receipts':
    case 'qa.receipts':
      return 'qa.receipts';
    case 'status':
    case 'qa.status':
    default:
      return 'qa.status';
  }
}

function row(input: Omit<ZavorthProductQaLiveRow, 'requiredEnv' | 'receiptsRequired' | 'secretValuesSerialized'> & { requiredEnv?: readonly string[] }): ZavorthProductQaLiveRow {
  return {
    ...input,
    requiredEnv: Array.from(input.requiredEnv || []),
    receiptsRequired: true,
    secretValuesSerialized: false,
  };
}

function evidence(ok: boolean, label: string): string {
  return `${ok ? 'present' : 'missing'}: ${label}`;
}

function summarize(matrix: ZavorthProductQaLiveRow[]): ZavorthProductQaLiveSummary {
  return {
    total: matrix.length,
    passed: count(matrix, 'passed'),
    dryRunCertified: count(matrix, 'dry-run-certified'),
    needsLiveCredentials: count(matrix, 'needs-live-credentials'),
    needsOperatorAction: count(matrix, 'needs-operator-action'),
    blocked: count(matrix, 'blocked'),
    liveRequired: matrix.filter((rowItem) => rowItem.liveProof === 'required').length,
  };
}

function count(matrix: ZavorthProductQaLiveRow[], status: ZavorthProductQaLiveRowStatus): number {
  return matrix.filter((rowItem) => rowItem.status === status).length;
}

function resolveStatus(summary: ZavorthProductQaLiveSummary, requireLive: boolean): ZavorthProductQaLiveStatus {
  if (summary.blocked > 0) return 'blocked';
  if (!requireLive) return 'passed';
  if (summary.needsLiveCredentials > 0) return 'needs-live-credentials';
  if (summary.needsOperatorAction > 0) return 'needs-operator-action';
  return 'passed';
}

function nextSafeAction(status: ZavorthProductQaLiveStatus, matrix: ZavorthProductQaLiveRow[]): string {
  if (status === 'blocked') {
    const blocked = matrix.find((rowItem) => rowItem.status === 'blocked');
    return blocked ? blocked.nextSafeAction : 'Fix blocked QA row before live rollout.';
  }
  if (status === 'needs-live-credentials') {
    return 'Configure real provider and Telegram credentials, then run npm run zavorth:product-qa-live -- --require-live.';
  }
  if (status === 'needs-operator-action') {
    return 'Finish operator allowlists or pairing, then rerun the live QA matrix.';
  }
  return 'Run product gate and then perform the manual clean-install/live-provider/live-Telegram QA pass.';
}

function hasEnv(env: Record<string, string | undefined>, key: string): boolean {
  const value = env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
