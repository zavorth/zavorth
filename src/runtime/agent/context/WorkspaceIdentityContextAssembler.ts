import {
  ContextResolverService,
  type ContextResolverLayer,
  type ContextResolverSnapshot,
} from '../../../services/ContextResolverService.js';
import {
  FirstRunWorkspaceBootstrapProfileService,
} from '../../../services/FirstRunWorkspaceBootstrapProfileService.js';
import type {
  ZavorthWorkspaceIdentityProfileSnapshot,
} from '../../../contracts/FirstRunWorkspaceBootstrapContract.js';
import type {
  CanonicalIdentityFile,
  CanonicalWarmContextInput,
} from './CanonicalSessionContextAssembler.js';

export type WorkspaceIdentityContextResolver = Pick<ContextResolverService, 'resolve'>;
export type WorkspaceIdentityFirstRunProfileReader = Pick<
  FirstRunWorkspaceBootstrapProfileService,
  'buildWorkspaceIdentitySnapshot'
>;

export type WorkspaceIdentityContextAssemblerOptions = {
  contextResolver?: WorkspaceIdentityContextResolver | null;
  firstRunProfileReader?: WorkspaceIdentityFirstRunProfileReader | null;
};

export type WorkspaceIdentityContextInput = {
  workspace: string;
  userRequest?: string | null;
  sessionOverrides?: string[] | null;
  capabilityIds?: string[] | null;
  toolContracts?: string[] | null;
};

export type WorkspaceIdentityContextSnapshot = {
  workspace: string;
  workspaceName: string;
  warm: CanonicalWarmContextInput;
  resolverSnapshot: ContextResolverSnapshot;
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function uniqueTexts(values: Array<string | null | undefined>): string[] {
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !output.includes(normalized)) {
      output.push(normalized);
    }
  }
  return output;
}

function sourceLooksLikeIdentityFile(source: string): boolean {
  if (!source || /^zavorth:\/\//i.test(source)) {
    return false;
  }
  return /\.(?:md|markdown|txt)$/i.test(source);
}

export class WorkspaceIdentityContextAssembler {
  private readonly contextResolver: WorkspaceIdentityContextResolver;
  private readonly firstRunProfileReader: WorkspaceIdentityFirstRunProfileReader | null;

  constructor(options: WorkspaceIdentityContextAssemblerOptions = {}) {
    this.contextResolver = options.contextResolver || new ContextResolverService();
    this.firstRunProfileReader =
      options.firstRunProfileReader === undefined
        ? new FirstRunWorkspaceBootstrapProfileService()
        : options.firstRunProfileReader;
  }

  public async assemble(input: WorkspaceIdentityContextInput): Promise<WorkspaceIdentityContextSnapshot> {
    const resolverSnapshot = await this.contextResolver.resolve({
      workspace: input.workspace,
      userRequest: input.userRequest,
      sessionOverrides: input.sessionOverrides,
      capabilityIds: input.capabilityIds,
      toolContracts: input.toolContracts,
    });
    const identityFiles = this.buildIdentityFiles(resolverSnapshot);
    const firstRunProfile = this.readFirstRunProfile();
    const warm: CanonicalWarmContextInput = {
      workspacePrompt: this.buildWorkspacePrompt(resolverSnapshot),
      workspaceProfile: this.buildWorkspaceProfile(resolverSnapshot, firstRunProfile),
      identityFiles,
      metadata: {
        source: 'ContextResolverService',
        instructionFile: resolverSnapshot.instructionFile,
        instructionSources: resolverSnapshot.instructionSources,
        skillDirectories: resolverSnapshot.skillDirectories,
        workspaceLayerIds: resolverSnapshot.layers.map((layer) => layer.id),
        firstRunProfileConfigured: firstRunProfile?.configured === true,
        firstRunProfilePath: firstRunProfile?.profilePath || null,
      },
    };

    return {
      workspace: resolverSnapshot.workspace,
      workspaceName: resolverSnapshot.workspaceName,
      warm,
      resolverSnapshot,
      metadata: {
        source: 'WorkspaceIdentityContextAssembler',
        resolver: 'ContextResolverService',
        identityFileCount: identityFiles.length,
        firstRunProfileConfigured: firstRunProfile?.configured === true,
      },
    };
  }

  private buildWorkspacePrompt(snapshot: ContextResolverSnapshot): string {
    const lines = uniqueTexts([
      `Workspace: ${snapshot.workspaceName}`,
      snapshot.instructionSummary ? `Instrucoes: ${snapshot.instructionSummary}` : null,
      snapshot.instructionNotes.length > 0
        ? `Notas: ${snapshot.instructionNotes.slice(0, 4).join(' | ')}`
        : null,
      ...snapshot.layers.map((layer) => `${layer.label}: ${layer.summary}`),
    ]);

    return lines.join('\n');
  }

  private buildWorkspaceProfile(
    snapshot: ContextResolverSnapshot,
    firstRunProfile: ZavorthWorkspaceIdentityProfileSnapshot | null,
  ): Record<string, unknown> {
    return {
      workspace: snapshot.workspace,
      workspaceName: snapshot.workspaceName,
      instructionFile: snapshot.instructionFile,
      instructionSources: snapshot.instructionSources,
      instructionSummary: snapshot.instructionSummary,
      instructionNotes: snapshot.instructionNotes,
      skillDirectories: snapshot.skillDirectories,
      workspaceCommands: snapshot.workspaceCommands,
      workspaceHooks: snapshot.workspaceHooks,
      layers: snapshot.layers.map((layer) => ({
        id: layer.id,
        label: layer.label,
        source: layer.source,
      })),
      firstRunProfileConfigured: firstRunProfile?.configured === true,
      firstRunProfilePath: firstRunProfile?.profilePath || null,
      userDisplayName: firstRunProfile?.userDisplayName || null,
      agentDisplayName: firstRunProfile?.agentDisplayName || null,
      tonePreference: firstRunProfile?.tonePreference || null,
      firstRunWorkspaceRoot: firstRunProfile?.workspaceRoot || null,
      memoryMode: firstRunProfile?.memoryMode || null,
      safetyPosture: firstRunProfile?.safetyPosture || null,
      providerStatus: firstRunProfile?.providerStatus || null,
    };
  }

  private readFirstRunProfile(): ZavorthWorkspaceIdentityProfileSnapshot | null {
    if (!this.firstRunProfileReader) {
      return null;
    }
    try {
      return this.firstRunProfileReader.buildWorkspaceIdentitySnapshot();
    } catch (error: any) { const err = error; const e = error;
      return null;
    }
  }

  private buildIdentityFiles(snapshot: ContextResolverSnapshot): CanonicalIdentityFile[] {
    const bySource = new Map<string, CanonicalIdentityFile>();
    const sources = uniqueTexts([
      snapshot.instructionFile,
      ...snapshot.instructionSources,
    ]).filter(sourceLooksLikeIdentityFile);

    for (const source of sources) {
      const layer = this.findLayerForSource(snapshot.layers, source);
      bySource.set(source, {
        path: source,
        exists: true,
        content: null,
        summary: layer?.summary || snapshot.instructionSummary || null,
      });
    }

    return Array.from(bySource.values());
  }

  private findLayerForSource(layers: ContextResolverLayer[], source: string): ContextResolverLayer | null {
    return layers.find((layer) => layer.source === source) || null;
  }
}
