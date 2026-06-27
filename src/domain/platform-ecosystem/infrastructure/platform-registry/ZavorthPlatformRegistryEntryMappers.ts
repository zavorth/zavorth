import path from 'path';
import type { SkillMetadata } from '../../../../skills/SkillLoader.js';
import type { ResolvedMcpServerManifestEntry } from '../../../../mcp/McpManifest.js';
import type { LearningCandidateSnapshot } from '../../../../services/ZavorthLearningPlaneService.js';
import type { ZavorthPlatformCatalogEntry } from '../../../../services/ZavorthPlatformCatalogSourceService.js';
import type { ZavorthPluginEntry } from '../../../../services/ZavorthPluginRegistryService.js';
import type {
  ZavorthPlatformRegistryEntry,
} from '../../../../services/ZavorthPlatformRegistryService.js';
import type { PluginStateService, PluginTrustState, StoredPluginState } from '../../../../services/PluginStateService.js';
import {
  buildPlatformRegistryMcpSummary,
  describePlatformRegistrySkillSource,
  promotePlatformRegistryDiscoveryReadiness,
} from './ZavorthPlatformRegistryEntryHelpers.js';
import {
  buildPlatformBaseActions,
  buildPlatformInstallAction,
  buildPlatformRemoveAction,
  buildPlatformTrustAction,
  normalizePlatformActionId,
  normalizePlatformActionKind,
  normalizePlatformInstallState,
  normalizePlatformReadiness,
  normalizePlatformSearchText,
  normalizePlatformStateTrust,
  normalizePlatformValue,
  resolvePlatformLocalState,
} from './ZavorthPlatformRegistrySnapshotBuilderSupport.js';

export class ZavorthPlatformRegistryEntryMapper {
  constructor(
    private readonly pluginState: Pick<PluginStateService, 'getState' | 'resolveState'>,
  ) {}

  public fromPlugin(entry: ZavorthPluginEntry): ZavorthPlatformRegistryEntry {
    const trustState = entry.trust === 'trusted' ? 'trusted' : 'review';
    return {
      id: `plugin:${entry.id}`,
      label: entry.label,
      kind: 'plugin',
      source: entry.source,
      origin: entry.registrySource ? 'trusted-third-party' : 'official',
      readiness: normalizePlatformReadiness(entry.readiness),
      trust: entry.trust === 'trusted' ? 'trusted' : 'review',
      trustState,
      signatureState: entry.registrySource ? 'catalog-verified' : 'verified',
      reviewState: trustState === 'trusted' ? 'approved' : 'pending',
      installState: normalizePlatformInstallState(entry.installState),
      runtimePermissionProfile: entry.source === 'workspace-profile' ? 'workspace-skill' : 'native-runtime',
      promotedFromLearning: false,
      registrySource: entry.registrySource || null,
      provenance: {
        sourceLocator: entry.registrySource || entry.source || null,
        sourceDigest: null,
        sourceTrusted: entry.trust === 'trusted',
      },
      featured: entry.featured === true,
      discoveryOnly: false,
      summary: entry.summary,
      actionHint: entry.actionHint,
      tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
      capabilities: Array.isArray(entry.capabilities) ? entry.capabilities.slice() : [],
      details: entry.details.slice(),
      searchText: normalizePlatformSearchText([
        `plugin:${entry.id}`,
        entry.label,
        entry.summary,
        entry.searchText,
        ...entry.tags,
        ...entry.capabilities,
      ]),
      actions: entry.actions.map((action) => ({
        id: `plugin:${entry.id}:${normalizePlatformActionId(action.id)}`,
        label: action.label,
        kind: normalizePlatformActionKind(action.kind),
        command: action.command,
      })),
    };
  }

  public fromSkill(entry: SkillMetadata): ZavorthPlatformRegistryEntry {
    const skillId = `skill:${entry.name}`;
    const defaultTrust = entry.sourceTrust === 'review' ? 'review' : 'trusted';
    const localState = this.resolveLocalState(skillId, {
      installed: true,
      trust: defaultTrust,
      installedRevision: entry.skillFilePath || entry.dirPath,
    });
    const trust = localState.resolved.trust;
    const hasLocalOverride = Boolean(localState.stored);
    const sourceIsThirdParty = Boolean(
      entry.sourceRegistrySource
      || entry.provenance?.imported
      || entry.provenance?.upstreamRepository
      || entry.provenance?.upstreamSourceId,
    );
    return {
      id: skillId,
      label: entry.name,
      kind: 'skill',
      source: entry.sourceLabel || describePlatformRegistrySkillSource(entry.dirPath),
      origin: sourceIsThirdParty ? 'trusted-third-party' : 'official',
      readiness: 'ready',
      trust,
      trustState: trust === 'trusted' ? 'trusted' : 'review',
      signatureState: sourceIsThirdParty
        ? 'catalog-verified'
        : describePlatformRegistrySkillSource(entry.dirPath) === 'workspace-skills'
          ? 'workspace'
          : 'verified',
      reviewState: trust === 'trusted' ? 'approved' : 'pending',
      installState: 'installed',
      runtimePermissionProfile: 'workspace-skill',
      promotedFromLearning: false,
      registrySource: entry.sourceRegistrySource || null,
      provenance: {
        sourceLocator: entry.provenance?.upstreamRepository
          || entry.provenance?.upstreamSourceId
          || entry.sourceRegistrySource
          || entry.skillFilePath
          || null,
        sourceDigest: localState.resolved.sourceDigest || null,
        sourceTrusted: typeof localState.resolved.sourceTrusted === 'boolean'
          ? localState.resolved.sourceTrusted
          : defaultTrust === 'trusted',
      },
      featured: false,
      discoveryOnly: false,
      summary: entry.description,
      actionHint: entry.skillFilePath,
      tags: [
        'skill',
        path.basename(entry.dirPath),
        ...(entry.bundleTags || []),
        ...(entry.sourceId ? [`source:${entry.sourceId}`] : []),
      ],
      capabilities: [
        'prompt-workflow',
        ...(entry.supportFilePaths.length > 0 ? ['support-files'] : []),
        ...(entry.provenance?.imported ? ['curated-import'] : []),
      ],
      details: [
        `Diretorio: ${entry.dirPath}`,
        `Arquivo principal: ${entry.skillFilePath}`,
        ...(entry.sourceId ? [`Source: ${entry.sourceId}`] : []),
        ...(entry.sourceTrust ? [`Source trust: ${entry.sourceTrust}`] : []),
        ...(entry.license ? [`License: ${entry.license}`] : []),
        ...(entry.provenance?.upstreamSourceId
          ? [`Upstream source: ${entry.provenance.upstreamSourceId}`]
          : []),
        ...(entry.provenance?.upstreamRepository
          ? [`Upstream repository: ${entry.provenance.upstreamRepository}`]
          : []),
        `${entry.supportFilePaths.length} arquivo(s) auxiliar(es).`,
        ...(hasLocalOverride
          ? [`Lifecycle local: trust persistido como ${trust}.`]
          : []),
      ],
      searchText: normalizePlatformSearchText([
        skillId,
        entry.name,
        entry.description,
        entry.dirPath,
        entry.skillFilePath,
        ...(entry.bundleTags || []),
        entry.license || '',
        entry.provenance?.upstreamSourceId || '',
        entry.provenance?.upstreamRepository || '',
        ...entry.supportFilePaths,
      ]),
      actions: [
        ...buildPlatformBaseActions(skillId, 'Abrir arquivo', entry.skillFilePath),
        buildPlatformTrustAction(skillId, trust),
        ...(hasLocalOverride
          ? [buildPlatformRemoveAction(skillId, 'Esquecer override local')]
          : []),
      ],
    };
  }

  public fromMcp(entry: ResolvedMcpServerManifestEntry): ZavorthPlatformRegistryEntry {
    const mcpId = `mcp:${entry.id}`;
    const commandText = [entry.command, ...(entry.args || [])].filter(Boolean).join(' ').trim();
    const localState = this.resolveLocalState(mcpId, {
      installed: entry.enabled,
      trust: entry.enabled ? 'trusted' : 'review',
      installedRevision: commandText || entry.command || entry.id,
    });
    const isLocallyAdopted = true;
    const trust = entry.enabled || localState.stored
      ? localState.resolved.trust
      : 'review';
    const readiness: ZavorthPlatformRegistryEntry['readiness'] = entry.enabled
      ? 'ready'
      : 'partial';
    const installState: ZavorthPlatformRegistryEntry['installState'] = entry.enabled
      ? 'enabled'
      : 'installed';
    return {
      id: mcpId,
      label: entry.id,
      kind: 'mcp',
      source: 'mcp-manifest',
      origin: 'official',
      readiness,
      trust,
      trustState: entry.enabled
        ? 'trusted'
        : trust === 'trusted'
          ? 'trusted'
          : 'review',
      signatureState: 'workspace',
      reviewState: entry.enabled || trust === 'trusted' ? 'approved' : 'pending',
      installState,
      runtimePermissionProfile: 'mcp-exec',
      promotedFromLearning: false,
      registrySource: null,
      provenance: {
        sourceLocator: commandText || entry.command || null,
        sourceDigest: localState.resolved.sourceDigest || null,
        sourceTrusted: typeof localState.resolved.sourceTrusted === 'boolean'
          ? localState.resolved.sourceTrusted
          : entry.enabled,
      },
      featured: false,
      discoveryOnly: false,
      summary: buildPlatformRegistryMcpSummary(entry, isLocallyAdopted),
      actionHint: commandText || 'Revisar manifesto MCP.',
      tags: ['mcp', ...(entry.capability ? [entry.capability] : [])],
      capabilities: entry.capability ? [entry.capability] : [],
      details: [
        `Command: ${commandText || entry.command}`,
        `Enabled: ${entry.enabled ? 'sim' : 'nao'}`,
        entry.capability ? `Capability: ${entry.capability}` : 'Capability nao informada.',
        `Env: ${Object.keys(entry.env || {}).length} chave(s).`,
        ...(!entry.enabled
          ? ['Manifesto MCP cadastrado localmente; falta habilitar execucao apos revisao.']
          : []),
        ...(entry.enabled && localState.stored
          ? [`Lifecycle local: trust persistido como ${trust}.`]
          : []),
      ],
      searchText: normalizePlatformSearchText([
        mcpId,
        entry.id,
        entry.command,
        ...(entry.args || []),
        entry.capability || '',
        ...Object.keys(entry.env || {}),
      ]),
      actions: [
        ...buildPlatformBaseActions(mcpId, 'Abrir comando', commandText || null),
        ...(!isLocallyAdopted ? [buildPlatformInstallAction(mcpId, 'Registrar no plane local')] : []),
        ...(isLocallyAdopted ? [buildPlatformTrustAction(mcpId, trust)] : []),
        ...(localState.stored
          ? [buildPlatformRemoveAction(mcpId, 'Esquecer cadastro local')]
          : []),
      ],
    };
  }

  public fromLearningCandidate(entry: LearningCandidateSnapshot): ZavorthPlatformRegistryEntry {
    const trust: ZavorthPlatformRegistryEntry['trust'] =
      entry.lifecycle === 'trusted_local' || entry.lifecycle === 'published'
        ? 'trusted'
        : 'review';
    const trustState: ZavorthPlatformRegistryEntry['trustState'] =
      entry.lifecycle === 'quarantined'
        ? 'quarantined'
        : trust === 'trusted'
          ? 'trusted'
          : 'review';
    const readiness: ZavorthPlatformRegistryEntry['readiness'] =
      entry.lifecycle === 'quarantined'
        ? 'disabled'
        : entry.reviewState === 'approved' || entry.lifecycle === 'trusted_local' || entry.lifecycle === 'published'
          ? 'ready'
          : 'partial';
    const installState: ZavorthPlatformRegistryEntry['installState'] =
      entry.lifecycle === 'published' || entry.lifecycle === 'trusted_local'
        ? 'enabled'
        : entry.reviewState === 'approved'
          ? 'installed'
          : entry.lifecycle === 'quarantined'
            ? 'disabled'
            : 'available';

    return {
      id: entry.platformEntryId,
      label: entry.title,
      kind: 'skill',
      source: 'learning-plane',
      origin: entry.lifecycle === 'quarantined' ? 'quarantined' : 'learned-local',
      readiness,
      trust,
      trustState,
      signatureState: 'unsigned',
      reviewState: entry.reviewState,
      installState,
      runtimePermissionProfile: entry.lifecycle === 'trusted_local' || entry.lifecycle === 'published'
        ? 'workspace-skill'
        : 'learned-review',
      promotedFromLearning: entry.lifecycle === 'trusted_local' || entry.lifecycle === 'published',
      registrySource: 'learning-plane',
      provenance: {
        sourceLocator: `workflow-run:${entry.source.workflowRunId}`,
        sourceDigest: null,
        sourceTrusted: entry.reviewState === 'approved' || entry.lifecycle === 'trusted_local' || entry.lifecycle === 'published',
      },
      featured: entry.score >= 0.85,
      discoveryOnly: false,
      summary: entry.summary,
      actionHint: `/learning ${entry.lifecycle === 'trusted_local' ? 'status' : 'promote'} ${entry.id}`,
      tags: ['skill', 'learned-local', entry.kind, `review:${entry.reviewState}`],
      capabilities: ['learning-candidate', 'procedural-memory'],
      details: [
        `Candidate id: ${entry.id}`,
        `Workflow run: ${entry.source.workflowRunId}`,
        `Workspace: ${entry.source.workspace}`,
        `Lifecycle: ${entry.lifecycle}`,
        `Review: ${entry.reviewState}`,
        `Score: ${entry.score.toFixed(3)}`,
        ...entry.steps.slice(0, 4).map((step) => `Step: ${step}`),
      ],
      searchText: normalizePlatformSearchText([
        entry.platformEntryId,
        entry.id,
        entry.title,
        entry.summary,
        entry.kind,
        entry.source.workflow,
        entry.source.workspace,
        entry.source.objective,
        ...entry.steps,
      ]),
      actions: [
        ...buildPlatformBaseActions(entry.platformEntryId, 'Abrir learning plane', `/learning candidates`),
        ...(entry.reviewState === 'pending'
          ? [buildPlatformInstallAction(entry.platformEntryId, 'Aprovar draft')]
          : []),
        ...((entry.lifecycle !== 'published')
          ? [buildPlatformTrustAction(entry.platformEntryId, trust)]
          : []),
      ],
    };
  }

  public applyCatalogOverlay(
    entry: ZavorthPlatformRegistryEntry,
    catalogEntry: ZavorthPlatformCatalogEntry | null,
  ): ZavorthPlatformRegistryEntry {
    if (!catalogEntry) {
      return entry;
    }

    return {
      ...entry,
      registrySource: catalogEntry.source || entry.registrySource,
      featured: entry.featured || catalogEntry.featured === true,
      summary: entry.summary || catalogEntry.summary,
      actionHint: entry.actionHint || catalogEntry.actionHint,
      tags: Array.from(new Set([...(entry.tags || []), ...(catalogEntry.tags || [])])),
      capabilities: Array.from(new Set([...(entry.capabilities || []), ...(catalogEntry.capabilities || [])])),
      details: Array.from(new Set([...(entry.details || []), ...(catalogEntry.details || [])])),
      searchText: normalizePlatformSearchText([
        entry.searchText,
        catalogEntry.summary,
        catalogEntry.actionHint,
        ...(catalogEntry.tags || []),
        ...(catalogEntry.capabilities || []),
        ...(catalogEntry.details || []),
      ]),
    };
  }

  public fromCatalogDiscovery(entry: ZavorthPlatformCatalogEntry): ZavorthPlatformRegistryEntry {
    const localState = this.resolveLocalState(entry.id, {
      installed: false,
      trust: normalizePlatformStateTrust(entry.trust),
      installedRevision: entry.source,
    });
    const isLocallyAdopted = localState.resolved.installed;
    const trust = localState.stored
      ? localState.resolved.trust
      : entry.trust;
    const readiness = isLocallyAdopted
      ? promotePlatformRegistryDiscoveryReadiness(entry.readiness)
      : entry.readiness;
    const installState = isLocallyAdopted
      ? 'installed'
      : entry.installState;
    return {
      id: entry.id,
      label: entry.label,
      kind: entry.kind,
      source: entry.source,
      origin: 'trusted-third-party',
      readiness,
      trust,
      trustState: trust === 'trusted' ? 'trusted' : trust === 'review' ? 'review' : 'planned',
      signatureState: 'catalog-verified',
      reviewState: trust === 'trusted' ? 'approved' : 'pending',
      installState,
      runtimePermissionProfile: entry.kind === 'mcp'
        ? 'mcp-exec'
        : entry.kind === 'skill'
          ? 'catalog-discovery'
          : 'native-runtime',
      promotedFromLearning: false,
      registrySource: entry.source,
      provenance: {
        sourceLocator: entry.source || null,
        sourceDigest: localState.resolved.sourceDigest || null,
        sourceTrusted: typeof localState.resolved.sourceTrusted === 'boolean'
          ? localState.resolved.sourceTrusted
          : trust === 'trusted',
      },
      featured: entry.featured === true,
      discoveryOnly: true,
      summary: entry.summary,
      actionHint: entry.actionHint,
      tags: [...entry.tags],
      capabilities: [...entry.capabilities],
      searchText: normalizePlatformSearchText([
        entry.searchText,
        entry.summary,
        entry.actionHint,
        ...entry.tags,
        ...entry.capabilities,
        ...entry.details,
        ...(isLocallyAdopted ? ['cadastro-local'] : []),
      ]),
      actions: [
        ...buildPlatformBaseActions(entry.id, 'Abrir proximo passo', entry.actionHint || null),
        ...(!isLocallyAdopted
          ? [buildPlatformInstallAction(entry.id, 'Registrar no plane local')]
          : []),
        ...(isLocallyAdopted ? [buildPlatformTrustAction(entry.id, trust)] : []),
        ...(isLocallyAdopted
          ? [buildPlatformRemoveAction(entry.id, 'Esquecer cadastro local')]
          : []),
      ],
      details: [
        ...entry.details,
        ...(isLocallyAdopted
          ? ['Lifecycle local: cadastro persistido; ainda depende de ativacao/instalacao real.']
          : ['Disponivel apenas por discovery no registry local.']),
      ],
    };
  }

  private resolveLocalState(
    entryId: string,
    defaults: {
      installed: boolean;
      trust: PluginTrustState;
      installedRevision?: string | null;
    },
  ): {
    stored: StoredPluginState | null;
    resolved: StoredPluginState;
  } {
    return resolvePlatformLocalState(this.pluginState, entryId, defaults);
  }
}
