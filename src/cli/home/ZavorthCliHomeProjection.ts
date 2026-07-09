import fs from 'fs';
import path from 'path';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import { readEnvFile } from '../doctor/checks/ZavorthDoctorCheckUtils.js';
import type { ZavorthCliHomeSnapshot, ZavorthCliHomeStatus } from './ZavorthCliHomeTypes.js';
import { logger } from '../../logger.js';

export type BuildZavorthCliHomeSnapshotInput = {
  projectRoot: string;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export function buildZavorthCliHomeSnapshot(
  input: BuildZavorthCliHomeSnapshotInput,
): ZavorthCliHomeSnapshot {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const env = readEnvFile(projectRoot);
  const packageVersion = readPackageVersion(projectRoot);
  const mutationPlane = input.mutationPlane === null
    ? null
    : input.mutationPlane || new ZavorthMutationPlaneService();
  const pendingPlans = safePendingPlans(mutationPlane);
  const providerId = env.ZAVORTH_DEFAULT_PROVIDER || env.DEFAULT_LLM_PROVIDER || null;
  const providerModel = resolveProviderModel(env, providerId);
  const providerConfigured = Boolean(providerId && (providerId === 'local' || hasAnyProviderCredential(env, providerId)));
  const telegram = env.TELEGRAM_BOT_TOKEN
    ? env.TELEGRAM_ALLOWED_USER_IDS ? 'ready' : 'needs-allowlist'
    : 'not-configured';
  const discord = env.DISCORD_BOT_TOKEN ? 'ready' : 'not-configured';
  const effectBoundary = fs.existsSync(path.join(projectRoot, 'src', 'security', 'EffectPolicyKernel.ts'))
    && fs.existsSync(path.join(projectRoot, 'scripts', 'effect-boundary-invariants-check.mjs'))
    ? 'ready'
    : 'missing';
  const zavorthControl = fs.existsSync(path.join(projectRoot, 'src', 'ai-gateway', 'app', '(zavorthControl)', 'control'))
    ? 'available'
    : 'missing';
  const gatewayToken = env.ZAVORTH_WEB_AUTH_TOKEN || env.ZAVORTH_GATEWAY_TOKEN || process.env.ZAVORTH_WEB_AUTH_TOKEN || process.env.ZAVORTH_GATEWAY_TOKEN
    ? 'present'
    : 'missing';
  const status = resolveHomeStatus({
    providerConfigured,
    pendingApprovals: pendingPlans.length,
    effectBoundary,
  });

  return {
    contractVersion: 'zavorth-cli-home/1',
    generatedAt: (input.now || (() => new Date()))().toISOString(),
    projectRoot,
    status,
    headline: buildHeadline(status, providerConfigured, pendingPlans.length),
    runtime: {
      node: process.version,
      packageVersion,
      gatewayToken,
      zavorthControl,
    },
    provider: {
      id: providerId,
      model: providerModel,
      configured: providerConfigured,
    },
    channels: {
      telegram,
      discord,
    },
    approvals: {
      pending: pendingPlans.length,
      latest: pendingPlans.slice(0, 3).map((plan) => ({
        id: plan.id,
        title: plan.title,
        riskLevel: plan.riskLevel,
        status: plan.status,
      })),
    },
    safety: {
      effectBoundary,
      secretsRedacted: true,
      noRuntimeStart: true,
    },
    nextActions: buildNextActions({
      providerConfigured,
      pendingPlans,
      zavorthControl,
      telegram,
    }),
  };
}

function safePendingPlans(
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans'> | null,
): ZavorthMutationPlan[] {
  if (!mutationPlane) {
    return [];
  }
  try {
    return mutationPlane.listPlans({ limit: 20 })
      .filter((plan) => plan.status === 'waiting_approval' || plan.approval.status === 'pending');
  } catch (error: any) { const err = error; const e = error; logger.warn('[Zavorth Cli Home Projection] filesystem check failed', error); return []; }
}

function readPackageVersion(projectRoot: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version || null;
  } catch (error: any) { const err = error; const e = error; logger.warn('[Zavorth Cli Home Projection] JSON parse failed', error); return null; }
}

function resolveProviderModel(env: Record<string, string>, providerId: string | null): string | null {
  if (!providerId) {
    return null;
  }
  return env[`${providerId.toUpperCase()}_MODEL`] || env.ZAVORTH_DEFAULT_MODEL || null;
}

function hasAnyProviderCredential(env: Record<string, string>, providerId: string | null): boolean {
  if (!providerId) {
    return false;
  }
  const candidates: Record<string, string[]> = {
    openai: ['OPENAI_API_KEY'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    groq: ['GROQ_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    huggingface: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
  };
  return (candidates[providerId] || []).some((key) => Boolean(env[key] || process.env[key]));
}

function resolveHomeStatus(input: {
  providerConfigured: boolean;
  pendingApprovals: number;
  effectBoundary: 'ready' | 'missing';
}): ZavorthCliHomeStatus {
  if (input.effectBoundary === 'missing') {
    return 'blocked';
  }
  if (!input.providerConfigured || input.pendingApprovals > 0) {
    return 'warning';
  }
  return 'ready';
}

function buildHeadline(status: ZavorthCliHomeStatus, providerConfigured: boolean, pendingApprovals: number): string {
  if (status === 'blocked') {
    return 'Core safety files are missing. Run doctor before daily use.';
  }
  if (pendingApprovals > 0) {
    return `${pendingApprovals} governed action(s) are waiting for approval.`;
  }
  if (!providerConfigured) {
    return 'Finish provider setup so natural language reaches a live LLM.';
  }
  return 'Zavorth is ready for natural-first daily work.';
}

function buildNextActions(input: {
  providerConfigured: boolean;
  pendingPlans: ZavorthMutationPlan[];
  zavorthControl: 'available' | 'missing';
  telegram: 'ready' | 'needs-allowlist' | 'not-configured';
}): ZavorthCliHomeSnapshot['nextActions'] {
  return [
    !input.providerConfigured
      ? { label: 'Configure provider', command: 'zavorth setup', detail: 'model, keys and trust mode' }
      : null,
    input.pendingPlans.length > 0
      ? { label: 'Review approvals', command: 'zavorth approve', detail: `${input.pendingPlans.length} pending` }
      : null,
    input.zavorthControl === 'available'
      ? { label: 'Open ZavorthControl', command: 'zavorth open', detail: 'visual control plane' }
      : { label: 'Check zavorthControl', command: 'zavorth doctor', detail: 'zavorthControl source missing' },
    input.telegram !== 'ready'
      ? { label: 'Configure Telegram', command: 'zavorth channels telegram', detail: input.telegram === 'needs-allowlist' ? 'add user allowlist' : 'optional remote ChatOps' }
      : null,
    { label: 'Ask naturally', command: 'zavorth ask "review this workspace"', detail: 'LLM-first agent flow' },
  ].filter(Boolean) as ZavorthCliHomeSnapshot['nextActions'];
}
