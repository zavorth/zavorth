import type { CapabilityPackCategory } from '../src/contracts/CapabilityPackCatalogContract.js';
import { ZavorthCapabilityPackCatalogApiService } from '../src/services/ZavorthCapabilityPackCatalogApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const manifestOnly = args.includes('--manifest');
const packId = readOption('--pack') || readOption('--pack-id') || readOption('--inspect');
const category = readOption('--category') as CapabilityPackCategory | null;
const api = new ZavorthCapabilityPackCatalogApiService();

if (manifestOnly) {
  const manifests = api.listManifests({ packId, category });
  console.log(JSON.stringify(packId ? manifests[0] || null : manifests, null, 2));
} else if (asJson) {
  console.log(JSON.stringify(api.buildSnapshot({ packId, category }), null, 2));
} else {
  console.log(api.renderReport({ packId, category }));
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}
