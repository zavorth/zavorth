import { CORS_ORIGIN } from "@/shared/utils/cors";
import { handleChat } from "@/sse/handlers/chat";
import { executeZavorthBatchJsonl } from "@/lib/zavorthBatchWorker";
import {
  createGatewayBatch,
  createGatewayGeneratedFile,
  listGatewayBatches,
  readGatewayFileContent,
  updateGatewayBatch,
  type GatewayBatchRecord,
} from "@/lib/zavorthGatewayRuntimeStore";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET() {
  return Response.json({ object: "list", data: listGatewayBatches() }, {
    headers: { "Access-Control-Allow-Origin": CORS_ORIGIN },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  let batch = createGatewayBatch(body);
  if (batch.status === "in_progress") {
    batch = await executeGatewayBatch(batch, request) || batch;
  }
  return Response.json(batch, {
    status: batch.status === "failed" ? 400 : 201,
    headers: { "Access-Control-Allow-Origin": CORS_ORIGIN },
  });
}

async function executeGatewayBatch(batch: GatewayBatchRecord, originalRequest: Request): Promise<GatewayBatchRecord | null> {
  const input = readGatewayFileContent(batch.input_file_id);
  if (!input) {
    return updateGatewayBatch(batch.id, {
      status: "failed",
      completed_at: Math.floor(Date.now() / 1000),
      request_counts: { total: 0, completed: 0, failed: 1 },
      metadata: { error: "input_file_id content was not readable" },
    });
  }

  const maxConcurrency = readPositiveInt(batch.metadata.concurrency, 4);
  const maxRetries = readPositiveInt(batch.metadata.max_retries ?? batch.metadata.maxRetries, 2);
  const backoffMs = readPositiveInt(batch.metadata.backoff_ms ?? batch.metadata.backoffMs, 250);
  const result = await executeZavorthBatchJsonl({
    jsonl: input.toString("utf8"),
    endpoint: batch.endpoint,
    options: {
      concurrency: maxConcurrency,
      maxRetries,
      backoffMs,
    },
    dispatch: async ({ body }) => {
      const response = await handleChat(new Request("http://zavorth.local/api/chat/completions", {
        method: "POST",
        headers: buildForwardHeaders(originalRequest),
        body: JSON.stringify(body || {}),
      }));
      const responseBody = await response.json().catch(async () => ({ text: await response.text().catch(() => "") }));
      return { ok: response.ok, status: response.status, body: responseBody };
    },
  });

  const outputFile = result.outputLines.length > 0
    ? createGatewayGeneratedFile({
      filename: `${batch.id}-output.jsonl`,
      purpose: "batch_output",
      content: `${result.outputLines.join("\n")}\n`,
    })
    : null;
  const errorFile = result.errorLines.length > 0
    ? createGatewayGeneratedFile({
      filename: `${batch.id}-errors.jsonl`,
      purpose: "batch_error",
      content: `${result.errorLines.join("\n")}\n`,
    })
    : null;
  return updateGatewayBatch(batch.id, {
    status: result.requestCounts.failed > 0 && result.requestCounts.completed === 0 ? "failed" : "completed",
    completed_at: Math.floor(Date.now() / 1000),
    output_file_id: outputFile?.id || null,
    error_file_id: errorFile?.id || null,
    request_counts: result.requestCounts,
    metadata: {
      execution: "zavorth-native-worker-completed",
      output_file_id: outputFile?.id || null,
      error_file_id: errorFile?.id || null,
      attempts: result.attempts,
      duration_ms: result.durationMs,
      concurrency: result.maxConcurrency,
      max_retries: result.maxRetries,
      backoff_ms: backoffMs,
    },
  });
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  headers.set("content-type", "application/json");
  headers.set("x-zavorth-gateway-batch-worker", "true");
  return headers;
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}
