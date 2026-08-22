import fs from 'fs';
import { config } from '../config/index.js';
import type { RuntimeAccessDiscordBridgeSnapshot } from '../runtime/access/RuntimeAccessReadinessService.js';
import { logger } from '../logger.js';

export type DiscordGatewayRepairFlowReport = {
  status: 'not_applicable' | 'healthy' | 'attention';
  summary: string;
  recommendedActions: string[];
  nextStep: string | null;
};

export class DiscordGatewayRepairFlowService {
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly capabilityLifecycleStateFile: string;
  private readonly discordRequiredOnBoot: boolean;

  constructor(options: {
    existsSync?: typeof fs.existsSync;
    readFileSync?: typeof fs.readFileSync;
    capabilityLifecycleStateFile?: string;
    discordRequiredOnBoot?: boolean;
  } = {}) {
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.capabilityLifecycleStateFile = String(options.capabilityLifecycleStateFile || '').trim();
    this.discordRequiredOnBoot = options.discordRequiredOnBoot ?? config.discordRequiredOnBoot;
  }

  public inspect(snapshot: RuntimeAccessDiscordBridgeSnapshot): DiscordGatewayRepairFlowReport {
    if (!snapshot.enabled) {
      return {
        status: 'not_applicable',
        summary: 'Discord is not enabled in this runtime.',
        recommendedActions: [],
        nextStep: null,
      };
    }

    const lifecycle = this.readCapabilityLifecycleHint('discord');
    if (
      snapshot.mode === 'native'
      && snapshot.started !== true
      && lifecycle.dormant
      && !this.discordRequiredOnBoot
    ) {
      return {
        status: 'not_applicable',
        summary: 'native Discord is configured, mas dormant no profile current.',
        recommendedActions: [],
        nextStep: lifecycle.notes ? `${lifecycle.notes} Use the full profile or enable the Discord capability when warming the gateway.`
          : 'Use the full profile or enable the Discord capability when warming the gateway.',
      };
    }

    if (snapshot.started) {
      return {
        status: 'healthy',
        summary: snapshot.mode === 'native'
          ? 'The native Discord gateway is healthy.'
          : 'The Discord bridge is healthy.',
        recommendedActions: [],
        nextStep: null,
      };
    }

    const recommendedActions = snapshot.mode === 'native'
      ? ['/autorepair', '/reload']
      : ['/autorepair', '/reload'];
    const summary = snapshot.lastError
      ? `${snapshot.mode === 'native' ? 'native Discord' : 'Discord bridge'} degradado: ${snapshot.lastError}`
      : `${snapshot.mode === 'native' ? 'native Discord' : 'Discord bridge'} has not entered ready state yet.`;

    return {
      status: 'attention',
      summary,
      recommendedActions,
      nextStep: snapshot.mode === 'native'
        ? 'Use /autorepair ou /reload para reconciliar o gateway nactive do Discord.'
        : 'Use /autorepair ou /reload para reconciliar o Discord bridge local.',
    };
  }

  private readCapabilityLifecycleHint(capabilityId: string): { dormant: boolean; notes: string | null } {
    try {
      if (!this.capabilityLifecycleStateFile || !this.existsSync(this.capabilityLifecycleStateFile)) {
        return { dormant: false, notes: null };
      }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(this.readFileSync(this.capabilityLifecycleStateFile, 'utf8')) as Record<string, any>;
      const capability = parsed?.capabilities?.[capabilityId];
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
    } catch (error: unknown) {logger.warn('[Discord way Repair Flow] filesystem check failed', error);
    return { dormant: false, notes: null };
  }
  }
}
