import type { ArtifactDTO, NodeListDTO, TransportDTO } from '../../../contracts/public/rest/dto.js';
import type { PlatformCatalogDTO, PlatformStatusDTO } from '../../../contracts/public/rest/platform-ops-dto.js';
import type { CanonicalPublicApiSharedSupport } from './shared.js';
import type { ArtifactQuery, CanonicalPublicApiRuntime } from './types.js';

export function readPlatformStatus(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
): PlatformStatusDTO {
  const platformRegistry = runtime.getPlatformRegistry();
  if (!platformRegistry) {
    return {
      registryConnected: false,
      plugins: [],
      items: [],
      summary: {
        total: 0,
        plugins: 0,
        skills: 0,
        mcps: 0,
        trusted: 0,
        reviewPending: 0,
        quarantined: 0,
        learnedLocal: 0,
      },
    };
  }

  const snapshot = platformRegistry.buildSnapshot();
  const snapshotSummary = snapshot.summary || {
    total: snapshot.entries.length,
    plugins: snapshot.entries.filter((entry) => entry.kind === 'plugin').length,
    skills: snapshot.entries.filter((entry) => entry.kind === 'skill').length,
    mcps: snapshot.entries.filter((entry) => entry.kind === 'mcp').length,
    trusted: snapshot.entries.filter((entry) => entry.trust === 'trusted').length,
    reviewPending: snapshot.entries.filter((entry) => support.resolvePlatformReviewState(entry) === 'pending').length,
    quarantined: snapshot.entries.filter((entry) => support.resolvePlatformOrigin(entry) === 'quarantined').length,
    learnedLocal: snapshot.entries.filter((entry) => support.resolvePlatformOrigin(entry) === 'learned-local').length,
  };
  const items = snapshot.entries.map((entry) => support.mapPlatformItem(entry));
  const plugins = snapshot.entries
    .filter((entry) => entry.kind === 'plugin')
    .map((entry) => support.mapPlugin(entry));

  return {
    registryConnected: snapshot.catalogSync.status === 'ready' || snapshot.catalogSync.status === 'disabled',
    lastSync: snapshot.catalogSync.syncedAt || snapshot.catalogSync.checkedAt || undefined,
    summary: {
      total: snapshotSummary.total,
      plugins: snapshotSummary.plugins,
      skills: snapshotSummary.skills,
      mcps: snapshotSummary.mcps,
      trusted: snapshotSummary.trusted,
      reviewPending: snapshotSummary.reviewPending || 0,
      quarantined: snapshotSummary.quarantined || 0,
      learnedLocal: snapshotSummary.learnedLocal || 0,
    },
    plugins,
    items,
  };
}

export function readPlatformCatalog(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    selectedId?: string | null;
    query?: string | null;
  } = {},
): PlatformCatalogDTO {
  const platformRegistry = runtime.getPlatformRegistry();
  if (!platformRegistry) {
    return {
      generatedAt: new Date().toISOString(),
      sync: {
        status: 'disabled',
        summary: 'Platform registry unavailable in this runtime.',
        sourceTrusted: false,
        stale: false,
        entryCount: 0,
        collectionCount: 0,
        recipeCount: 0,
      },
      summary: {
        total: 0,
        plugins: 0,
        skills: 0,
        mcps: 0,
        trusted: 0,
        reviewPending: 0,
        quarantined: 0,
        learnedLocal: 0,
        collections: 0,
        featuredCollections: 0,
        recipes: 0,
        featuredRecipes: 0,
        ready: 0,
        partial: 0,
        planned: 0,
        disabled: 0,
        catalogBacked: 0,
        discoveryOnly: 0,
        featured: 0,
        official: 0,
        trustedThirdParty: 0,
      },
      items: [],
      collections: [],
      recipes: [],
      narrative: {
        headline: 'Platform registry unavailable.',
        operatorSummary: 'No public item can be read in this runtime.',
      },
    };
  }

  const selectedId = support.normalizeValue(input.selectedId);
  const query = support.normalizeValue(input.query);
  const snapshot = platformRegistry.buildSnapshot({
    selectedId,
    query,
  });

  return {
    generatedAt: snapshot.generatedAt || new Date().toISOString(),
    selectedId: selectedId || undefined,
    query: query || undefined,
    sync: {
      status: snapshot.catalogSync.status,
      summary: snapshot.catalogSync.summary,
      sourceTrusted: snapshot.catalogSync.sourceTrusted === true,
      stale: snapshot.catalogSync.stale === true,
      entryCount: Number(snapshot.catalogSync.entryCount || 0) || 0,
      collectionCount: Number(snapshot.catalogSync.collectionCount || 0) || 0,
      recipeCount: Number(snapshot.catalogSync.recipeCount || 0) || 0,
      checkedAt: snapshot.catalogSync.checkedAt || undefined,
      syncedAt: snapshot.catalogSync.syncedAt || undefined,
    },
    summary: {
      total: Number(snapshot.summary?.total || 0) || 0,
      plugins: Number(snapshot.summary?.plugins || 0) || 0,
      skills: Number(snapshot.summary?.skills || 0) || 0,
      mcps: Number(snapshot.summary?.mcps || 0) || 0,
      trusted: Number(snapshot.summary?.trusted || 0) || 0,
      reviewPending: Number(snapshot.summary?.reviewPending || 0) || 0,
      quarantined: Number(snapshot.summary?.quarantined || 0) || 0,
      learnedLocal: Number(snapshot.summary?.learnedLocal || 0) || 0,
      collections: Number(snapshot.summary?.collections || 0) || 0,
      featuredCollections: Number(snapshot.summary?.featuredCollections || 0) || 0,
      recipes: Number(snapshot.summary?.recipes || 0) || 0,
      featuredRecipes: Number(snapshot.summary?.featuredRecipes || 0) || 0,
      ready: Number(snapshot.summary?.ready || 0) || 0,
      partial: Number(snapshot.summary?.partial || 0) || 0,
      planned: Number(snapshot.summary?.planned || 0) || 0,
      disabled: Number(snapshot.summary?.disabled || 0) || 0,
      catalogBacked: Number(snapshot.summary?.catalogBacked || 0) || 0,
      discoveryOnly: Number(snapshot.summary?.discoveryOnly || 0) || 0,
      featured: Number(snapshot.summary?.featured || 0) || 0,
      official: Number(snapshot.summary?.official || 0) || 0,
      trustedThirdParty: Number(snapshot.summary?.trustedThirdParty || 0) || 0,
    },
    items: snapshot.entries.map((entry) => support.mapPlatformItem(entry)),
    collections: (snapshot.collections || []).map((entry) => ({
      id: entry.id,
      label: entry.label,
      source: entry.source,
      summary: entry.summary,
      actionHint: entry.actionHint,
      featured: entry.featured === true,
      itemCount: Number(entry.itemCount || 0) || 0,
      readyCount: Number(entry.readyCount || 0) || 0,
      adoptedCount: Number(entry.adoptedCount || 0) || 0,
      missingCount: Number(entry.missingCount || 0) || 0,
      kinds: Array.isArray(entry.kinds) ? entry.kinds.slice() : [],
      tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
      capabilities: Array.isArray(entry.capabilities) ? entry.capabilities.slice() : [],
      entryIds: Array.isArray(entry.entryIds) ? entry.entryIds.slice() : [],
    })),
    recipes: (snapshot.recipes || []).map((entry) => ({
      id: entry.id,
      label: entry.label,
      source: entry.source,
      summary: entry.summary,
      actionHint: entry.actionHint,
      featured: entry.featured === true,
      itemCount: Number(entry.itemCount || 0) || 0,
      readyCount: Number(entry.readyCount || 0) || 0,
      adoptedCount: Number(entry.adoptedCount || 0) || 0,
      missingCount: Number(entry.missingCount || 0) || 0,
      tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
      steps: Array.isArray(entry.steps) ? entry.steps.slice() : [],
      targetIds: Array.isArray(entry.targetIds) ? entry.targetIds.slice() : [],
    })),
    narrative: {
      headline: snapshot.narrative?.headline || 'Zavorth platform catalog',
      operatorSummary: snapshot.narrative?.operatorSummary || 'Public catalog ready.',
    },
  };
}

export function readNodes(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: { selectedNodeId?: string | null } = {},
): NodeListDTO {
  const nodeMesh = runtime.getNodeMesh();
  if (!nodeMesh) {
    return {
      data: [],
      total: 0,
    };
  }

  const snapshot = nodeMesh.buildSnapshot({
    selectedNodeId: support.normalizeValue(input.selectedNodeId),
  });

  return {
    data: snapshot.entries.map((entry) => ({
      id: entry.id,
      status: entry.pairingStatus === 'pending'
        ? 'pairing'
        : (entry.status === 'online' ? 'online' : 'offline'),
      lastSeen: entry.lastSeenAt || entry.updatedAt || entry.createdAt || snapshot.generatedAt,
      identity: {
        arch: String(entry.hostHints?.arch || 'unknown'),
        osRelease: String(entry.hostHints?.osRelease || entry.hostHints?.platform || 'unknown'),
        deviceModel: support.normalizeValue(entry.hostHints?.deviceModel) || undefined,
        networkType: support.normalizeValue(entry.hostHints?.networkType) || undefined,
        locationLabel: support.normalizeValue(entry.hostHints?.locationLabel) || undefined,
      },
      capabilities: [...entry.capabilityIds],
    })),
    total: snapshot.summary.total,
  };
}

export function readTransports(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: { selectedId?: string | null } = {},
): { data: TransportDTO[] } {
  const remoteTransports = runtime.getRemoteTransports();
  if (!remoteTransports) {
    return { data: [] };
  }

  const snapshot = remoteTransports.buildSnapshot({
    selectedId: support.normalizeValue(input.selectedId),
  });

  return {
    data: snapshot.entries.map((entry) => ({
      id: entry.id,
      type: entry.id,
      status: entry.available
        ? 'connected'
        : (entry.readiness === 'partial' ? 'degraded' : 'disconnected'),
      remoteUrl: entry.endpoint || undefined,
      lastPing: entry.telemetry.updatedAt || undefined,
    })),
  };
}

export async function readArtifacts(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: ArtifactQuery = {},
): Promise<{ data: ArtifactDTO[] }> {
  const sessionId = support.normalizeValue(input.sessionId);
  const chatId = support.normalizeValue(input.chatId);
  if (!sessionId && !chatId) {
    return { data: [] };
  }

  const gateway = runtime.getGateway();
  if (!gateway) {
    return { data: [] };
  }

  const snapshot = await gateway.buildHydratedSnapshot({
    userId: support.resolveUserId(input.userId),
    sessionId,
    chatId,
  });

  return {
    data: (snapshot.memoryPlane.artifacts.recent || []).map((artifact) => ({
      id: artifact.id,
      sessionId: sessionId || chatId || 'unscoped',
      type: artifact.kind || 'artifact',
      createdAt: artifact.createdAt || snapshot.generatedAt,
      title: artifact.label,
      metadata: {
        summary: artifact.summary || null,
        sourceTaskId: artifact.sourceTaskId || null,
      },
      contentUri: artifact.path || '',
    })),
  };
}
