import type { IntegrationManifest, IntegrationResolution } from '../../../../contracts/IntegrationHubContract.js';

export class IntegrationRegistryResolver {
  constructor(private readonly manifests: IntegrationManifest[]) {}

  public listManifests(): IntegrationManifest[] {
    return this.manifests.slice().sort((a, b) => a.label.localeCompare(b.label, 'en-US'));
  }

  public getManifestById(id: string | null | undefined): IntegrationManifest | null {
    const normalized = this.normalizeId(id);
    if (!normalized) {
      return null;
    }

    return this.manifests.find((manifest) => {
      if (this.normalizeId(manifest.id) === normalized) {
        return true;
      }

      return manifest.aliases.some((alias) => this.normalizeId(alias) === normalized);
    }) || null;
  }

  public getSuggestedTemplates(): IntegrationManifest[] {
    return this.listManifests().filter((manifest) => manifest.category === 'template');
  }

  public resolveRequestedIntegration(rawValue: string | null | undefined): IntegrationResolution {
    const requestedId = this.normalizeId(rawValue);
    if (!requestedId) {
      return {
        requestedId: '',
        manifest: null,
        matchedBy: 'none',
        suggestion: this.getManifestById('custom-api'),
        note: 'No integration was provided. Zavorth suggests starting with a guided template.',
      };
    }

    const exact = this.manifests.find((manifest) => this.normalizeId(manifest.id) === requestedId) || null;
    if (exact) {
      return {
        requestedId,
        manifest: exact,
        matchedBy: 'id',
        suggestion: exact,
        note: 'Integration found directly by primary identifier.',
      };
    }

    const aliasMatch = this.manifests.find((manifest) => manifest.aliases.includes(requestedId));
    if (aliasMatch) {
      return {
        requestedId,
        manifest: aliasMatch,
        matchedBy: 'alias',
        suggestion: aliasMatch,
        note: `Resolved by alias to "${aliasMatch.label}".`,
      };
    }

    const fuzzy = this.manifests.find((manifest) => manifest.id.includes(requestedId) || requestedId.includes(manifest.id));
    if (fuzzy) {
      return {
        requestedId,
        manifest: fuzzy,
        matchedBy: 'suggested',
        suggestion: fuzzy,
        note: `No exact match for "${requestedId}", but "${fuzzy.label}" looks like the best fit.`,
      };
    }

    const template = this.suggestTemplateFromName(requestedId);
    return {
      requestedId,
      manifest: template,
      matchedBy: 'template',
      suggestion: template,
      note: `No ready-made recipe exists for "${requestedId}" yet. Zavorth suggests a safe template to start.`,
    };
  }

  private suggestTemplateFromName(rawValue: string): IntegrationManifest {
    if (/(docker|container|cloud|agent|sidecar)/i.test(rawValue)) {
      return this.getManifestById('custom-docker-agent') || this.manifests[0];
    }

    if (/(cli|terminal|binary|exec)/i.test(rawValue)) {
      return this.getManifestById('custom-cli') || this.manifests[0];
    }

    return this.getManifestById('custom-api') || this.manifests[0];
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
