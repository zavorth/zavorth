import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliHomeSnapshot } from '../home/index.js';
import type {
  ZavorthCliQuickStartOption,
  ZavorthCliQuickStartSnapshot,
  ZavorthCliQuickStartStatus,
} from './ZavorthCliQuickStartTypes.js';

export type BuildZavorthCliQuickStartSnapshotInput = {
  projectRoot: string;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export function buildZavorthCliQuickStartSnapshot(
  input: BuildZavorthCliQuickStartSnapshotInput,
): ZavorthCliQuickStartSnapshot {
  const home = buildZavorthCliHomeSnapshot(input);
  const status = resolveStatus(home);
  const providerCommand = 'zavorth providers add --provider openai --model gpt-4.1';
  const channelCommand = home.channels.telegram === 'needs-allowlist'
    ? 'zavorth channels telegram --allowed-users <your-telegram-user-id> --apply'
    : 'zavorth channels telegram';
  const approvalCommand = home.approvals.pending > 0 ? 'zavorth approve' : null;
  const options = buildOptions({
    providerConfigured: home.provider.configured,
    telegram: home.channels.telegram,
    discord: home.channels.discord,
    pendingApprovals: home.approvals.pending,
    effectBoundary: home.safety.effectBoundary,
    providerCommand,
    channelCommand,
    approvalCommand,
  });

  return {
    contractVersion: 'zavorth-cli-quickstart/1',
    generatedAt: home.generatedAt,
    projectRoot: home.projectRoot,
    status,
    headline: buildHeadline(status),
    provider: {
      configured: home.provider.configured,
      id: home.provider.id,
      model: home.provider.model,
      recommendedCommand: providerCommand,
    },
    channels: {
      telegram: home.channels.telegram,
      discord: home.channels.discord,
      recommendedCommand: channelCommand,
    },
    approvals: {
      pending: home.approvals.pending,
      recommendedCommand: approvalCommand,
    },
    safety: {
      effectBoundary: home.safety.effectBoundary,
      writesRequireApply: true,
      secretsRedacted: true,
      noRuntimeStart: true,
    },
    options,
    nextActions: options
      .filter((option) => option.status === 'recommended' || option.status === 'blocked')
      .slice(0, 3)
      .map((option) => ({
        label: option.label,
        command: option.command,
        detail: option.detail,
      })),
  };
}

function resolveStatus(home: ReturnType<typeof buildZavorthCliHomeSnapshot>): ZavorthCliQuickStartStatus {
  if (home.safety.effectBoundary !== 'ready') {
    return 'blocked';
  }
  if (home.approvals.pending > 0) {
    return 'needs_approval';
  }
  if (!home.provider.configured) {
    return 'needs_provider';
  }
  if (home.channels.telegram !== 'ready' && home.channels.discord !== 'ready') {
    return 'needs_channel';
  }
  return 'ready';
}

function buildHeadline(status: ZavorthCliQuickStartStatus): string {
  switch (status) {
    case 'ready':
      return 'Provider and daily channels are ready enough for normal use.';
    case 'needs_approval':
      return 'Clear governed approvals before changing setup.';
    case 'needs_provider':
      return 'Connect a model provider so natural language reaches a live LLM.';
    case 'needs_channel':
      return 'Add at least one remote channel when you want ChatOps outside the terminal.';
    case 'blocked':
      return 'Safety core is incomplete. Diagnose before setup changes.';
    default:
      return 'Prepare provider and channels.';
  }
}

function buildOptions(input: {
  providerConfigured: boolean;
  telegram: 'ready' | 'needs-allowlist' | 'not-configured';
  discord: 'ready' | 'not-configured';
  pendingApprovals: number;
  effectBoundary: 'ready' | 'missing';
  providerCommand: string;
  channelCommand: string;
  approvalCommand: string | null;
}): ZavorthCliQuickStartOption[] {
  if (input.effectBoundary !== 'ready') {
    return [{
      id: 'doctor',
      label: 'Diagnose safety core',
      status: 'blocked',
      command: 'zavorth doctor',
      detail: 'repair Effect Boundary before configuration changes',
    }];
  }
  return [
    input.pendingApprovals > 0 && input.approvalCommand
      ? {
        id: 'approvals',
        label: 'Review pending approvals',
        status: 'recommended',
        command: input.approvalCommand,
        detail: `${input.pendingApprovals} governed action(s) waiting`,
      } satisfies ZavorthCliQuickStartOption
      : null,
    {
      id: 'provider',
      label: input.providerConfigured ? 'Provider configured' : 'Configure LLM provider',
      status: input.providerConfigured ? 'ready' : 'recommended',
      command: input.providerConfigured ? 'zavorth providers' : input.providerCommand,
      detail: input.providerConfigured ? 'model routing is configured' : 'preview first; add --apply to write .env',
    },
    {
      id: 'telegram',
      label: input.telegram === 'ready' ? 'Telegram ready' : 'Configure Telegram',
      status: input.telegram === 'ready' ? 'ready' : input.providerConfigured ? 'recommended' : 'optional',
      command: input.channelCommand,
      detail: input.telegram === 'needs-allowlist' ? 'add allowlist before remote approvals' : 'remote ChatOps with user allowlist',
    },
    {
      id: 'discord',
      label: input.discord === 'ready' ? 'Discord ready' : 'Configure Discord',
      status: input.discord === 'ready' ? 'ready' : 'optional',
      command: 'zavorth channels discord',
      detail: 'optional team ChatOps channel',
    },
    {
      id: 'hatch',
      label: 'Return to Hatch',
      status: input.providerConfigured ? 'recommended' : 'optional',
      command: 'zavorth hatch',
      detail: 'first-run cockpit after setup',
    },
  ].filter(Boolean) as ZavorthCliQuickStartOption[];
}
