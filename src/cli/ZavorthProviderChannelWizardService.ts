import path from 'path';
import {
  type ZavorthSetupStudioEnvUpdate,
  applyZavorthSetupStudioEnvPlan,
  buildZavorthSetupStudioPlan,
  mergeEnvContent,
} from './ZavorthSetupStudioService.js';
import {
  type ZavorthProviderLiveValidationResult,
  renderZavorthProviderLiveValidationResult,
  writeZavorthProviderLiveValidationProof,
} from './ZavorthProviderLiveValidationService.js';
import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliPanel,
} from './premium/index.js';


export type ZavorthProviderWizardInput = {
  projectRoot: string;
  action: 'add' | 'switch';
  providerId: string;
  modelId?: string | null;
  providerSecret?: string | null;
  liveValidation?: ZavorthProviderLiveValidationResult | null;
  apply?: boolean;
};

export type ZavorthChannelWizardInput = {
  projectRoot: string;
  channelId: string;
  token?: string | null;
  allowedUserIds?: string | null;
  allowedGuildIds?: string | null;
  allowedChannelIds?: string | null;
  ownerUserIds?: string | null;
  apply?: boolean;
};

export type ZavorthChannelWizardId = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal' | 'email';

export type ZavorthWizardResult = {
  contractVersion: 'zavorth-provider-channel-wizard/1';
  kind: 'provider' | 'channel';
  status: 'preview' | 'applied';
  envFile: string;
  updates: Array<Omit<ZavorthSetupStudioEnvUpdate, 'value'>>;
  liveValidation?: ZavorthProviderLiveValidationResult | null;
  nextCommands: string[];
  safety: {
    noSecretInOutput: true;
    noLiveProbe: boolean;
    liveProbeRequiresExplicitConsent: true;
    noRuntimeStart: true;
    writesRequireApply: true;
  };
};

export class ZavorthProviderChannelWizardService {
  public buildProvider(input: ZavorthProviderWizardInput): ZavorthWizardResult {
    const plan = buildZavorthSetupStudioPlan({
      projectRoot: input.projectRoot,
      providerId: input.providerId,
      modelId: input.modelId,
      providerSecret: input.providerSecret,
      memoryMode: 'local-metadata',
      vaultScope: 'skip',
      scanDirs: [],
    });
    const selectedKeys = new Set(['ZAVORTH_DEFAULT_PROVIDER', plan.provider.secretEnvKey, ...plan.envUpdates
      .filter((entry) => /\bmodel\b|modelo/i.test(entry.reason))
      .map((entry) => entry.key)].filter(Boolean) as string[]);
    const updates = plan.envUpdates.filter((entry) => selectedKeys.has(entry.key));
    const narrowedPlan = { ...plan, envUpdates: updates };
    if (input.apply) {
      applyZavorthSetupStudioEnvPlan(narrowedPlan);
      writeZavorthProviderLiveValidationProof(input.projectRoot, input.liveValidation);
    }
    return this.result('provider', input.apply ? 'applied' : 'preview', plan.envFile, updates, [
      `zavorth providers test ${plan.provider.id}`,
      `zavorth providers select ${plan.provider.id}`,
      'zavorth ready',
    ], input.liveValidation);
  }

  public buildChannel(input: ZavorthChannelWizardInput): ZavorthWizardResult {
    const channelId = normalizeChannelId(input.channelId);
    const envFile = path.join(input.projectRoot, '.env');
    const updates = buildChannelUpdates(channelId, input);
    if (input.apply && updates.length > 0) {
      const fsPlan = {
        contractVersion: 'zavorth-setup-studio/1' as const,
        envFile,
        skillGovernance: {
          mode: 'casual' as const,
          summary: 'Fast daily-use imports, while hard security and license blockers still stay active.',
        },
        provider: { id: 'deferred' as const, modelId: 'deferred', secretStored: false, secretEnvKey: null },
        channels: {
          telegram: channelId === 'telegram' ? 'configured-secret' as const : 'skip' as const,
          discord: channelId === 'discord' ? 'configured-secret' as const : 'skip' as const,
          slack: channelId === 'slack' ? 'configured-secret' as const : 'skip' as const,
          email: 'skip' as const,
        },
        webSearch: { provider: 'skip' as const, secretStored: false, secretEnvKey: null },
        memory: { mode: 'local-metadata' as const, vaultScope: 'skip' as const, scanDirs: [] },
        wakeDetector: {
          mode: 'default-local' as const,
          summary: 'default local detector path, still opt-in and TTL-bound',
          commandConfigured: false,
          rawAudioPersisted: false as const,
        },
        hooks: { enabled: false, templates: [] },
        envUpdates: updates,
        safety: {
          rawSecretsInPlan: false as const,
          rawSecretsInSummary: false as const,
          writesEnvFile: true,
          providerExecutionPerformed: false as const,
          runtimePersistentStartPerformed: false as const,
          warnings: [],
        },
        nextCommands: [],
      };
      applyZavorthSetupStudioEnvPlan(fsPlan);
    }
    return this.result('channel', input.apply ? 'applied' : 'preview', envFile, updates, [
      `zavorth connectors doctor ${channelId}`,
      'zavorth ready',
      'zavorth open',
    ]);
  }

  public render(result: ZavorthWizardResult): string {
    const panels: ZavorthPremiumCliPanel[] = [
      {
        title: 'Planned .env updates',
        accent: result.status === 'applied' ? 'emerald' : 'amber',
        lines: result.updates.length > 0
          ? result.updates.map((entry) => `${entry.key}=${entry.redactedValue} (${entry.reason})`)
          : ['none'],
      },
      {
        title: 'Safety',
        accent: 'emerald',
        lines: [
          '- secrets are redacted in output',
          result.liveValidation
            ? '- provider live probe was run only after explicit confirmation'
            : '- no provider live probe was run',
          '- no runtime was started',
          '- writes require --apply',
        ],
      },
    ];
    if (result.liveValidation) {
      panels.push({
        title: 'Live validation',
        accent: result.liveValidation.status === 'passed' ? 'emerald' : result.liveValidation.status === 'failed' ? 'rose' : 'amber',
        lines: renderZavorthProviderLiveValidationResult(result.liveValidation).split('\n'),
      });
    }
    return renderZavorthPremiumCliScreen({
      title: result.kind === 'provider' ? 'Provider Wizard' : 'Channel Wizard',
      subtitle: result.status === 'applied' ? 'Configuration written to local .env.' : 'Preview only. Add --apply to write local .env.',
      mode: 'compact',
      statusRows: [
        { label: 'Wizard', value: result.kind, status: 'ready' },
        { label: 'Status', value: result.status, status: result.status === 'applied' ? 'ready' : 'warning' },
        { label: 'Updates', value: `${result.updates.length}`, status: result.updates.length > 0 ? 'waiting' : 'ready' },
        { label: 'Runtime', value: 'not started', status: 'ready' },
      ],
      panels: [
        {
          title: 'Target',
          accent: 'cyan',
          lines: renderPremiumKeyValueTable([
            { key: 'env file', value: result.envFile },
            { key: 'output', value: 'redacted', accent: 'emerald' },
          ]).split('\n'),
        },
        ...panels,
      ],
      actions: result.nextCommands.map((command) => ({
        label: command,
        command,
        accent: 'cyan',
      })),
      notice: {
        title: 'Governed setup',
        body: 'Provider/channel setup changes configuration only when --apply is explicit. Secrets never appear in JSON or terminal output.',
      },
    });
  }

  public mergeEnvForTest(current: string, updates: ZavorthSetupStudioEnvUpdate[]): string {
    return mergeEnvContent(current, updates);
  }

  private result(
    kind: 'provider' | 'channel',
    status: 'preview' | 'applied',
    envFile: string,
    updates: ZavorthSetupStudioEnvUpdate[],
    nextCommands: string[],
    liveValidation?: ZavorthProviderLiveValidationResult | null,
  ): ZavorthWizardResult {
    return {
      contractVersion: 'zavorth-provider-channel-wizard/1',
      kind,
      status,
      envFile,
      updates: updates.map(({ value: _value, ...entry }) => entry),
      liveValidation: liveValidation || null,
      nextCommands,
      safety: {
        noSecretInOutput: true,
        noLiveProbe: !liveValidation,
        liveProbeRequiresExplicitConsent: true,
        noRuntimeStart: true,
        writesRequireApply: true,
      },
    };
  }
}

export function normalizeZavorthChannelWizardId(value: string): ZavorthChannelWizardId {
  const normalized = String(value || '').trim().toLowerCase();
  if (['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'email'].includes(normalized)) {
    return normalized as ZavorthChannelWizardId;
  }
  throw new Error(`Unsupported channel wizard: ${value || 'unknown'}`);
}

function normalizeChannelId(value: string): ZavorthChannelWizardId {
  return normalizeZavorthChannelWizardId(value);
}

function buildChannelUpdates(
  channelId: ReturnType<typeof normalizeChannelId>,
  input: ZavorthChannelWizardInput,
): ZavorthSetupStudioEnvUpdate[] {
  const updates: ZavorthSetupStudioEnvUpdate[] = [];
  const token = String(input.token || '').trim();
  if (token) {
    updates.push({
      key: channelTokenKey(channelId),
      value: token,
      redactedValue: redactSecret(token),
      reason: `${channelId} token captured by secret prompt`,
    });
  }
  const userIds = String(input.allowedUserIds || '').trim();
  if (userIds) updates.push(env(`${channelId.toUpperCase()}_ALLOWED_USER_IDS`, userIds, `${channelId} allowed users`));
  const guildIds = String(input.allowedGuildIds || '').trim();
  if (guildIds) updates.push(env(`${channelId.toUpperCase()}_ALLOWED_GUILD_IDS`, guildIds, `${channelId} allowed guilds`));
  const channelIds = String(input.allowedChannelIds || '').trim();
  if (channelIds) updates.push(env(`${channelId.toUpperCase()}_ALLOWED_CHANNEL_IDS`, channelIds, `${channelId} allowed channels`));
  const ownerIds = String(input.ownerUserIds || '').trim();
  if (ownerIds) updates.push(env(`${channelId.toUpperCase()}_OWNER_USER_IDS`, ownerIds, `${channelId} owners`));
  if (channelId === 'telegram' && userIds) {
    updates.push(env('ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED', userIds.split(',').map((id) => `user:${id.trim()}`).join(','), 'Telegram channel policy allowlist'));
  }
  if (channelId === 'discord') {
    const policy = [
      ...guildIds.split(',').filter(Boolean).map((id) => `guild:${id.trim()}`),
      ...channelIds.split(',').filter(Boolean).map((id) => `channel:${id.trim()}`),
      ...ownerIds.split(',').filter(Boolean).map((id) => `user:${id.trim()}`),
    ];
    if (policy.length > 0) updates.push(env('ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED', policy.join(','), 'Discord channel policy allowlist'));
  }
  return updates;
}

function channelTokenKey(channelId: string): string {
  if (channelId === 'telegram') return 'TELEGRAM_BOT_TOKEN';
  if (channelId === 'discord') return 'DISCORD_BOT_TOKEN';
  return `${channelId.toUpperCase()}_BOT_TOKEN`;
}

function env(key: string, value: string, reason: string): ZavorthSetupStudioEnvUpdate {
  return { key, value, redactedValue: value, reason };
}

function redactSecret(value: string): string {
  return value.length <= 8 ? '[redacted]' : `${value.slice(0, 3)}...${value.slice(-3)}`;
}
