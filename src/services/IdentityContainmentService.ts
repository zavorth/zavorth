import { logger } from '../logger.js';

export type MigrationStatus =
  | 'legacy-active'
  | 'contained'
  | 'native-ready'
  | 'migrated'
  | 'deprecated';

export type ContaminationCategory =
  | 'executor'
  | 'capability-id'
  | 'config-key'
  | 'route'
  | 'log-message'
  | 'user-facing-string'
  | 'type-name'
  | 'file-path';

export type IdentitySurfaceZone =
  | 'launch-facing'
  | 'compatibility-quarantine'
  | 'private-archive';

export interface ContaminatedSurface {
  id: string;
  category: ContaminationCategory;
  description: string;
  location: string;
  occurrences: number;
  status: MigrationStatus;
  nativeReplacement: string | null;
  migrationRisk: number;
  notes: string;
  zone: IdentitySurfaceZone;
}

export interface IdentityMapping {
  legacyName: string;
  nativeName: string;
  context: string;
  active: boolean;
}

export class IdentityContainmentService {
  private readonly surfaces: Map<string, ContaminatedSurface> = new Map();
  private readonly mappings: Map<string, IdentityMapping> = new Map();

  constructor() {
    this.registerKnownSurfaces();
    this.registerIdentityMappings();
  }

  public resolveNativeName(legacyName: string): string {
    const mapping = this.mappings.get(legacyName.toLowerCase());
    if (mapping) {
      logger.debug(`[IdentityContainment] Resolved: ${legacyName} -> ${mapping.nativeName}`);
      return mapping.nativeName;
    }
    return legacyName;
  }

  public isLegacyName(name: string): boolean {
    return this.mappings.has(name.toLowerCase());
  }

  public getContaminationReport(): {
    totalSurfaces: number;
    totalOccurrences: number;
    byStatus: Record<MigrationStatus, number>;
    byCategory: Record<ContaminationCategory, number>;
    byZone: Record<IdentitySurfaceZone, number>;
    surfaces: ContaminatedSurface[];
  } {
    const surfaces = Array.from(this.surfaces.values());
    const totalOccurrences = surfaces.reduce((sum, surface) => sum + surface.occurrences, 0);
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byZone: Record<string, number> = {};

    for (const surface of surfaces) {
      byStatus[surface.status] = (byStatus[surface.status] || 0) + 1;
      byCategory[surface.category] = (byCategory[surface.category] || 0) + 1;
      byZone[surface.zone] = (byZone[surface.zone] || 0) + 1;
    }

    return {
      totalSurfaces: surfaces.length,
      totalOccurrences,
      byStatus: byStatus as Record<MigrationStatus, number>,
      byCategory: byCategory as Record<ContaminationCategory, number>,
      byZone: byZone as Record<IdentitySurfaceZone, number>,
      surfaces: surfaces.sort((left, right) => right.occurrences - left.occurrences),
    };
  }

  public getIdentityMappings(): IdentityMapping[] {
    return Array.from(this.mappings.values());
  }

  public getLaunchReadinessReport(): {
    launchFacingLegacySurfaces: ContaminatedSurface[];
    compatibilityQuarantineSurfaces: ContaminatedSurface[];
    privateArchiveSurfaces: ContaminatedSurface[];
    ready: boolean;
  } {
    const surfaces = Array.from(this.surfaces.values());
    const launchFacingLegacySurfaces = surfaces.filter((surface) =>
      surface.zone === 'launch-facing'
      && surface.status !== 'migrated'
      && surface.status !== 'deprecated');
    const compatibilityQuarantineSurfaces = surfaces.filter((surface) =>
      surface.zone === 'compatibility-quarantine');
    const privateArchiveSurfaces = surfaces.filter((surface) =>
      surface.zone === 'private-archive');

    return {
      launchFacingLegacySurfaces,
      compatibilityQuarantineSurfaces,
      privateArchiveSurfaces,
      ready: launchFacingLegacySurfaces.length === 0,
    };
  }

  private registerKnownSurfaces(): void {
    this.addSurface({
      id: 'runtime-agent-connectors',
      category: 'file-path',
      description: 'Governed external runtime connector surface.',
      location: 'src/runtime/external-agents/',
      occurrences: 1,
      status: 'migrated',
      nativeReplacement: 'src/runtime/execution-adapters/',
      migrationRisk: 4,
      notes: 'Current connector boundary; historical phase packs were removed from this surface.',
      zone: 'launch-facing',
    });

    this.addSurface({
      id: 'telegram-controllers',
      category: 'user-facing-string',
      description: 'Telegram controllers with legacy display strings and command labels.',
      location: 'src/telegram/controllers/',
      occurrences: 24,
      status: 'legacy-active',
      nativeReplacement: 'Zavorth-native labels per controller.',
      migrationRisk: 2,
      notes: 'Operational compatibility. Migrate by flow before public launch.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'services-legacy-refs',
      category: 'executor',
      description: 'Service references to legacy executor/capability vocabulary.',
      location: 'src/services/',
      occurrences: 16,
      status: 'contained',
      nativeReplacement: 'IdentityContainmentService.resolveNativeName().',
      migrationRisk: 3,
      notes: 'Public capability catalog is migrated; remaining references stay quarantined.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'capability-ids-legacy',
      category: 'capability-id',
      description: 'Launch-facing capability ids that previously used legacy names.',
      location: 'src/capabilities/BuiltinCapabilities.ts',
      occurrences: 0,
      status: 'migrated',
      nativeReplacement: 'executor.external, command.external-review, route-external-code-review',
      migrationRisk: 3,
      notes: 'Public catalog uses native names. Legacy commands live only in the compatibility registry.',
      zone: 'launch-facing',
    });

    this.addSurface({
      id: 'config-keys',
      category: 'config-key',
      description: 'Legacy config keys retained as private compatibility aliases.',
      location: 'src/config/',
      occurrences: 8,
      status: 'legacy-active',
      nativeReplacement: 'externalExecutorAgentId, externalExecutorBaseUrl',
      migrationRisk: 4,
      notes: 'Config key changes need an env migration path. Keep private aliases until then.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'telegram-bot-gateway',
      category: 'type-name',
      description: 'Internal Telegram bot-gateway types with legacy naming.',
      location: 'src/telegram/bot-gateway/',
      occurrences: 4,
      status: 'legacy-active',
      nativeReplacement: 'ExternalExecutorPermissionDeps, createExternalExecutorPermissionRequest',
      migrationRisk: 3,
      notes: 'Internal types. Rename after the public capability catalog is stable.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'ai-gateway-cli-tools',
      category: 'route',
      description: 'Internal CLI tool routes with legacy paths.',
      location: 'src/ai-gateway/app/api/cli-tools/',
      occurrences: 3,
      status: 'legacy-active',
      nativeReplacement: '/external-executor/ or /execution/',
      migrationRisk: 2,
      notes: 'Dashboard-internal routes. Rename with redirects when the matching UI moves.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'agents-refs',
      category: 'executor',
      description: 'Internal orchestration prompts and routing references.',
      location: 'src/agents/',
      occurrences: 3,
      status: 'contained',
      nativeReplacement: 'IdentityContainmentService.',
      migrationRisk: 2,
      notes: 'Internal prompts and routing. Keep out of public surfaces.',
      zone: 'compatibility-quarantine',
    });

    this.addSurface({
      id: 'misc-scattered',
      category: 'log-message',
      description: 'Scattered internal logs/comments in orchestrator, context-engine, and related modules.',
      location: 'src/ (scattered)',
      occurrences: 25,
      status: 'legacy-active',
      nativeReplacement: 'Progressive per-module rename.',
      migrationRisk: 1,
      notes: 'Mostly logs and comments. Low risk, outside launch-facing surfaces.',
      zone: 'compatibility-quarantine',
    });
  }

  private registerIdentityMappings(): void {
    const add = (legacy: string, native: string, context: string) => {
      this.mappings.set(legacy.toLowerCase(), {
        legacyName: legacy,
        nativeName: native,
        context,
        active: true,
      });
    };

    add('executor.external', 'executor.external', 'capability id');
    add('command.external-review', 'command.external-review', 'capability id');
    add('route-external-code-review', 'route-external-code-review', 'capability id');
    add('externalExecutorAgentId', 'externalExecutorAgentId', 'config');
    add('externalExecutorBaseUrl', 'externalExecutorBaseUrl', 'config');
    add('external_executor_agent_id', 'external_executor_agent_id', 'metadata');
    add('external_executor_agent_bindings', 'external_executor_agent_bindings', 'metadata');
    add('ExternalExecutorPermissionDeps', 'ExternalExecutorPermissionDeps', 'type');
    add('ExternalExecutor', 'ExternalExecutor', 'type');
    add('EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED', 'EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED', 'error code');
    add('/external-executor/', '/external-executor/', 'route');
    add('/external-review', '/external-review', 'command');
    add('External Executor', 'External Executor', 'display name');
  }

  private addSurface(surface: ContaminatedSurface): void {
    this.surfaces.set(surface.id, surface);
  }
}
