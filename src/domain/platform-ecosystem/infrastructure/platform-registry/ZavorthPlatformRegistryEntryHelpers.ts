import type { ResolvedMcpServerManifestEntry } from '../../../../mcp/McpManifest.js';
import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
} from '../../../../services/ZavorthPlatformRegistryService.js';

type PlatformRegistryReadiness = 'ready' | 'partial' | 'planned' | 'disabled';

export function promotePlatformRegistryDiscoveryReadiness(
  value: PlatformRegistryReadiness,
): PlatformRegistryReadiness {
  switch (value) {
    case 'ready':
    case 'partial':
      return value;
    case 'disabled':
      return 'partial';
    default:
      return 'partial';
  }
}

export function buildPlatformRegistryMcpSummary(
  entry: ResolvedMcpServerManifestEntry,
  isLocallyAdopted: boolean,
): string {
  if (entry.enabled) {
    return entry.capability
      ? `Servidor MCP configurado para ${entry.capability}.`
      : 'Servidor MCP configurado no manifesto do runtime.';
  }

  if (isLocallyAdopted) {
    return entry.capability
      ? `Servidor MCP registrado no plane para ${entry.capability}; habilitacao ainda pendente.`
      : 'Servidor MCP registrado no plane; habilitacao no manifesto ainda pendente.';
  }

  return entry.capability
    ? `Servidor MCP configurado para ${entry.capability}, mas ainda desabilitado no runtime.`
    : 'Servidor MCP presente no manifesto, mas ainda desabilitado no runtime.';
}

export function describePlatformRegistrySkillSource(dirPath: string): string {
  const normalized = String(dirPath || '').replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('/skill-library/')) {
    return 'skill-library';
  }
  if (normalized.includes('/.agents/skills/')) {
    return 'workspace-skills';
  }
  return 'skills';
}

export function buildPlatformRegistryFeaturedIds(entries: ZavorthPlatformRegistryEntry[]): string[] {
  const prioritized = [
    ...entries.filter((entry) => entry.featured),
    ...entries.filter((entry) => entry.kind === 'plugin' && entry.readiness === 'ready'),
    ...entries.filter((entry) => entry.kind === 'skill'),
    ...entries.filter((entry) => entry.kind === 'mcp' && ['enabled', 'installed'].includes(entry.installState)),
    ...entries,
  ];

  return Array.from(new Set(prioritized.map((entry) => entry.id))).slice(0, 10);
}

export function buildPlatformRegistryFeaturedCollectionIds(
  collections: ZavorthPlatformRegistryCollection[],
): string[] {
  const prioritized = [
    ...collections.filter((entry) => entry.featured),
    ...collections.filter((entry) => entry.itemCount > 0),
    ...collections,
  ];
  return Array.from(new Set(prioritized.map((entry) => entry.id))).slice(0, 6);
}

export function buildPlatformRegistryFeaturedRecipeIds(recipes: ZavorthPlatformRegistryRecipe[]): string[] {
  const prioritized = [
    ...recipes.filter((entry) => entry.featured),
    ...recipes.filter((entry) => entry.readyCount > 0),
    ...recipes,
  ];
  return Array.from(new Set(prioritized.map((entry) => entry.id))).slice(0, 6);
}
