import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildComboTestRequestBody, extractComboTestResponseText } from "@/lib/combos/testHealth";
import { getComboByName } from "@/lib/localDb";
import { getZavorthNoCacheHeaders } from "@/sse/transportPlane";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { testComboSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { logger } from '@/shared/utils/logger';
async function testComboModel(modelStr, internalUrl) {
  const startTime = Date.now();
  try {
    // Send a minimal but real chat request through the same internal
    // endpoint an external OpenAI-compatible client would use.
    const testBody = buildComboTestRequestBody(modelStr);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(internalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Internal zavorthControl tests still use the normal /v1 pipeline but
          // bypass REQUIRE_API_KEY so admins can test with local session auth.
          "X-Internal-Test": "combo-health-check",
          // Force a fresh execution path so combo tests cannot be satisfied by
          // Zavorth's semantic cache or other request reuse layers.
          ...getZavorthNoCacheHeaders(),
          "X-Request-Id": `combo-test-${randomUUID()}`,
        },
        body: JSON.stringify(testBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      let responseBody = null;
      try {
        responseBody = await res.json();
      } catch (error: unknown) {logger.warn('[route] cache operation failed', error);
    responseBody = null;
  }

      const responseText = extractComboTestResponseText(responseBody);
      if (!responseText) {
        return {
          model: modelStr,
          status: "error",
          statusCode: res.status,
          error: "Provider returned HTTP 200 but no text content.",
          latencyMs,
        };
      }

      return { model: modelStr, status: "ok", latencyMs, responseText };
    }

    let errorMsg = "";
    try {
      const errBody = await res.json();
      errorMsg = errBody?.error?.message || errBody?.error || res.statusText;
    } catch (error: unknown) {logger.warn('[route] network request failed', error);
    errorMsg = res.statusText;
  }

    return {
      model: modelStr,
      status: "error",
      statusCode: res.status,
      error: errorMsg,
      latencyMs,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    return {
      model: modelStr,
      status: "error",
      error: error.name === "AbortError" ? "Timeout (20s)" : error.message,
      latencyMs,
    };
  }
}

/**
 * POST /api/combos/test - Quick test a combo
 * Sends a real chat completion request through each model in the combo
 * and only reports success when the model returns usable text content.
 */
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error: unknown) {logger.warn('[route] operation failed', error);
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
    const validation = validateBody(testComboSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { comboName } = validation.data;

    const combo = await getComboByName(comboName);
    if (!combo) {
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    const models = (combo.models || []).map((m) => (typeof m === "string" ? m : m.model));

    if (models.length === 0) {
      return NextResponse.json({ error: "Combo has no models" }, { status: 400 });
    }

    const internalUrl = `${getBaseUrl(request)}/v1/chat/completions`;
    const results = await Promise.all(
      models.map((modelStr) => testComboModel(modelStr, internalUrl))
    );
    const resolvedBy = results.find((result) => result.status === "ok")?.model || null;

    return NextResponse.json({
      comboName,
      strategy: combo.strategy || "priority",
      resolvedBy,
      results,
      testedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {console.log("Error testing combo:", error);
    return NextResponse.json({ error: "Failed to test combo" }, { status: 500 });
  }
}

/**
 * Get the base URL for same-origin internal requests.
 */
function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
