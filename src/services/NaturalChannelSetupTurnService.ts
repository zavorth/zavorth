import type { ChannelMeshActionExecution } from '../contracts/ChannelMeshContract.js';
import type { PlatformKey } from '../contracts/PlatformContract.js';
import type {
  ChannelSetupAssistantApplyResult,
  ChannelSetupAssistantDoctorResult,
  ChannelSetupAssistantService,
  ChannelSetupAssistantSession,
} from './ChannelSetupAssistantService.js';
import type { ChannelInstallMode } from './ChannelInstallScaffoldService.js';

type ChannelSetupAssistantLike = Pick<ChannelSetupAssistantService, 'buildSession' | 'apply' | 'runDoctor'>;

type ChannelActionLike = {
  execute: (input: {
    channelId: string;
    actionId: 'send-test';
    requestedBy?: string | null;
  }) => Promise<ChannelMeshActionExecution>;
};

export type NaturalChannelSetupTurnResult = {
  generatedAt: string;
  channelId: PlatformKey | null;
  mode: ChannelInstallMode | null;
  assistant: ChannelSetupAssistantSession;
  extractedEntries: Array<{ key: string; valuePreview: string }>;
  remainingEnvKeys: string[];
  applyResult: ChannelSetupAssistantApplyResult | null;
  doctorResult: ChannelSetupAssistantDoctorResult | null;
  sendTest: ChannelMeshActionExecution | null;
  promotionReady: boolean;
  naturalReply: string;
};

type NaturalChannelSetupTurnDeps = {
  now?: () => Date;
  assistant: ChannelSetupAssistantLike;
  channelActions?: ChannelActionLike | null;
};

export class NaturalChannelSetupTurnService {
  private readonly now: () => Date;
  private readonly assistant: ChannelSetupAssistantLike;
  private readonly channelActions: ChannelActionLike | null;

  constructor(deps: NaturalChannelSetupTurnDeps) {
    this.now = deps.now || (() => new Date());
    this.assistant = deps.assistant;
    this.channelActions = deps.channelActions || null;
  }

  public async buildTurn(input: {
    intentText?: string | null;
    channelId?: string | null;
    mode?: string | null;
    requestedBy?: string | null;
    autoApply?: boolean;
    autoDoctor?: boolean;
    autoTest?: boolean;
    localOnly?: boolean;
    previewOnly?: boolean;
  }): Promise<NaturalChannelSetupTurnResult> {
    const text = String(input.intentText || '').trim();
    const seed = this.assistant.buildSession({ channelId: input.channelId, intentText: text });
    const seedChannelId = input.channelId || seed.selected?.channelId || null;
    // Mode only from structured input.mode (or later selected.setupMode from assistant session).
    // Free-text CHANNEL_MODE_PATTERNS resolution is intentionally disabled.
    const mode = this.normalizeMode(input.mode);
    const initial = this.assistant.buildSession({ channelId: seedChannelId, mode, intentText: text });
    const selected = initial.selected;
    if (!selected) {
      return this.finish(initial, null, null, [], [], null, null, null);
    }

    const resolvedMode = mode || selected.setupMode;
    // Soft extraction of env key=value stays when a structured channel is already in play.
    // Extracted entries never activate apply/doctor/test without structured flags.
    const extractedEntries = this.extractEntries(text, selected.channelId);
    const remainingBeforeApply = selected.missingEnvKeys.filter(
      (key) => !extractedEntries.some((entry) => entry.key === key),
    );
    const wantsApply = input.autoApply === true;
    const wantsDoctor = input.autoDoctor === true;
    const wantsTest = input.autoTest === true;

    let applyResult: ChannelSetupAssistantApplyResult | null = null;
    let assistant = initial;
    let remainingEnvKeys = remainingBeforeApply;
    const previewOnly = input.previewOnly === true;

    if (wantsApply && !previewOnly) {
      applyResult = await this.assistant.apply({
        channelId: selected.channelId,
        mode: resolvedMode,
        extraEntries: extractedEntries.map((entry) => ({ key: entry.key, value: entry.value })),
        requestedBy: input.requestedBy || null,
      });
      assistant = applyResult.assistant;
      remainingEnvKeys = assistant.selected?.missingEnvKeys?.slice() || [];
    }

    let doctorResult: ChannelSetupAssistantDoctorResult | null = null;
    if (wantsDoctor && remainingEnvKeys.length === 0 && !previewOnly) {
      doctorResult = await this.assistant.runDoctor({
        selectedId: selected.channelId,
        localOnly: input.localOnly === true,
      });
      assistant = doctorResult.assistant;
    }

    let sendTest: ChannelMeshActionExecution | null = null;
    if (
      wantsTest &&
      remainingEnvKeys.length === 0 &&
      this.channelActions &&
      (!doctorResult?.selectedItem || doctorResult.selectedItem.status === 'passed') &&
      !previewOnly
    ) {
      sendTest = await this.channelActions.execute({
        channelId: selected.channelId,
        actionId: 'send-test',
        requestedBy: input.requestedBy || null,
      });
    }

    return this.finish(
      assistant,
      selected.channelId,
      resolvedMode,
      extractedEntries.map((entry) => ({ key: entry.key, valuePreview: this.preview(entry.key, entry.value) })),
      remainingEnvKeys,
      applyResult,
      doctorResult,
      sendTest,
      previewOnly && (wantsApply || wantsDoctor || wantsTest)
        ? [wantsApply ? 'apply/scaffold' : null, wantsDoctor ? 'doctor' : null, wantsTest ? 'send-test' : null]
            .filter(Boolean)
            .join(', ')
        : null,
    );
  }

  private finish(
    assistant: ChannelSetupAssistantSession,
    channelId: PlatformKey | null,
    mode: ChannelInstallMode | null,
    extractedEntries: Array<{ key: string; valuePreview: string }>,
    remainingEnvKeys: string[],
    applyResult: ChannelSetupAssistantApplyResult | null,
    doctorResult: ChannelSetupAssistantDoctorResult | null,
    sendTest: ChannelMeshActionExecution | null,
    previewedMutations?: string | null,
  ): NaturalChannelSetupTurnResult {
    const promotionReady =
      remainingEnvKeys.length === 0 && (!doctorResult?.selectedItem || doctorResult.selectedItem.status === 'passed');
    const lines = [assistant.naturalReply];
    if (extractedEntries.length > 0) {
      lines.push(
        '',
        `I received from your request: ${extractedEntries.map((entry) => `${entry.key}=${entry.valuePreview}`).join(' | ')}.`,
      );
    }
    if (applyResult) {
      lines.push('', `Scaffold applied for ${applyResult.applyReport.channelId} (${applyResult.applyReport.mode}).`);
      lines.push(`File: ${applyResult.applyReport.env.filePath}.`);
    }
    if (remainingEnvKeys.length > 0) {
      lines.push('', `Still missing: ${remainingEnvKeys.join(', ')}.`);
    }
    if (doctorResult?.selectedItem) {
      lines.push('', `Doctor: ${doctorResult.selectedItem.status}. ${doctorResult.selectedItem.summary}`);
    }
    if (sendTest) {
      lines.push('', sendTest.summary);
    }
    if (previewedMutations) {
      lines.push(
        '',
        `Safe preview: detected ${previewedMutations}, but did not execute. Generate/approve a mutation plan to apply.`,
      );
    }
    if (promotionReady && assistant.selected) {
      lines.push('', `Channel ready to proceed. Next step: ${assistant.selected.operatorNextStep}`);
    }
    return {
      generatedAt: this.now().toISOString(),
      channelId,
      mode,
      assistant,
      extractedEntries,
      remainingEnvKeys,
      applyResult,
      doctorResult,
      sendTest,
      promotionReady,
      naturalReply: lines.join('\n'),
    };
  }

  private extractEntries(text: string, channelId: string): Array<{ key: string; value: string }> {
    const entries = new Map<string, string>();
    for (const match of text.matchAll(/\b([A-Z0-9_]{3})\s*=\s*([^\s]+)/g)) {
      entries.set(String(match[1]), this.cleanExtractedValue(match[2]));
    }
    const add = (key: string, labels: string[]) => {
      const value = this.extractValue(text, labels);
      if (value) {
        entries.set(key, value);
      }
    };
    if (channelId === 'discord') {
      add('DISCORD_BOT_TOKEN', ['discord bot token', 'token do discord', 'token do bot']);
      add('DISCORD_ALLOWED_GUILD_IDS', ['guild id', 'guild ids', 'server id']);
    } else if (channelId === 'slack') {
      add('SLACK_BOT_TOKEN', ['slack bot token', 'token do slack', 'bot token']);
      add('SLACK_SIGNING_SECRET', ['slack signing secret', 'signing secret']);
      add('SLACK_ALLOWED_CHANNEL_IDS', ['slack channel id', 'slack channel ids', 'Slack channel']);
    } else if (channelId === 'whatsapp') {
      add('WHATSAPP_PHONE_NUMBER_ID', ['phone number id', 'number id']);
      add('WHATSAPP_ACCESS_TOKEN', ['whatsapp access token', 'token do whatsapp', 'access token']);
      add('WHATSAPP_WEBHOOK_VERIFY_TOKEN', ['verify token', 'webhook verify token']);
      add('WHATSAPP_ALLOWED_CHAT_IDS', ['chat id', 'chat ids']);
    } else if (channelId === 'telegram') {
      add('TELEGRAM_BOT_TOKEN', ['telegram bot token', 'token do telegram']);
      add('TELEGRAM_ALLOWED_USER_IDS', ['telegram user ids', 'user ids', 'user id']);
    }
    return Array.from(entries.entries()).map(([key, value]) => ({ key, value }));
  }

  private extractValue(text: string, labels: string[]): string | null {
    const canonical = String(text || '').replace(/\s+(?:\u00e9|eh|is)\s+/gi, ' = ');
    for (const label of labels) {
      const escaped = label.replace(/[.*+...^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const pattern = new RegExp(`(?:${escaped})\\s*(?:=|:)...\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'i');
      const match = canonical.match(pattern);
      const value = [match?.[1], match?.[2], match?.[3]].map((entry) => String(entry || '').trim()).find(Boolean);
      if (value) {
        return this.cleanExtractedValue(value);
      }
    }
    return null;
  }

  private cleanExtractedValue(value: unknown): string {
    return String(value || '')
      .trim()
      .replace(/[.,;]+$/g, '');
  }

  private preview(key: string, value: string): string {
    const normalized = String(value || '').trim();
    if (/(TOKEN|SECRET|PASS|PASSWORD)/.test(key)) {
      return normalized.length > 6 ? `${normalized.slice(0, 3)}***${normalized.slice(-2)}` : '***';
    }
    return normalized;
  }

  private normalizeMode(value: string | null | undefined): ChannelInstallMode | null {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    const modes: ChannelInstallMode[] = [
      'native',
      'bridge',
      'local',
      'cloud-api',
      'baileys',
      'signal-cli',
      'mac-bridge',
      'graph-bot',
      'meta-messaging',
      'smtp-imap',
    ];
    return modes.find((mode) => mode === normalized) || null;
  }
}

