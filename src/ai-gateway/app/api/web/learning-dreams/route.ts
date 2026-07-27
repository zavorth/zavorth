import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { logger } from '@/shared/utils/logger';export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunLike = {
  id?: string;
  workflow_run_id?: string;
  requestId?: string;
  title?: string;
  input?: string;
  objective?: string;
  summary?: string;
  status?: string;
  workspace?: string | null;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  events?: Array<{ status?: string; kind?: string }>;
  phases?: Array<{ status?: string; artifact_count?: number }>;
  artifacts?: unknown[];
  channel?: string;
};

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

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error: unknown) {logger.warn('[route] JSON parse failed', error); return fallback; }
}

function readLearningState(root: string): LearningState {
  return readJson<LearningState>(
    path.join(root, "data", "runtime", "learning-plane-state.json"),
    { version: 1, updatedAt: new Date(0).toISOString(), entries: {} },
  );
}

function readRuns(root: string): RunLike[] {
  const universal = readJson<{ runs?: RunLike[] }>(
    path.join(root, "data", "runtime", "universal-agent-runs.json"),
    { runs: [] },
  ).runs || [];
  const workflowDir = path.join(root, "data", "runtime", "workflow-runs");
  const workflowRuns = fs.existsSync(workflowDir)
    ? fs.readdirSync(workflowDir)
      .filter((entry) => entry.endsWith(".json"))
      .slice(0, 80)
      .map((entry) => readJson<RunLike | null>(path.join(workflowDir, entry), null))
      .filter((entry): entry is RunLike => Boolean(entry))
    : [];

  const merged = new Map<string, RunLike>();
  for (const run of [...universal, ...workflowRuns]) {
    const id = String(run.workflow_run_id || run.id || run.requestId || "").trim();
    if (id) merged.set(id, run);
  }
  return Array.from(merged.values());
}

function makeCandidate(run: RunLike, state: LearningState["entries"][string] | undefined) {
  const id = String(run.workflow_run_id || run.id || run.requestId || "").trim();
  const title = String(run.title || run.objective || run.input || "Recent run").trim();
  const completed = Array.isArray(run.phases)
    ? run.phases.filter((phase) => phase.status === "completed").length
    : (Array.isArray(run.events) ? run.events.filter((event) => event.status === "done").length : 0);
  const total = Array.isArray(run.phases) ? run.phases.length : Math.max(1, completed);
  const artifactCount = Array.isArray(run.artifacts)
    ? run.artifacts.length
    : (Array.isArray(run.phases) ? run.phases.reduce((sum, phase) => sum + Number(phase.artifact_count || 0), 0) : 0);
  const score = Math.max(0.35, Math.min(0.98, 0.52 + completed * 0.04 + artifactCount * 0.03));
  return {
    id,
    platformEntryId: id,
    title: title.length > 72 ? `${title.slice(0, 69)}...` : title,
    kind: artifactCount > 0 ? "playbook" : "recipe",
    summary: String(run.summary || run.objective || run.input || "Zavorth found a reusable pattern from recent activity.").trim(),
    score: Number(score.toFixed(2)),
    reviewState: state?.reviewState || "pending",
    lifecycle: state?.lifecycle || "learned_draft",
    createdAt: String(run.created_at || run.createdAt || new Date().toISOString()),
    updatedAt: String(run.updated_at || run.updatedAt || run.created_at || run.createdAt || new Date().toISOString()),
    lastValidatedAt: String(run.updated_at || run.updatedAt || run.created_at || run.createdAt || new Date().toISOString()),
    source: {
      workflowRunId: id,
      workflow: String(run.channel || "runtime"),
      workspace: String(run.workspace || "local"),
      objective: String(run.objective || run.input || title),
      artifactCount,
      completedStages: completed,
      totalStages: total,
      originTaskId: String(run.requestId || "") || null,
      sourceSurface: String(run.channel || "web"),
    },
    steps: [
      "Review recent activity",
      "Extract reusable behavior",
      "Keep only if useful",
    ],
    details: [
      `Status: ${String(run.status || "unknown")}`,
      `Evidence: ${completed} completed signal(s)`,
      artifactCount > 0 ? `Artifacts: ${artifactCount}` : "No artifacts attached",
    ],
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const workspace = String(url.searchParams.get("workspace") || "").trim();
  const root = projectRoot();
  const state = readLearningState(root);
  const candidates = readRuns(root)
    .filter((run) => !workspace || String(run.workspace || "") === workspace)
    .filter((run) => ["completed", "approval_pending", "blocked"].includes(String(run.status || "completed")))
    .sort((left, right) => String(right.updated_at || right.updatedAt || "").localeCompare(String(left.updated_at || left.updatedAt || "")))
    .slice(0, 40)
    .map((run) => {
      const id = String(run.workflow_run_id || run.id || run.requestId || "").trim();
      return makeCandidate(run, state.entries[id]);
    });

  const summary = {
    total: candidates.length,
    pending: candidates.filter((candidate) => candidate.reviewState === "pending").length,
    approved: candidates.filter((candidate) => candidate.reviewState === "approved").length,
    rejected: candidates.filter((candidate) => candidate.reviewState === "rejected").length,
    promoted: candidates.filter((candidate) => candidate.lifecycle === "trusted_local").length,
    published: candidates.filter((candidate) => candidate.lifecycle === "published").length,
    quarantined: candidates.filter((candidate) => candidate.lifecycle === "quarantined").length,
    highConfidence: candidates.filter((candidate) => candidate.score >= 0.8).length,
  };

  const memorySummary = {
    episodic: Math.min(12, candidates.length),
    semantic: summary.approved + summary.promoted,
    procedural: candidates.filter((candidate) => candidate.kind === "playbook").length,
  };

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    learning: {
      generatedAt: new Date().toISOString(),
      summary,
      candidates,
      narrative: {
        headline: summary.total > 0
          ? `Zavorth found ${summary.total} learning signal(s).`
          : "No learning signals yet.",
        operatorSummary: `${summary.pending} waiting, ${summary.approved} kept, ${summary.promoted} trusted.`,
      },
    },
    memory: {
      generatedAt: new Date().toISOString(),
      summary: {
        total: memorySummary.episodic + memorySummary.semantic + memorySummary.procedural,
        ...memorySummary,
      },
      budgets: {
        perLayer: 12,
        episodicUsage: Math.min(1, memorySummary.episodic / 12),
        semanticUsage: Math.min(1, memorySummary.semantic / 12),
        proceduralUsage: Math.min(1, memorySummary.procedural / 12),
      },
      narrative: {
        headline: "Layered memory is ready.",
        operatorSummary: "Recent activity, durable notes and reusable procedures are reviewed separately.",
      },
    },
  });
}
