import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';

export function normalizeIntegrationId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function suggestTemplateFromName(rawValue: string, manifests: IntegrationManifest[]): IntegrationManifest {
  const getManifestById = (id: string): IntegrationManifest | null => {
    const normalized = normalizeIntegrationId(id);
    return manifests.find((manifest) => normalizeIntegrationId(manifest.id) === normalized) || null;
  };

  if (/(docker|container|cloud|agent|sidecar)/i.test(rawValue)) {
    return getManifestById('custom-docker-agent') || manifests[0]!;
  }

  if (/(cli|terminal|binary|exec)/i.test(rawValue)) {
    return getManifestById('custom-cli') || manifests[0]!;
  }

  return getManifestById('custom-api') || manifests[0]!;
}
