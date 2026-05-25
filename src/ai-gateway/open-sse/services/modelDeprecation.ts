let customAliases: Record<string, unknown> = {};

export function setCustomAliases(aliases: Record<string, unknown>): void {
  customAliases = { ...aliases };
}

export function getCustomAliases(): Record<string, unknown> {
  return { ...customAliases };
}
