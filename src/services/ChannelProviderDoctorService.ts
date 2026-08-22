import { logger } from '../logger.js';
import fs from 'fs';
import { config } from '../config/index.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { normalizeChannelId } from '../channels/normalizeChannelId.js';
import {
  inspectDiscordChannel,
  inspectSlackChannel,
  inspectTelegramChannel,
  inspectWhatsAppChannel,
} from './channel-provider-doctor/ChannelProviderNativeInspectors.js';

import {
inspectEmailChannel,
  inspectIMessageChannel,
  inspectSignalChannel,
  inspectTeamsChannel,
  safeReadChannelProviderDoctorJson,
  writeChannelProviderDoctorReport,
  type ChannelProviderDoctorEnvironment,
} from './channel-provider-doctor/ChannelProviderDoctorSupport.js';

export type ChannelProviderDoctorItem = {
  channelId: 'slack' | 'whatsapp' | 'discord' | 'telegram' | 'signal' | 'imessage' | 'teams' | 'email' | string;
  mode:
    | 'native'
    | 'cloud-api'
    | 'local'
    | 'local-outbox'
    | 'baileys'
    | 'bridge'
    | 'signal-cli'
    | 'mac-bridge'
    | 'graph-bot'
    | 'smtp-imap'
    | 'unknown'
    | 'factory-partial';
  enabled: boolean;
  configured: boolean;
  status: 'passed' | 'failed' | 'skipped' | 'partial';
  summary: string;
  error: string | null;
  recommendedAction: string | null;
  details: string[];
};

export type ChannelProviderDoctorReport = {
  checkedAt: string;
  status: 'passed' | 'failed' | 'skipped';
  summary: string;
  command: string;
  items: ChannelProviderDoctorItem[];
  fabric: {
    factoryIds: string[];
    doctorCoveredIds: string[];
    partialFactoryIds: string[];
    allFactoryIdsReported: true;
  };
};

type ChannelProviderDoctorOptions = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
  reportFilePath?: string;
  platform?: NodeJS.Platform | string;
};

type ChannelCapabilityLifecycleHint = {
  dormant: boolean;
  notes: string | null;
};

export class ChannelProviderDoctorService {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly reportFilePath: string;
  private readonly platform: NodeJS.Platform | string;

  constructor(options: ChannelProviderDoctorOptions = {}) {
    this.now = options.now || (() => new Date());
    this.fetchImpl = options.fetchImpl || globalThis.fetch || null;
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.reportFilePath = options.reportFilePath || config.channelProviderDoctorReportFile;
    this.platform = options.platform || process.platform;
  }

  public async run(options: { localOnly?: boolean } = {}): Promise<ChannelProviderDoctorReport> {
    const localOnly = options.localOnly === true;
    const nativeItems = [
      await this.inspectTelegram(localOnly),
      await this.inspectDiscord(localOnly),
      await this.inspectSlack(localOnly),
      await this.inspectWhatsApp(localOnly),
      await this.inspectSignal(localOnly),
      await this.inspectIMessage(localOnly),
      await this.inspectTeams(localOnly),
      await this.inspectEmail(localOnly),
    ];
    const covered = new Set(nativeItems.map((item) => normalizeChannelId(item.channelId, item.channelId)));
    const factoryIds = ChannelGatewayFactory.listSupportedChannelIds();
    const partialFactoryIds = factoryIds.filter((id) => !covered.has(normalizeChannelId(id, id)));
    const fabricItems: ChannelProviderDoctorItem[] = partialFactoryIds.map((channelId) => ({
      channelId,
      mode: 'factory-partial',
      enabled: false,
      configured: false,
      status: 'partial',
      summary: `${channelId} is first-class in the factory fabric; native deep doctor is not required for inventory.`,
      error: null,
      recommendedAction: `Use ChannelCompletenessService / channels:install for ${channelId}.`,
      details: [
        'Reported so every ChannelGatewayFactory.listSupportedChannelIds() entry appears in doctor inventory.',
        'Status is partial until channel-specific credentials and live smoke are configured.',
      ],
    }));
    const items = [...nativeItems, ...fabricItems];

    const failed = items.filter((item) => item.status === 'failed');
    const passed = items.filter((item) => item.status === 'passed');
    const status: ChannelProviderDoctorReport['status'] =
      failed.length > 0
        ? 'failed'
        : passed.length > 0
          ? 'passed'
          : 'skipped';
    const summary =
      status === 'failed'
        ? 'Native channel doctor found operational pending items.'
        : status === 'passed'
          ? 'Native channel doctor validated the configured providers.'
          : 'No provider nactive/webhook elegivel para doctor in this runtime.';

    const report: ChannelProviderDoctorReport = {
      checkedAt: this.now().toISOString(),
      status,
      summary,
      command: 'npm run test:channels:smoke',
      items,
      fabric: {
        factoryIds,
        doctorCoveredIds: nativeItems.map((item) => item.channelId),
        partialFactoryIds,
        allFactoryIdsReported: true,
      },
    };

    await this.writeReport(report);
    return report;
  }

  private async inspectTelegram(localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectTelegramChannel({
      localOnly,
      fetchImpl: this.fetchImpl,
      safeReadJson: this.safeReadJson.bind(this),
    });
  }

  private async inspectDiscord(localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectDiscordChannel({
      ...this.buildNativeInspectorDeps(localOnly),
      readCapabilityLifecycleHint: this.readCapabilityLifecycleHint.bind(this),
    });
  }

  private async inspectSlack(localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectSlackChannel(this.buildNativeInspectorDeps(localOnly));
  }

  private async inspectWhatsApp(localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectWhatsAppChannel(this.buildNativeInspectorDeps(localOnly));
  }

  private async inspectSignal(_localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectSignalChannel(this.buildEnvironment());
  }

  private async inspectIMessage(_localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectIMessageChannel(this.buildEnvironment());
  }

  private async inspectTeams(_localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectTeamsChannel(this.buildEnvironment());
  }

  private async inspectEmail(_localOnly: boolean): Promise<ChannelProviderDoctorItem> {
    return inspectEmailChannel(this.buildEnvironment());
  }

  private buildNativeInspectorDeps(localOnly: boolean) {
    return {
      localOnly,
      fetchImpl: this.fetchImpl,
      readStatusFile: this.readStatusFile.bind(this),
      safeReadJson: this.safeReadJson.bind(this),
      readCapabilityLifecycleHint: this.readCapabilityLifecycleHint.bind(this),
    };
  }

  private buildEnvironment(): ChannelProviderDoctorEnvironment {
    return {
      platform: this.platform,
      readStatusFile: this.readStatusFile.bind(this),
      envValue: this.envValue.bind(this),
      envList: this.envList.bind(this),
      envBoolean: this.envBoolean.bind(this),
      resolveExplicitEnabled: this.resolveExplicitEnabled.bind(this),
    };
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readStatusFile(filePath: string): Record<string, any> | null {
    try {
      if (!filePath || !this.existsSync(filePath)) {
        return null;
      }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      return JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, any>;
    } catch (error: unknown) {logger.warn('[Channel  Doctor] JSON parse failed', error); return null; }
  }

  private readCapabilityLifecycleHint(capabilityId: string): ChannelCapabilityLifecycleHint {
    const state = this.readStatusFile(config.capabilityLifecycleStateFile);
    const capability = state?.capabilities?.[capabilityId];
    if (!capability || typeof capability !== 'object') {
      return { dormant: false, notes: null };
    }

    if (capability.enabledByUser === true) {
      return {
        dormant: false,
        notes: typeof capability.notes === 'string' ? capability.notes : null,
      };
    }

    return {
      dormant: capability.state === 'dormant',
      notes: typeof capability.notes === 'string' ? capability.notes : null,
    };
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async safeReadJson(response: Response): Promise<Record<string, any> | null> {
    return safeReadChannelProviderDoctorJson(response);
  }

  private async writeReport(report: ChannelProviderDoctorReport): Promise<void> {
    await writeChannelProviderDoctorReport(this.reportFilePath, report);
  }

  private envValue(key: string): string {
    return String(process.env[key] || '').trim();
  }

  private envList(key: string): string[] {
    return this.envValue(key)
      .split(/[,\n;]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private envBoolean(key: string, fallback = false): boolean {
    const normalized = this.envValue(key).toLowerCase();
    if (!normalized) {
      return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private resolveExplicitEnabled(key: string, fallback = false): boolean {
    const normalized = this.envValue(key).toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    return fallback;
  }
}
