import { NextResponse } from "next/server";
import { deleteMemory, listMemories } from "@/lib/memory/store";
import { MemoryType } from "@/lib/memory/types";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../runtime-engine-state";

export const runtime = "nodejs";

function normalizeLimit(value: string | null): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(100, Math.max(1, parsed));
}

function memoryFact(memory: Awaited<ReturnType<typeof listMemories>>[number]) {
  return {
    id: memory.id,
    key: memory.key || memory.id,
    type: memory.type,
    content: memory.content,
    sessionId: memory.sessionId || "",
    metadata: memory.metadata || {},
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    expiresAt: memory.expiresAt ? memory.expiresAt.toISOString() : null,
  };
}

async function listDashboardMemoryFacts(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || undefined;
  const type = searchParams.get("type") as MemoryType | null;
  const memories = await listMemories({
    sessionId,
    type: type && Object.values(MemoryType).includes(type) ? type : undefined,
    limit: normalizeLimit(searchParams.get("limit")),
  });
  return {
    ok: true,
    contractVersion: "2026-05-30.zavorthControl.memory-facts.v1",
    query: {
      sessionId: sessionId || "",
      limit: normalizeLimit(searchParams.get("limit")),
    },
    facts: memories.map(memoryFact),
    stats: {
      total: memories.length,
      persisted: memories.length,
    },
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json(await listDashboardMemoryFacts(request));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "memory facts unavailable",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }

  const body = await readJsonBody(request);
  const action = String(body.action || "").trim().toLowerCase();
  const id = String(body.id || body.memoryId || body.key || "").trim();
  if (action !== "forget") {
    return NextResponse.json({
      ok: false,
      error: "unsupported memory action",
      allowedActions: ["forget"],
    }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({
      ok: false,
      error: "memory id is required",
    }, { status: 400 });
  }

  const forgotten = await deleteMemory(id);
  if (!forgotten) {
    return NextResponse.json({
      ok: false,
      error: "memory fact not found",
      id,
    }, { status: 404 });
  }

  const url = new URL(request.url);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  const memory = await listDashboardMemoryFacts(new Request(url));
  return NextResponse.json({
    ok: true,
    action: "forget",
    forgotten: { id },
    memory,
  });
}
