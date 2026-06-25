let cliCompatProviders: string[] = [];

export function setCliCompatProviders(providers: string[] = []): void {
  cliCompatProviders = providers.filter((provider) => typeof provider === "string" && provider.trim());
}

export function getCliCompatProviders(): string[] {
  return [...cliCompatProviders];
}
