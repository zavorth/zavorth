import type { ZavorthClient, PlatformCatalogDTO } from '../../sdk/typescript/src';
import {
  PUBLIC_ECOSYSTEM_CONTRACTS,
  PUBLIC_ECOSYSTEM_CONTRACT_VERSION,
  type PublicEcosystemContractArea,
  type PublicEcosystemContractDescriptor,
  type PublicEcosystemContractStability,
} from '../../src/runtime/agent/index.js';

export type PublicEcosystemContractSummary = {
  version: string;
  total: number;
  stable: number;
  experimental: number;
  areas: Record<PublicEcosystemContractArea, number>;
  restEndpoint: '/api/v1/platform/catalog';
};

function emptyAreas(): Record<PublicEcosystemContractArea, number> {
  return {
    channel: 0,
    runtime: 0,
    tool: 0,
    skill: 0,
    surface: 0,
  };
}

export function summarizePublicEcosystemContracts(
  contracts: readonly PublicEcosystemContractDescriptor[] = PUBLIC_ECOSYSTEM_CONTRACTS,
): PublicEcosystemContractSummary {
  const areas = emptyAreas();
  const byStability = contracts.reduce<Record<PublicEcosystemContractStability, number>>(
    (summary, contract) => {
      summary[contract.stability] += 1;
      areas[contract.area] += 1;
      return summary;
    },
    {
      stable: 0,
      experimental: 0,
    },
  );

  return {
    version: PUBLIC_ECOSYSTEM_CONTRACT_VERSION,
    total: contracts.length,
    stable: byStability.stable,
    experimental: byStability.experimental,
    areas,
    restEndpoint: '/api/v1/platform/catalog',
  };
}

export async function readPublicPlatformCatalog(
  client: Pick<ZavorthClient, 'getPlatformCatalog'>,
  query = 'public contracts',
): Promise<PlatformCatalogDTO> {
  return client.getPlatformCatalog({ query });
}
