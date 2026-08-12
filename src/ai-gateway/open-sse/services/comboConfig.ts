import type { ComboConfigDef } from "./combo";

export function resolveComboConfig(
  model: string,
  allCombos: ComboConfigDef[]
): ComboConfigDef | null {
  return allCombos.find((c) => c.models.some((m) => (typeof m === "string" ? m === model : m.model === model))) ?? null;
}
