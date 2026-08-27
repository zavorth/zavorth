import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName, isCloudEnabled } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync";
import { validateComboDAG, type ComboConfigDef } from "@zavorth/ai-gateway/open-sse/services/combo.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createComboSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';// GET /api/combos - Get all combos
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const combos = await getCombos();
    return NextResponse.json({ combos });
  } catch (error: unknown) {logger.info("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

// POST /api/combos - Create new combo
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Zod validation (covers name format, length, etc.)
    const validation = validateBody(createComboSchema, body);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, models, strategy, config } = validation.data;

    // Check if name already exists
    const existing = await getComboByName(name);
    if (existing) {
      return NextResponse.json({ error: "Combo name already exists" }, { status: 400 });
    }

    // Validate nested combo DAG (no circular references, max depth)
    const allCombos = await getCombos();
    // Temporarily add the new combo to validate its graph
    const tempCombo = { name, models: models || [], strategy, config };
    try {
      validateComboDAG(name, [...allCombos.map(toComboConfigDef), tempCombo]);
    } catch (error: unknown) {logger.warn('[route] validation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }

    const combo = await createCombo({ name, models: models || [], strategy, config });

    // Auto sync to Cloud if enabled
    await syncToCloudIfEnabled();

    return NextResponse.json(combo, { status: 201 });
  } catch (error: unknown) {logger.info("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}

/**
 * Sync to Cloud if enabled
 */
async function syncToCloudIfEnabled() {
  try {
    const cloudEnabled = await isCloudEnabled();
    if (!cloudEnabled) return;

    const machineId = await getConsistentMachineId();
    await syncToCloud(machineId);
  } catch (error: unknown) {logger.info("Error syncing to cloud:", error);
  }
}

function toComboConfigDef(record: Record<string, unknown>): ComboConfigDef {
  const name = typeof record.name === "string" ? record.name : "";
  const models = Array.isArray(record.models)
    ? record.models.filter(
        (m): m is string | { model: string; weight?: number } =>
          typeof m === "string" ||
          (typeof m === "object" &&
            m !== null &&
            typeof (m as { model?: unknown }).model === "string")
      )
    : [];
  const strategy = typeof record.strategy === "string" ? record.strategy : "priority";
  return { name, models, strategy };
}
