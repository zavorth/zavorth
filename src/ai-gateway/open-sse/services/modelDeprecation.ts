const BUILT_IN_ALIASES: Record<string, string> = {};

let customAliases: Record<string, string> = {};

export function setCustomAliases(aliases: Record<string, unknown>): void {
  const coerced: Record<string, string> = {};
  for (const [key, value] of Object.entries(aliases)) {
    if (typeof value === "string") coerced[key] = value;
  }
  customAliases = coerced;
}

export function getCustomAliases(): Record<string, string> {
  return { ...customAliases };
}

export function getBuiltInAliases(): Record<string, string> {
  return { ...BUILT_IN_ALIASES };
}

export function getAllAliases(): Record<string, string> {
  return { ...BUILT_IN_ALIASES, ...customAliases };
}

export function addCustomAlias(from: string, to: string): void {
  customAliases[from] = to;
}

export function removeCustomAlias(from: string): boolean {
  if (!(from in customAliases)) return false;
  delete customAliases[from];
  return true;
}
