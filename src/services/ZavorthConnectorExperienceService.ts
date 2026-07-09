import { ChannelProviderDoctorService, type ChannelProviderDoctorReport } from './ChannelProviderDoctorService.js';
import {
  ChannelSetupAssistantService,
  type ChannelSetupAssistantApplyResult,
  type ChannelSetupAssistantSession,
} from './ChannelSetupAssistantService.js';
import type { ChannelInstallMode } from './ChannelInstallScaffoldService.js';
import { ZavorthProductDemoService } from './ZavorthProductDemoService.js';
import type { ZavorthProductDemoConnectorCheck } from '../contracts/ZavorthProductDemoContract.js';
import { normalizePlatformKey, type PlatformKey } from '../contracts/PlatformContract.js';
import { logger } from '../logger.js';

export type ZavorthConnectorExperienceChannelId = 'github' | 'telegram' | 'discord';

export type ZavorthConnectorSetupInput = {
  channelId: string;
  mode?: string | null;
  apply?: boolean;
  allowedUserIds?: string[];
  allowedGuildIds?: string[];
  allowedChannelIds?: string[];
  ownerUserIds?: string[];
  allowDms?: boolean | null;
  requestedBy?: string | null;
};

export type ZavorthConnectorSetupResult = {
  generatedAt: string;
  channelId: ZavorthConnectorExperienceChannelId;
  apply: boolean;
  status: 'preview' | 'applied' | 'not_applicable';
  summary: string;
  assistant: ChannelSetupAssistantSession | null;
  applyResult: ChannelSetupAssistantApplyResult | null;
  connector: ZavorthProductDemoConnectorCheck | null;
  commands: string[];
  missing: string[];
  safety: {
    rawSecretsAccepted: false;
    writesRequireApply: true;
    externalMutationBeforeApproval: false;
  };
};

export type ZavorthConnectorDoctorResult = {
  generatedAt: string;
  selectedId: ZavorthConnectorExperienceChannelId | null;
  status: 'ready' | 'needs_setup';
  connectors: ZavorthProductDemoConnectorCheck[];
  selected: ZavorthProductDemoConnectorCheck | null;
  providerDoctor: ChannelProviderDoctorReport | null;
  exactMissing: string[];
  nextCommands: string[];
};

type ZavorthConnectorExperienceRuntime = {
  now?: () => Date;
  productDemo?: ZavorthProductDemoService;
  assistant?: Pick<ChannelSetupAssistantService, 'buildSession' | 'apply'>;
  providerDoctor?: Pick<ChannelProviderDoctorService, 'run'> | null;
};

export class ZavorthConnectorExperienceService {
  private readonly now: () => Date;
  private readonly productDemo: ZavorthProductDemoService;
  private readonly assistant: Pick<ChannelSetupAssistantService, 'buildSession' | 'apply'>;
  private readonly providerDoctor: Pick<ChannelProviderDoctorService, 'run'> | null;

  public constructor(runtime: ZavorthConnectorExperienceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.productDemo = runtime.productDemo || new ZavorthProductDemoService();
    this.assistant = runtime.assistant || new ChannelSetupAssistantService();
    this.providerDoctor = runtime.providerDoctor === undefined
      ? new ChannelProviderDoctorService()
      : runtime.providerDoctor;
  }

  public buildSetup(input: ZavorthConnectorSetupInput): ZavorthConnectorSetupResult {
    const channelId = this.normalizeConnectorId(input.channelId);
    const connector = this.findConnector(channelId);
    if (channelId === 'github') {
      return {
        generatedAt: this.now().toISOString(),
        channelId,
        apply: false,
        status: 'not_applicable',
        summary: 'GitHub setup usa gh auth login; Zavorth nao grava credenciais GitHub por voce.',
        assistant: null,
        applyResult: null,
        connector,
        commands: ['gh auth login', 'gh auth status', 'zavorth connectors doctor github'],
        missing: connector?.missing || [],
        safety: buildConnectorSafety(),
      };
    }

    const mode = this.normalizeMode(input.mode) || 'native';
    const assistant = this.assistant.buildSession({
      channelId,
      mode,
      intentText: `connect ${channelId}`,
    });
    if (!input.apply) {
      return {
        generatedAt: this.now().toISOString(),
        channelId,
        apply: false,
        status: 'preview',
        summary: `${labelConnector(channelId)} setup preview pronto; rode com --apply para escrever somente scaffold/allowlist.`,
        assistant,
        applyResult: null,
        connector,
        commands: [
          `zavorth connectors setup ${channelId} --apply`,
          `zavorth connectors doctor ${channelId}`,
        ],
        missing: connector?.missing || [],
        safety: buildConnectorSafety(),
      };
    }

    throw new Error('Use applySetup para aplicar setup assíncrono de conectores.');
  }

  public async applySetup(input: ZavorthConnectorSetupInput): Promise<ZavorthConnectorSetupResult> {
    const channelId = this.normalizeConnectorId(input.channelId);
    if (channelId === 'github') {
      return this.buildSetup({ ...input, apply: false });
    }
    const mode = this.normalizeMode(input.mode) || 'native';
    const extraEntries = this.buildExtraEntries(channelId, input);
    const applyResult = await this.assistant.apply({
      channelId,
      mode,
      requestedBy: input.requestedBy || 'zavorth-connectors',
      extraEntries,
    });
    const connector = this.findConnector(channelId);
    return {
      generatedAt: this.now().toISOString(),
      channelId,
      apply: true,
      status: 'applied',
      summary: `${labelConnector(channelId)} scaffold aplicado; secrets continuam fora do chat e do comando.`,
      assistant: applyResult.assistant,
      applyResult,
      connector,
      commands: [
        `zavorth connectors doctor ${channelId}`,
        'npm run test:channels:smoke',
      ],
      missing: connector?.missing || [],
      safety: buildConnectorSafety(),
    };
  }

  public async runDoctor(input: {
    selectedId?: string | null;
    localOnly?: boolean;
  } = {}): Promise<ZavorthConnectorDoctorResult> {
    const selectedId = input.selectedId ? this.normalizeConnectorId(input.selectedId) : null;
    const snapshot = this.productDemo.buildSnapshot();
    const connectors = snapshot.connectors.checklist;
    const selected = selectedId
      ? connectors.find((connector) => connector.id === selectedId || connector.id === 'github-pr-comment' && selectedId === 'github') || null
      : null;
    let providerDoctor: ChannelProviderDoctorReport | null = null;
    if (this.providerDoctor && (!selectedId || selectedId === 'telegram' || selectedId === 'discord')) {
      try {
        providerDoctor = await this.providerDoctor.run({ localOnly: input.localOnly === true });
      } catch (error: unknown) {logger.warn('[Zavorth Connector Experience] connection failed', error);
    providerDoctor = null;
  }
    }
    const exactMissing = connectors
      .filter((connector) => !selectedId || connector.id === selectedId || connector.id === 'github-pr-comment' && selectedId === 'github')
      .flatMap((connector) => connector.status === 'ready' ? [] : connector.missing.map((missing) => `${connector.label}: ${missing}`));
    return {
      generatedAt: this.now().toISOString(),
      selectedId,
      status: exactMissing.length > 0 ? 'needs_setup' : 'ready',
      connectors,
      selected,
      providerDoctor,
      exactMissing,
      nextCommands: this.buildNextCommands(selectedId, connectors),
    };
  }

  public renderSetup(result: ZavorthConnectorSetupResult): string {
    const lines = [
      `Zavorth Connector Setup: ${labelConnector(result.channelId)}`,
      `status: ${result.status}`,
      `apply: ${result.apply ? 'yes' : 'no'}`,
      result.summary,
      '',
      'Safety',
      '- raw secrets are not accepted here',
      '- .env writes require --apply',
      '- external sends/comments remain approval-gated',
    ];
    if (result.applyResult) {
      lines.push(
        '',
        'Applied',
        `- env: ${result.applyResult.applyReport.env.filePath}`,
        `- written: ${result.applyResult.applyReport.env.writtenKeys.join(', ') || 'none'}`,
        `- preserved: ${result.applyResult.applyReport.env.preservedKeys.join(', ') || 'none'}`,
      );
      if (result.applyResult.applyReport.nextSteps.length > 0) {
        lines.push(...result.applyResult.applyReport.nextSteps.map((step) => `- next: ${step}`));
      }
    } else if (result.assistant?.selected) {
      lines.push(
        '',
        'Preview',
        `- mode: ${result.assistant.selected.setupMode}`,
        `- missing: ${result.assistant.selected.missingEnvKeys.join(', ') || 'none'}`,
        `- next: ${result.assistant.selected.operatorNextStep}`,
      );
    }
    lines.push('', 'Commands', ...result.commands.map((command) => `- ${command}`), '');
    return lines.join('\n');
  }

  public renderDoctor(result: ZavorthConnectorDoctorResult): string {
    const connectors = result.selected ? [result.selected] : result.connectors;
    return [
      'Zavorth Connector Doctor',
      `status: ${result.status}`,
      result.selectedId ? `selected: ${result.selectedId}` : 'selected: all',
      '',
      ...connectors.map((connector) => [
        `[${connector.status}] ${connector.label}`,
        connector.missing.length > 0 ? `  missing: ${connector.missing.join('; ')}` : '  ready',
        `  setup: ${connector.setupCommand}`,
        `  doctor: ${connector.doctorCommand}`,
      ].join('\n')),
      '',
      result.providerDoctor
        ? `Provider doctor: ${result.providerDoctor.status} - ${result.providerDoctor.summary}`
        : 'Provider doctor: skipped or unavailable for this channel',
      '',
      result.exactMissing.length > 0
        ? `Exact missing setup: ${result.exactMissing.join(' | ')}`
        : 'Exact missing setup: none',
      '',
      'Next commands',
      ...result.nextCommands.map((command) => `- ${command}`),
      '',
    ].join('\n');
  }

  private buildNextCommands(
    selectedId: ZavorthConnectorExperienceChannelId | null,
    connectors: ZavorthProductDemoConnectorCheck[],
  ): string[] {
    const target = selectedId
      ? connectors.filter((connector) => connector.id === selectedId || connector.id === 'github-pr-comment' && selectedId === 'github')
      : connectors;
    return Array.from(new Set(target.map((connector) =>
      connector.status === 'ready' ? connector.command : connector.setupCommand,
    )));
  }

  private buildExtraEntries(
    channelId: Extract<ZavorthConnectorExperienceChannelId, 'telegram' | 'discord'>,
    input: ZavorthConnectorSetupInput,
  ): Array<{ key: string; value: string }> {
    if (channelId === 'telegram') {
      const allowedUsers = normalizeList(input.allowedUserIds);
      const entries: Array<{ key: string; value: string }> = [];
      if (allowedUsers.length > 0) {
        entries.push({ key: 'TELEGRAM_ALLOWED_USER_IDS', value: allowedUsers.join(',') });
        entries.push({ key: 'ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED', value: allowedUsers.map((id) => `user:${id}`).join(',') });
      }
      return entries;
    }

    const guilds = normalizeList(input.allowedGuildIds);
    const channels = normalizeList(input.allowedChannelIds);
    const owners = normalizeList(input.ownerUserIds);
    const entries: Array<{ key: string; value: string }> = [];
    if (guilds.length > 0) entries.push({ key: 'DISCORD_ALLOWED_GUILD_IDS', value: guilds.join(',') });
    if (channels.length > 0) entries.push({ key: 'DISCORD_ALLOWED_CHANNEL_IDS', value: channels.join(',') });
    if (owners.length > 0) entries.push({ key: 'DISCORD_OWNER_USER_IDS', value: owners.join(',') });
    if (input.allowDms !== null && input.allowDms !== undefined) {
      entries.push({ key: 'DISCORD_ALLOW_DMS', value: input.allowDms ? 'true' : 'false' });
    }
    const policyAllowed = [
      ...guilds.map((id) => `guild:${id}`),
      ...channels.map((id) => `channel:${id}`),
      ...owners.map((id) => `user:${id}`),
    ];
    if (policyAllowed.length > 0) {
      entries.push({ key: 'ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED', value: policyAllowed.join(',') });
    }
    return entries;
  }

  private findConnector(channelId: ZavorthConnectorExperienceChannelId): ZavorthProductDemoConnectorCheck | null {
    const connectors = this.productDemo.buildSnapshot().connectors.checklist;
    return connectors.find((connector) => connector.id === channelId || connector.id === 'github-pr-comment' && channelId === 'github') || null;
  }

  private normalizeConnectorId(value: string): ZavorthConnectorExperienceChannelId {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'github' || normalized === 'gh') {
      return 'github';
    }
    const platform = normalizePlatformKey(normalized) as PlatformKey | null;
    if (platform === 'telegram' || platform === 'discord') {
      return platform;
    }
    throw new Error(`Connector unsupported in this setup flow: ${value || 'unknown'}. Use github, telegram or discord.`);
  }

  private normalizeMode(value: string | null | undefined): ChannelInstallMode | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'native' || normalized === 'bridge') {
      return normalized;
    }
    return null;
  }
}

function normalizeList(values: string[] | null | undefined): string[] {
  return Array.from(new Set(
    (values || [])
      .flatMap((value) => String(value || '').split(/[,\s]+/g))
      .map((value) => value.trim())
      .filter(Boolean),
  ));
}

function labelConnector(channelId: ZavorthConnectorExperienceChannelId): string {
  if (channelId === 'github') return 'GitHub';
  if (channelId === 'telegram') return 'Telegram';
  return 'Discord';
}

function buildConnectorSafety(): ZavorthConnectorSetupResult['safety'] {
  return {
    rawSecretsAccepted: false,
    writesRequireApply: true,
    externalMutationBeforeApproval: false,
  };
}
