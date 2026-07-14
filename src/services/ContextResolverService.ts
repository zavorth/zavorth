import path from 'path';
import {
  WorkspaceProfileService,
  type WorkspaceProfile,
} from './WorkspaceProfileService.js';
import { logger } from '../logger.js';

import { MccPathfinderService } from './MccPathfinderService.js';
import {
isMnemosAvailable,
  buildMnemosCognitiveInstruction,
} from './MnemosCognitiveProtocol.js';
export type ContextResolverLayer = {
  id: string;
  label: string;
  summary: string;
  source: string | null;
};

export type ContextResolverSnapshot = {
  workspace: string;
  workspaceName: string;
  instructionFile: string | null;
  instructionSources: string[];
  skillDirectories: string[];
  instructionSummary: string;
  instructionNotes: string[];
  workspaceCommands: Array<{ name: string; template: string }>;
  workspaceHooks: Array<{ event: string; command: string }>;
  layers: ContextResolverLayer[];
};

type ContextResolverOptions = {
  workspaceProfileService?: WorkspaceProfileService;
  globalPolicySummary?: string | null;
  /** Nomes das tools MCP atualmente conectadas. Usado para decidir se inclui a layer do Mnemos. */
  connectedToolNames?: string[];
  connectedToolNamesProvider?: () => string[] | Promise<string[]>;
};

type ResolveContextInput = {
  workspace: string;
  sessionOverrides?: string[] | null;
  capabilityIds?: string[] | null;
  toolContracts?: string[] | null;
  userRequest?: string | null;
};

export class ContextResolverService {
  private readonly workspaceProfiles: WorkspaceProfileService;
  private readonly globalPolicySummary: string;
  private readonly connectedToolNames: string[];
  private readonly connectedToolNamesProvider: (() => string[] | Promise<string[]>) | null;
  private readonly pathfinder = new MccPathfinderService();

  constructor(options: ContextResolverOptions = {}) {
    this.workspaceProfiles = options.workspaceProfileService || new WorkspaceProfileService();
    this.globalPolicySummary = String(
      options.globalPolicySummary
      || 'Politica global do Zavorth: core leve por padrao, approvals para mutacoes sensiveis e capabilities sob demanda.',
    ).trim();
    this.connectedToolNames = options.connectedToolNames || [];
    this.connectedToolNamesProvider = options.connectedToolNamesProvider || null;
  }

  public async resolve(input: ResolveContextInput): Promise<ContextResolverSnapshot> {
    const workspace = path.resolve(String(input.workspace || '').trim() || process.cwd());
    const profile = await this.workspaceProfiles.getProfile(workspace) || {
      workspace: workspace.replace(/\\/g, '/'),
      workspace_name: path.basename(workspace),
      slug: path.basename(workspace).toLowerCase(),
      summary: 'Workspace sem profile persistido; usando contexto minimo.',
      preferred_executors: {
        code_editing: 'local',
        code_review: 'local',
        research: 'local',
        design: 'local',
        automation: 'local',
      },
      last_refreshed: new Date(0).toISOString(),
      instruction_file: null,
      instruction_summary: '',
      instruction_notes: [],
      instruction_sources: [],
      package_manager: null,
      scripts: {},
      detected_stacks: [],
      frameworks: [],
      languages: [],
      important_paths: [],
      workspace_commands: [],
      workspace_hooks: [],
      skill_directories: [],
    };
    const capabilityIds = Array.isArray(input.capabilityIds)
      ? input.capabilityIds.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const toolContracts = Array.isArray(input.toolContracts)
      ? input.toolContracts.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const sessionOverrides = Array.isArray(input.sessionOverrides)
      ? input.sessionOverrides.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const userRequest = String(input.userRequest || '').trim();

    return {
      workspace,
      workspaceName: path.basename(workspace),
      instructionFile: profile.instruction_file || null,
      instructionSources: profile.instruction_sources || [],
      skillDirectories: profile.skill_directories || [],
      instructionSummary: profile.instruction_summary || '',
      instructionNotes: profile.instruction_notes || [],
      workspaceCommands: profile.workspace_commands || [],
      workspaceHooks: profile.workspace_hooks || [],
      layers: await this.buildLayers(profile, {
        capabilityIds,
        toolContracts,
        sessionOverrides,
        userRequest,
      }),
    };
  }

  private async buildLayers(
    profile: WorkspaceProfile,
    input: {
      capabilityIds: string[];
      toolContracts: string[];
      sessionOverrides: string[];
      userRequest: string;
    },
  ): Promise<ContextResolverLayer[]> {
    const layers: ContextResolverLayer[] = [
      {
        id: 'global-policy',
        label: 'Politica global do Zavorth',
        summary: this.globalPolicySummary,
        source: 'zavorth://policy/global',
      },
    ];

    if (profile.instruction_file || profile.instruction_summary) {
      layers.push({
        id: 'workspace-manual',
        label: 'ZAVORTH.md do workspace',
        summary: profile.instruction_summary || 'Workspace com manual operacional Zavorth.',
        source: profile.instruction_file || null,
      });
    }

    const agentsSource = (profile.instruction_sources || []).find((entry) => /(^|[\\/])agents\.md$/i.test(entry));
    if (agentsSource) {
      layers.push({
        id: 'agents-compat',
        label: 'Compatibilidade AGENTS.md',
        summary: 'Compatibilidade opcional com convencoes de agentes do workspace.',
        source: agentsSource,
      });
    }

    if ((profile.skill_directories || []).length > 0) {
      layers.push({
        id: 'workspace-skills',
        label: 'Skills locais',
        summary: `Skills locais detectadas em ${profile.skill_directories.join(', ')}.`,
        source: profile.skill_directories[0] || null,
      });
    }

    if (input.capabilityIds.length > 0) {
      layers.push({
        id: 'capabilities',
        label: 'Capabilities disponiveis',
        summary: `Capabilities sob demanda visiveis para esta sessao: ${input.capabilityIds.join(', ')}.`,
        source: 'zavorth://capabilities',
      });
    }

    if (input.toolContracts.length > 0) {
      layers.push({
        id: 'tool-contracts',
        label: 'Contratos de tool',
        summary: `Executores padronizados nesta sessao: ${input.toolContracts.join(', ')}.`,
        source: 'zavorth://tools/contracts',
      });
    }

    const connectedToolNames = await this.resolveConnectedToolNames();
    if (isMnemosAvailable(connectedToolNames)) {
      layers.push({
        id: 'mnemos-cognitive-protocol',
        label: 'Protocolo Cognitivo Mnemos',
        summary: buildMnemosCognitiveInstruction(),
        source: 'zavorth://mnemos/cognitive-protocol',
      });
    }

    if (input.sessionOverrides.length > 0) {
      layers.push({
        id: 'session-overrides',
        label: 'Overrides da sessao',
        summary: input.sessionOverrides.join(' | '),
        source: 'zavorth://session/overrides',
      });
    }

    if (input.userRequest) {
      try {
        const mccContext = await this.pathfinder.resolveContextForQuery(input.userRequest);
        if (mccContext) {
          layers.push({
            id: 'mcc-graph-path',
            label: 'Nexo Cognitivo (Caminhos Relacionais)',
            summary: mccContext,
            source: 'zavorth://mcc/graph-path',
          });
        }
      } catch (error: unknown) {logger.warn('[Context Resolver] MccPathfinderService failed to resolve context:', error);
      }

      layers.push({
        id: 'user-request',
        label: 'Pedido do usuario',
        summary: input.userRequest,
        source: 'zavorth://session/request',
      });
    }

    return layers;
  }

  private async resolveConnectedToolNames(): Promise<string[]> {
    if (!this.connectedToolNamesProvider) {
      return this.connectedToolNames;
    }

    try {
      return await this.connectedToolNamesProvider();
    } catch (error: unknown) {logger.warn('[Context Resolver] connection failed', error); return this.connectedToolNames; }
  }
}
