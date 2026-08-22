import type {
  ZavorthReplayLearningArtifactEntry,
  ZavorthReplayLearningControlPlaneSnapshot,
} from '../ZavorthReplayLearningControlPlaneService.js';
import type { WorkflowRunSnapshot } from '../WorkflowRunService.js';
import { nullableText, text } from './ReplayLearningControlPlaneSupport.js';

export function collectReplayLearningArtifacts(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memoryPlane: any;
  workflowRuns: WorkflowRunSnapshot[];
  limit: number;
}): ZavorthReplayLearningArtifactEntry[] {
  const byId = new Map<string, ZavorthReplayLearningArtifactEntry>();
  const add = (entry: ZavorthReplayLearningArtifactEntry | null) => {
    if (!entry || byId.has(entry.id)) {
      return;
    }
    byId.set(entry.id, entry);
  };
  const memoryArtifacts = Array.isArray(input.memoryPlane?.artifacts?.recent)
    ? input.memoryPlane.artifacts.recent
    : [];
  for (const artifact of memoryArtifacts) {
    add(normalizeReplayLearningArtifact({
      id: artifact?.id,
      label: artifact?.label,
      kind: artifact?.kind,
      summary: artifact?.summary,
      path: artifact?.path,
      url: artifact?.url,
      createdAt: artifact?.createdAt,
      source: artifact?.sourceTaskId ? 'task' : 'replay',
      sourceRunId: artifact?.sourceTaskId || null,
    }));
  }
  for (const run of input.workflowRuns) {
    for (const artifact of Array.isArray(run.artifacts) ? run.artifacts : []) {
      add(normalizeReplayLearningArtifact({
        id: artifact.id || artifact.key || `${run.workflow_run_id}:${artifact.name}`,
        label: artifact.name || artifact.key || 'artifact',
        kind: artifact.kind || artifact.type || 'file',
        summary: artifact.summary || artifact.description,
        path: artifact.path,
        url: artifact.url,
        createdAt: artifact.createdAt || run.updated_at,
        source: `workflow:${run.workflow_name}`,
        sourceRunId: run.workflow_run_id,
      }));
    }
  }
  return Array.from(byId.values())
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    .slice(0, input.limit);
}

export function collectReplayLearningTimeline(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memoryPlane: any;
  workflowRuns: WorkflowRunSnapshot[];
  artifacts: ZavorthReplayLearningArtifactEntry[];
  limit: number;
}): ZavorthReplayLearningControlPlaneSnapshot['timeline'] {
  const entries: ZavorthReplayLearningControlPlaneSnapshot['timeline'] = [];
  const replayTimeline = Array.isArray(input.memoryPlane?.replay?.timeline)
    ? input.memoryPlane.replay.timeline
    : [];
  for (const entry of replayTimeline) {
    entries.push({
      id: text(entry?.id, `replay:${entries.length}`),
      label: text(entry?.label, 'Replay event'),
      kind: text(entry?.kind, 'replay'),
      status: nullableText(entry?.status),
      happenedAt: nullableText(entry?.happenedAt),
      summary: text(entry?.detail || entry?.summary, 'Evento de replay.'),
    });
  }
  for (const run of input.workflowRuns) {
    entries.push({
      id: `workflow:${run.workflow_run_id}`,
      label: `${run.workflow_name}: ${run.status}`,
      kind: 'workflow',
      status: run.status,
      happenedAt: run.updated_at,
      summary: run.resume_stage?.reason || run.objective || 'Workflow registrado.',
    });
  }
  for (const artifact of input.artifacts) {
    entries.push({
      id: `artifact:${artifact.id}`,
      label: artifact.label,
      kind: 'artifact',
      status: artifact.reusable ? 'reusable' : 'recorded',
      happenedAt: artifact.createdAt,
      summary: artifact.summary,
    });
  }
  return entries
    .sort((left, right) => String(right.happenedAt || '').localeCompare(String(left.happenedAt || '')))
    .slice(0, input.limit);
}

export function collectReplayLearningCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  learningPlane: any,
  limit: number,
): ZavorthReplayLearningControlPlaneSnapshot['learningCandidates'] {
  const entries = Array.isArray(learningPlane?.candidates) ? learningPlane.candidates : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return entries.slice(0, limit).map((entry: any) => ({
    id: text(entry?.id, 'candidate:unknown'),
    title: text(entry?.title, 'Learning candidate'),
    kind: text(entry?.kind, 'playbook'),
    score: Number(entry?.score || 0) || 0,
    reviewState: text(entry?.reviewState, 'pending'),
    lifecycle: text(entry?.lifecycle, 'learned_draft'),
    sourceWorkflow: text(entry?.source?.workflow, 'workflow'),
    actionHint: `/learning ${text(entry?.reviewState, 'pending') === 'pending' ? 'approve' : 'promote'} ${text(entry?.id, '')}`.trim(),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeReplayLearningArtifact(input: Record<string, any>): ZavorthReplayLearningArtifactEntry | null {
  const label = text(input.label, text(input.path || input.url, 'artifact'));
  const id = text(input.id, label).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-');
  const path = nullableText(input.path);
  const url = nullableText(input.url);
  const reusable = Boolean(path || url || input.sourceRunId);
  return {
    id,
    label,
    kind: text(input.kind, 'file'),
    source: text(input.source, 'runtime'),
    sourceRunId: nullableText(input.sourceRunId),
    path,
    url,
    createdAt: nullableText(input.createdAt),
    summary: text(input.summary, reusable ? 'Artifact reutilizavel for resumed.' : 'Artifact registrado without localizaction reutilizavel.'),
    reusable,
    resumePrompt: `Resume from artifact ${label}. Context: ${text(input.summary, 'without additional summary')}.`,
  };
}
