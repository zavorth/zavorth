export interface CodexModelScope {
  provider: string;
  model: string;
  scope: string;
}

let fastServiceTierEnabled = false;

export function getCodexModelScope(model: string): CodexModelScope {
  if (model.startsWith("codex-")) {
    return { provider: "codex", model, scope: "responses" };
  }
  return { provider: "openai", model, scope: "chat" };
}

export function setDefaultFastServiceTierEnabled(enabled: boolean): void {
  fastServiceTierEnabled = enabled;
}

export function isFastServiceTierEnabled(): boolean {
  return fastServiceTierEnabled;
}
