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
    return entry.capability ? `server MCP configured para ${entry.capability}.`
      : 'server MCP configured no manifest do runtime.';
  }

  if (isLocallyAdopted) {
    return entry.capability ? `server MCP registrado no plane para ${entry.capability}; habilitaction ainda pending.`
      : 'server MCP registrado no plane; habilitaction no manifest ainda pending.';
  }

  return entry.capability ? `server MCP configured para ${entry.capability}, mas ainda disabled no runtime.`
    : 'server MCP present no manifest, mas ainda disabled no runtime.';
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
