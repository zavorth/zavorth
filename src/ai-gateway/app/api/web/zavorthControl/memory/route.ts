import { NextResponse } from "next/server";
import { deleteMemory, getMemory, listMemories, updateMemory } from "@/lib/memory/store";
import { MemoryType } from "@/lib/memory/types";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { SecurityAuditLogger } from "../../../../../../services/SecurityAuditLogger.js";
import { safeParseInt } from "../../../../../../ai-gateway/shared/utils/safeParseInt.js";
import {
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../runtime-engine-state";

export const runtime = "nodejs";

function normalizeLimit(value: string | null): number {
  const parsed = safeParseInt(value, 24);
  return Math.min(100, Math.max(1, parsed));
}

function memoryFact(memory: Awaited<ReturnType<typeof listMemories>>[number]) {
  const editable = isEditablePreferenceMemory(memory);
  return {
    id: memory.id,
    key: memory.key || memory.id,
    type: memory.type,
    content: redactSensitiveText(memory.content, 500),
    contentPreview: redactSensitiveText(memory.content, 120),
    sessionId: memory.sessionId || "",
    metadata: sanitizeMetadata(memory.metadata || {}),
    editable,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    expiresAt: memory.expiresAt ? memory.expiresAt.toISOString() : null,
  };
}

async function listZavorthControlMemoryFacts(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || undefined;
  const rawType = String(searchParams.get("type") || "").trim().toLowerCase();
  const query = String(searchParams.get("query") || searchParams.get("q") || "").trim();
  const semantic = String(searchParams.get("semantic") || "").toLowerCase() === "true";
  const memoryType = Object.values(MemoryType).includes(rawType as MemoryType)
    ? rawType as MemoryType
    : undefined;
  const sourceLimit = normalizeLimit(searchParams.get("limit"));
  const memories = await listMemories({
    sessionId,
    type: memoryType,
    limit: Math.max(sourceLimit, query || rawType === "preference" ? 100 : sourceLimit),
  });
  const filtered = memories
    .filter((memory) => rawType === "preference" ? isEditablePreferenceMemory(memory) : true)
    .filter((memory) => !query || memoryMatchesQuery(memory, query))
    .slice(0, sourceLimit);
  return {
    ok: true,
    contractVersion: "2026-05-30.zavorthControl.memory-facts.v1",
    query: {
      sessionId: sessionId || "",
      type: rawType || "",
      text: query,
      semantic,
      semanticMode: semantic ? "textual-fallback" : "off",
      limit: sourceLimit,
    },
    facts: filtered.map(memoryFact),
    stats: {
      total: filtered.length,
      persisted: filtered.length,
      sourceTotal: memories.length,
    },
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json(await listZavorthControlMemoryFacts(request));
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
  if (!["forget", "updatepreference", "exportmemory"].includes(action)) {
    return NextResponse.json({
      ok: false,
      error: "unsupported memory action",
      allowedActions: ["forget", "updatePreference", "exportMemory"],
    }, { status: 400 });
  }
  if (action === "exportmemory") {
    const url = new URL(request.url);
    if (typeof body.sessionId === "string" && body.sessionId) url.searchParams.set("sessionId", body.sessionId);
    if (typeof body.query === "string" && body.query) url.searchParams.set("query", body.query);
    if (typeof body.type === "string" && body.type) url.searchParams.set("type", body.type);
    if (typeof body.limit === "number") url.searchParams.set("limit", String(body.limit));
    const memory = await listZavorthControlMemoryFacts(new Request(url));
    return NextResponse.json({
      ok: true,
      action: "exportMemory",
      export: {
        generatedAt: new Date().toISOString(),
        facts: memory.facts,
        stats: memory.stats,
      },
    });
  }
  if (!id) {
    return NextResponse.json({
      ok: false,
      error: "memory id is required",
    }, { status: 400 });
  }

  const before = await getMemory(id);
  if (!before) {
    return NextResponse.json({
      ok: false,
      error: "memory fact not found",
      id,
    }, { status: 404 });
  }

  if (action === "updatepreference") {
    if (!isEditablePreferenceMemory(before)) {
      return NextResponse.json({
        ok: false,
        error: "memory fact is read-only",
        id,
      }, { status: 403 });
    }
    const content = String(body.content || body.value || body.preference || "").trim();
    if (!content) {
      return NextResponse.json({
        ok: false,
        error: "preference content is required",
      }, { status: 400 });
    }
    const updated = await updateMemory(id, {
      content,
      metadata: {
        ...(before.metadata || {}),
        category: before.metadata?.category || "preference",
        updatedBy: "zavorth-control",
        updatedVia: "memory-control",
      },
    });
    if (!updated) {
      return NextResponse.json({
        ok: false,
        error: "memory fact could not be updated",
        id,
      }, { status: 404 });
    }
    const after = await getMemory(id);
    const receipt = buildMemoryMutationReceipt("updatePreference", before, after || before);
    await logMemoryMutationReceipt(receipt);
    return NextResponse.json({
      ok: true,
      action: "updatePreference",
      receipt,
      memory: await listZavorthControlMemoryFacts(request),
    });
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
  const memory = await listZavorthControlMemoryFacts(new Request(url));
  const receipt = buildMemoryMutationReceipt("forget", before, null);
  await logMemoryMutationReceipt(receipt);
  return NextResponse.json({
    ok: true,
    action: "forget",
    forgotten: { id },
    receipt,
    memory,
  });
}

function memoryMatchesQuery(memory: Awaited<ReturnType<typeof listMemories>>[number], query: string): boolean {
  const normalized = query.toLowerCase();
  const metadata = JSON.stringify(memory.metadata || {});
  return `${memory.id} ${memory.key || ""} ${memory.type} ${memory.content} ${metadata}`
    .toLowerCase()
    .includes(normalized);
}

function isEditablePreferenceMemory(memory: Awaited<ReturnType<typeof listMemories>>[number]): boolean {
  const metadata = memory.metadata || {};
  const category = String(metadata.category || metadata.kind || metadata.policy || "").toLowerCase();
  return memory.type === MemoryType.PROCEDURAL || category === "preference" || category === "procedural";
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.toLowerCase();
    if (/(secret|token|apikey|api_key|password|credential|authorization)/.test(normalizedKey)) {
      safe[key] = "[redacted]";
    } else if (typeof value === "string") {
      safe[key] = redactSensitiveText(value, 160);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function redactSensitiveText(value: string, maxLength: number): string {
  return String(value || "")
    .replace(/AIzaSy[A-Za-z0-9_-]{20,}/g, "[redacted-api-key]")
    .replace(/\b(sk|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{20,}\b/g, "[redacted-token]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted-token]")
    .replace(/-----BEGIN[ A-Z]+PRIVATE KEY-----[\s\S]+?-----END[ A-Z]+PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildMemoryMutationReceipt(
  action: "forget" | "updatePreference",
  before: Awaited<ReturnType<typeof getMemory>>,
  after: Awaited<ReturnType<typeof getMemory>>,
) {
  const now = new Date().toISOString();
  const id = before?.id || after?.id || "unknown";
  return {
    receiptId: `memory-control:${action}:${id}:${Date.parse(now)}`,
    generatedAt: now,
    action,
    memoryId: id,
    before: before ? {
      id: before.id,
      type: before.type,
      key: before.key || "",
      contentPreview: redactSensitiveText(before.content, 120),
    } : null,
    after: after ? {
      id: after.id,
      type: after.type,
      key: after.key || "",
      contentPreview: redactSensitiveText(after.content, 120),
    } : null,
  };
}

async function logMemoryMutationReceipt(receipt: ReturnType<typeof buildMemoryMutationReceipt>): Promise<void> {
  try {
    await new SecurityAuditLogger().logWorkspaceEvent({
      event: "memory_mutation_receipt",
      workspaceId: "zavorth-control",
      decision: "allowed",
      reason: receipt.action,
      metadata: {
        receiptId: receipt.receiptId,
        memoryId: receipt.memoryId,
        action: receipt.action,
      },
    });
  } catch {
    // Audit logging is best-effort here; the API response remains the proof.
  }
}
