import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import {
  setThinkingBudgetConfig,
  getThinkingBudgetConfig,
  type ThinkingBudgetConfig,
} from "@ZavorthGateway/open-sse/services/thinkingBudget.ts";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

import { updateThinkingBudgetSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';

type ThinkingBudgetInput = {
  mode?: "passthrough" | "auto" | "custom" | "adaptive";
  customBudget?: number;
  effortLevel?: "none" | "low" | "medium" | "high";
  baseBudget?: number;
  complexityMultiplier?: number;
};

function toThinkingBudgetConfig(body: ThinkingBudgetInput): ThinkingBudgetConfig {
  const mode = body.mode || "passthrough";
  if (mode === "custom") {
    return { mode: "budget", budgetTokens: body.customBudget ?? body.baseBudget };
  }
  if (mode === "auto" || mode === "adaptive") {
    const effortByLevel: Record<Exclude<ThinkingBudgetInput["effortLevel"], undefined>, "low" | "medium" | "high"> = {
      none: "low",
      low: "low",
      medium: "medium",
      high: "high",
    };
    return { mode: "effort", effort: body.effortLevel ? effortByLevel[body.effortLevel] : "medium" };
  }
  return { mode: "none" };
}export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const config = getThinkingBudgetConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {console.error("Error reading thinking budget config:", error);
    return NextResponse.json({ error: "Failed to read thinking budget config" }, { status: 500 });
  }
}

export async function PUT(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] filesystem check failed', error);
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(updateThinkingBudgetSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    // Apply config in-memory
    setThinkingBudgetConfig(toThinkingBudgetConfig(body));

    // Persist to settings DB
    await updateSettings({ thinkingBudget: body });

    return NextResponse.json(getThinkingBudgetConfig());
  } catch (error: unknown) {console.error("Error updating thinking budget config:", error);
    return NextResponse.json({ error: "Failed to update thinking budget config" }, { status: 500 });
  }
}
