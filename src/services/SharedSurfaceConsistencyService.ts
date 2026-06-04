import {
  getDiscordSlashCommandManifest,
  getSharedSurfaceCommandContract,
  type SharedSurfaceCommandContractEntry,
} from './SharedSurfaceCommandContract.js';
import { buildActions } from '../domain/surface/infrastructure/shared-surface-consistency/SharedSurfaceConsistencyActions.js';
import {
  buildSummary,
  mapCommand,
  RECOMMENDED_COMMANDS,
} from '../domain/surface/infrastructure/shared-surface-consistency/SharedSurfaceConsistencyCommands.js';
import {
  buildDiscordReadiness,
  buildTelegramReadiness,
  buildWebReadiness,
} from '../domain/surface/infrastructure/shared-surface-consistency/SharedSurfaceConsistencyReadiness.js';
import type {
  SharedSurfaceConsistencyManifestOptions,
  SharedSurfaceConsistencyOptions,
  SurfaceConsistencyActionContext,
  SurfaceConsistencyActionSnapshot,
  SurfaceConsistencyCategory,
  SurfaceConsistencyCommandSnapshot,
  SurfaceConsistencyManifest,
  SurfaceConsistencySurfaceActionSnapshot,
} from '../domain/surface/infrastructure/shared-surface-consistency/SharedSurfaceConsistencyTypes.js';

export type {
  SharedSurfaceConsistencyManifestOptions,
  SharedSurfaceConsistencyOptions,
  SurfaceConsistencyActionContext,
  SurfaceConsistencyActionSnapshot,
  SurfaceConsistencyCategory,
  SurfaceConsistencyCommandSnapshot,
  SurfaceConsistencyManifest,
  SurfaceConsistencySurfaceActionSnapshot,
} from '../domain/surface/infrastructure/shared-surface-consistency/SharedSurfaceConsistencyTypes.js';

export class SharedSurfaceConsistencyService {
  private readonly now: () => Date;
  private readonly surfaceReadiness: SharedSurfaceConsistencyOptions['surfaceReadiness'];

  constructor(options: SharedSurfaceConsistencyOptions = {}) {
    this.now = options.now || (() => new Date());
    this.surfaceReadiness = options.surfaceReadiness || {};
  }

  public buildManifest(options: SharedSurfaceConsistencyManifestOptions = {}): SurfaceConsistencyManifest {
    const webReadiness = buildWebReadiness(this.surfaceReadiness);
    const telegramReadiness = buildTelegramReadiness(this.surfaceReadiness);
    const discordReadiness = buildDiscordReadiness(this.surfaceReadiness);
    const contract = getSharedSurfaceCommandContract();
    const discordSlashEntries = getDiscordSlashCommandManifest({
      commandExposure: discordReadiness.commandExposure,
      publicServerMode: discordReadiness.publicServerMode,
    });
    const discordSlashMap = new Map<string, SharedSurfaceCommandContractEntry>(
      discordSlashEntries.map((entry) => [entry.commandType, entry]),
    );
    const readiness = {
      webReady: webReadiness.ready,
      telegramReady: telegramReadiness.ready,
    };
    const commands = contract.map((entry) => mapCommand(entry, discordSlashMap, readiness));
    const discordSlashReadyCount = commands.filter((entry) => entry.availability.discord === 'slash').length;
    const actions = buildActions(options.context || null, readiness);

    return {
      generatedAt: this.now().toISOString(),
      summary: buildSummary({
        totalCommands: commands.length,
        actionCount: actions.length,
        webReady: webReadiness.ready,
        telegramReady: telegramReadiness.ready,
        discordSlashReadyCount,
      }),
      surfaces: {
        web: {
          ready: webReadiness.ready,
          summary: webReadiness.summary,
        },
        telegram: {
          ready: telegramReadiness.ready,
          summary: telegramReadiness.summary,
        },
        discord: {
          enabled: discordReadiness.enabled,
          commandExposure: discordReadiness.commandExposure,
          publicServerMode: discordReadiness.publicServerMode,
          slashReadyCount: discordSlashReadyCount,
          summary: discordReadiness.summary(discordSlashReadyCount),
        },
      },
      counts: {
        total: commands.length,
        webReady: webReadiness.ready ? commands.length : 0,
        telegramReady: telegramReadiness.ready ? commands.length : 0,
        discordSlashReadyCount,
      },
      actions,
      recommended: commands.filter((entry) => RECOMMENDED_COMMANDS.has(entry.commandType)),
      commands,
    };
  }
}
