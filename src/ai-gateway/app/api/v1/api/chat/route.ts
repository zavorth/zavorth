import { CORS_ORIGIN } from "@/shared/utils/cors";
import { handleChat } from "@/sse/handlers/chat";
import { initTranslators } from "@ZavorthGateway/open-sse/translator/index.ts";
import { transformToOllama } from "@ZavorthGateway/open-sse/utils/ollamaTransform.ts";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../../../utils/errorLike';

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
    console.log("[SSE] Translators initialized");
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function POST(request) {
  await ensureInitialized();

  const clonedReq = request.clone();
  let rawBody: Record<string, unknown> = {};
  try {
    const parsed = await clonedReq.json();
    if (parsed && typeof parsed === "object") rawBody = parsed as Record<string, unknown>;
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err);
  }
  const modelName = typeof rawBody.model === "string" ? rawBody.model : "llama3.2";

  await handleChat(request);

  return transformToOllama({ ...rawBody, model: modelName });
}
