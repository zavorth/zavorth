export type ProviderCatalogEntryPort = {
  id: string;
  label: string;
  ready: boolean;
  currentModel?: string | null;
  effectiveProviderName: string;
  aliases: string[];
};

export type ProviderProfilePort = {
  label: string;
};

export type ProviderControlPlanePort = {
  listProviders(input?: { includeAdvanced?: boolean }): ProviderCatalogEntryPort[];
  listProfiles(): ProviderProfilePort[];
  getCurrentConversationalProvider(): string;
  getCurrentConversationalModel(): string | null;
};
