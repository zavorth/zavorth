import { NextResponse } from "next/server";
import {
  getRuntimeEngineApiState,
  isExecutionEngineId,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../runtime-engine-state";

export const runtime = "nodejs";

const MAX_CANVAS_FILES = 32;
const MAX_CANVAS_FILE_CHARS = 256 * 1024;
const MAX_CANVAS_TEXT_ITEMS = 64;
const MAX_CANVAS_TEXT_CHARS = 128 * 1024;

function normalizeCanvasPath(value: unknown): string | null {
  const filePath = typeof value === "string" ? value.trim().replace(/\\/g, "/").replace(/^\/+/, "") : "";
  if (!filePath || filePath.includes("..") || filePath.length > 180) return null;
  return filePath;
}

function normalizeFiles(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .slice(0, MAX_CANVAS_FILES)
    .filter((file): file is Record<string, unknown> => Boolean(file) && typeof file === "object" && !Array.isArray(file))
    .map((file) => {
      const filePath = normalizeCanvasPath(file.path) ?? "index.html";
      const content = typeof file.content === "string" ? file.content.slice(0, MAX_CANVAS_FILE_CHARS) : "";
      const mimeType = typeof file.mimeType === "string" && file.mimeType.length < 80 ? file.mimeType : "text/plain";
      return { path: filePath, content, mimeType };
    });
}

function normalizeStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_CANVAS_TEXT_ITEMS)
      .map((item) => item.slice(0, MAX_CANVAS_TEXT_CHARS))
    : undefined;
}

export async function GET(request: Request) {
  const { canvasSessions } = getRuntimeEngineApiState();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const session = await canvasSessions.getOrCreate(sessionId);
  return NextResponse.json({
    ok: true,
    session,
    diagnostics: canvasSessions.diagnostics(),
  });
}

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }
  const body = await readJsonBody(request);
  const { canvasSessions } = getRuntimeEngineApiState();
  const files = normalizeFiles(body.files);
  const diffs = normalizeStringArray(body.diffs);
  const logs = normalizeStringArray(body.logs);

  if (body.speculativeAutonomy && typeof body.speculativeAutonomy === "object") {
    return NextResponse.json({
      ok: false,
      error: "speculative autonomy sync is internal-only",
    }, { status: 403 });
  }

  if (typeof body.sessionId === "string" && body.action === "add-attempt") {
    const session = await canvasSessions.addAttempt({
      sessionId: body.sessionId,
      sandboxRunId: typeof body.sandboxRunId === "string" ? body.sandboxRunId : null,
      files,
      diffs,
      logs,
      summary: typeof body.summary === "string" ? body.summary : undefined,
    });
    return NextResponse.json({
      ok: Boolean(session),
      session,
      diagnostics: canvasSessions.diagnostics(),
    }, { status: session ? 200 : 404 });
  }

  const session = await canvasSessions.create({
    engineId: isExecutionEngineId(body.engineId) ? body.engineId : "lite",
    sandboxRunId: typeof body.sandboxRunId === "string" ? body.sandboxRunId : null,
    files,
    diffs,
    logs,
    summary: typeof body.summary === "string" ? body.summary : undefined,
  });
  return NextResponse.json({
    ok: true,
    session,
    diagnostics: canvasSessions.diagnostics(),
  });
}
