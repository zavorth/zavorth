let defaultFastServiceTierEnabled = false;

export function setDefaultFastServiceTierEnabled(enabled: boolean): void {
  defaultFastServiceTierEnabled = Boolean(enabled);
}

export function isDefaultFastServiceTierEnabled(): boolean {
  return defaultFastServiceTierEnabled;
}
