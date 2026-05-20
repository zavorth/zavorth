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
      .filter((entry) => entry.reason.includes('modelo'))
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
        provider: { id: 'deferred' as const, modelId: 'deferred', secretStored: false, secretEnvKey: null },
        channels: { telegram: channelId === 'telegram' ? 'configured-secret' as const : 'skip' as const },
        memory: { mode: 'local-metadata' as const, vaultScope: 'skip' as const, scanDirs: [] },
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
    return [
      result.kind === 'provider' ? 'Zavorth Provider Wizard' : 'Zavorth Channel Wizard',
      `status: ${result.status}`,
      `env: ${result.envFile}`,
      '',
      'Updates',
      ...(result.updates.length > 0
        ? result.updates.map((entry) => `- ${entry.key}=${entry.redactedValue} (${entry.reason})`)
        : ['- none']),
      '',
      'Safety',
      '- secrets are redacted in output',
      result.liveValidation
        ? '- provider live probe was run only after explicit confirmation'
        : '- no provider live probe was run',
      ...(result.liveValidation ? [renderZavorthProviderLiveValidationResult(result.liveValidation)] : []),
      '- no runtime was started',
      '',
      'Next',
      ...result.nextCommands.map((command) => `- ${command}`),
      '',
    ].join('\n');
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
