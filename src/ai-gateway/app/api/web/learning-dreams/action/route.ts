import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { isUnsafeCrossSiteMutation } from "../../runtime-engine-state";
import { logger } from '@/shared/utils/logger';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LearningAction = "approve" | "reject" | "promote";

type LearningState = {
  version: number;
  updatedAt: string;
  entries: Record<string, {
    reviewState: "pending" | "approved" | "rejected";
    lifecycle: "learned_draft" | "trusted_local" | "published" | "quarantined";
    updatedAt: string;
    promotedAt?: string | null;
    rejectedAt?: string | null;
  }>;
};

function projectRoot(): string {
  return path.resolve(process.cwd(), "..", "..");
}

function statePath(): string {
  return path.join(projectRoot(), "data", "runtime", "learning-plane-state.json");
}

function readState(): LearningState {
  try {
    const filePath = statePath();
    if (!fs.existsSync(filePath)) {
      return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as LearningState;
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[route] JSON parse failed', error);
    return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch (error: any) { const err = error; const e = error; logger.warn('[route] filesystem operation failed', error); return {}; }
}

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({ ok: false, error: "Cross-site mutation requests are blocked." }, { status: 403 });
  }
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const body = await readBody(request);
  const candidateId = String(body.candidateId || "").trim();
  const actionId = String(body.actionId || "").trim() as LearningAction;
  if (!candidateId) {
    return NextResponse.json({ ok: false, error: "candidateId is required" }, { status: 400 });
  }
  if (!["approve", "reject", "promote"].includes(actionId)) {
    return NextResponse.json({ ok: false, error: "Unsupported learning action" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const state = readState();
  const current = state.entries[candidateId] || {
    reviewState: "pending" as const,
    lifecycle: "learned_draft" as const,
    updatedAt: now,
  };
  const next = {
    ...current,
    reviewState: actionId === "reject" ? "rejected" as const : "approved" as const,
    lifecycle: actionId === "promote" ? "trusted_local" as const : (actionId === "reject" ? "quarantined" as const : current.lifecycle),
    updatedAt: now,
    promotedAt: actionId === "promote" ? now : current.promotedAt || null,
    rejectedAt: actionId === "reject" ? now : current.rejectedAt || null,
  };
  state.entries[candidateId] = next;
  state.updatedAt = now;

  const filePath = statePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");

  return NextResponse.json({
    ok: true,
    generatedAt: now,
    candidateId,
    actionId,
    status: "applied",
    summary: actionId === "promote"
      ? "Learning signal trusted for future use."
      : actionId === "reject"
        ? "Learning signal quarantined."
        : "Learning signal kept for review.",
  });
}
