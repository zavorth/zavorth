import { HTTP_STATUS } from "../config/constants";
import { errorResponse } from "../utils/error";

export interface ComboModel {
  model: string;
  weight?: number;
  priority?: number;
}

export interface ComboConfigDef {
  id?: string;
  name: string;
  models: Array<string | ComboModel>;
  strategy: string;
  config?: Record<string, unknown>;
  isHidden?: boolean;
  [key: string]: unknown;
}

export async function handleComboChat(args: {
  body: Record<string, unknown>;
  combo: ComboConfigDef;
  handleSingleModel: (body: Record<string, unknown>, model: string) => Promise<Response>;
  isModelAvailable: (model: string) => Promise<boolean>;
}): Promise<Response> {
  const { combo, handleSingleModel, isModelAvailable } = args;
  const models = combo.models || [];
  const strategy = combo.strategy || "priority";

  const sorted = strategy === "priority"
    ? [...models].sort((a, b) => (getModelPriority(a) - getModelPriority(b)))
    : models;

  let lastError: string | null = null;

  for (const entry of sorted) {
    const modelStr = typeof entry === "string" ? entry : entry.model;
    if (!modelStr) continue;

    const available = await isModelAvailable(modelStr);
    if (!available) continue;

    try {
      const response = await handleSingleModel(args.body, modelStr);
      if (response.ok) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return errorResponse(
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    `All combo models exhausted${lastError ? `: ${lastError}` : ""}`
  );
}

export function validateComboDAG(name: string, combos: ComboConfigDef[]): void {
  if (!name) throw new Error("Combo name required");
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(comboName: string): void {
    if (visiting.has(comboName)) {
      throw new Error(`Circular reference detected in combo: ${comboName}`);
    }
    if (visited.has(comboName)) return;
    visiting.add(comboName);
    const combo = combos.find((c) => c.name === comboName);
    if (combo?.models) {
      for (const m of combo.models) {
        const modelStr = typeof m === "string" ? m : m.model;
        if (modelStr && combos.some((c) => c.name === modelStr)) {
          visit(modelStr);
        }
      }
    }
    visiting.delete(comboName);
    visited.add(comboName);
  }

  visit(name);
}

function getModelPriority(model: string | ComboModel): number {
  return typeof model === "object" && model.priority ? model.priority : 999;
}
