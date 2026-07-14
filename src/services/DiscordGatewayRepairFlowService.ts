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
        summary: 'Discord nao esta habilitado neste runtime.',
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
        summary: 'Discord nativo is configured, mas dormente no perfil atual.',
        recommendedActions: [],
        nextStep: lifecycle.notes
          ? `${lifecycle.notes} Use perfil full ou habilite a capability discord quando quiser preaquecer o gateway.`
          : 'Use perfil full ou habilite a capability discord quando quiser preaquecer o gateway.',
      };
    }

    if (snapshot.started) {
      return {
        status: 'healthy',
        summary: snapshot.mode === 'native'
          ? 'O gateway nativo do Discord esta saudavel.'
          : 'O Discord bridge esta saudavel.',
        recommendedActions: [],
        nextStep: null,
      };
    }

    const recommendedActions = snapshot.mode === 'native'
      ? ['/autorepair', '/reload']
      : ['/autorepair', '/reload'];
    const summary = snapshot.lastError
      ? `${snapshot.mode === 'native' ? 'Discord nativo' : 'Discord bridge'} degradado: ${snapshot.lastError}`
      : `${snapshot.mode === 'native' ? 'Discord nativo' : 'Discord bridge'} ainda nao entrou em estado pronto.`;

    return {
      status: 'attention',
      summary,
      recommendedActions,
      nextStep: snapshot.mode === 'native'
        ? 'Use /autorepair ou /reload para reconciliar o gateway nativo do Discord.'
        : 'Use /autorepair ou /reload para reconciliar o Discord bridge local.',
    };
  }

  private readCapabilityLifecycleHint(capabilityId: string): { dormant: boolean; notes: string | null } {
    try {
      if (!this.capabilityLifecycleStateFile || !this.existsSync(this.capabilityLifecycleStateFile)) {
        return { dormant: false, notes: null };
      }

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

