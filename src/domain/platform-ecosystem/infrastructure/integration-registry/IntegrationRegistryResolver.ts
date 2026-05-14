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
        note: 'Nenhuma integraÃƒÂ§ÃƒÂ£o foi informada. O Zavorth sugere comeÃƒÂ§ar por um template guiado.',
      };
    }

    const exact = this.manifests.find((manifest) => this.normalizeId(manifest.id) === requestedId) || null;
    if (exact) {
      return {
        requestedId,
        manifest: exact,
        matchedBy: 'id',
        suggestion: exact,
        note: 'IntegraÃƒÂ§ÃƒÂ£o encontrada diretamente pelo identificador principal.',
      };
    }

    const aliasMatch = this.manifests.find((manifest) => manifest.aliases.includes(requestedId));
    if (aliasMatch) {
      return {
        requestedId,
        manifest: aliasMatch,
        matchedBy: 'alias',
        suggestion: aliasMatch,
        note: `Resolvido por alias para "${aliasMatch.label}".`,
      };
    }

    const fuzzy = this.manifests.find((manifest) => manifest.id.includes(requestedId) || requestedId.includes(manifest.id));
    if (fuzzy) {
      return {
        requestedId,
        manifest: fuzzy,
        matchedBy: 'suggested',
        suggestion: fuzzy,
        note: `Nao encontrei "${requestedId}" exatamente, mas "${fuzzy.label}" parece ser o melhor encaixe.`,
      };
    }

    const template = this.suggestTemplateFromName(requestedId);
    return {
      requestedId,
      manifest: template,
      matchedBy: 'template',
      suggestion: template,
      note: `Ainda nao existe receita pronta para "${requestedId}". O Zavorth sugere um template seguro para comeÃƒÂ§ar.`,
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
