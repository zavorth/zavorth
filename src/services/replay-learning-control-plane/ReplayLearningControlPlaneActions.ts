import type {
  ZavorthReplayLearningArtifactEntry,
  ZavorthReplayLearningControlPlaneSnapshot,
} from '../ZavorthReplayLearningControlPlaneService.js';
import type { WorkflowRunSnapshot } from '../WorkflowRunService.js';

export function buildReplayLearningActions(input: {
  summary: ZavorthReplayLearningControlPlaneSnapshot['summary'];
  artifacts: ZavorthReplayLearningArtifactEntry[];
  learningCandidates: ZavorthReplayLearningControlPlaneSnapshot['learningCandidates'];
  memoryPlane: unknown;
  workflowRuns: WorkflowRunSnapshot[];
}): ZavorthReplayLearningControlPlaneSnapshot['actions'] {
  const actions: ZavorthReplayLearningControlPlaneSnapshot['actions'] = [];
  const reusableArtifact = input.artifacts.find((entry) => entry.reusable) || null;
  const highConfidenceCandidate = input.learningCandidates.find((entry) =>
    entry.reviewState === 'pending' && entry.score >= 0.8,
  ) || input.learningCandidates.find((entry) => entry.reviewState === 'pending') || null;
  const resumableRun = input.workflowRuns.find((run) => Boolean(run.resume_stage)) || null;

  if (input.summary.compareReady) {
    actions.push({
      id: 'compare-runs',
      label: 'Comparar runs recentes',
      severity: 'info',
      command: '/memoryplane',
      reason: 'Existe timeline suficiente para comparar contexto, workflows e resumptions.',
      prompt: 'Compare os runs recentes e tell qual e o melhor ponto de resumed.',
    });
  }
  if (reusableArtifact) {
    actions.push({
      id: 'resume-from-artifact',
      label: `resume pelo artifact ${reusableArtifact.label}`,
      severity: 'info',
      command: '/memoryplane',
      reason: reusableArtifact.summary,
      prompt: reusableArtifact.resumePrompt,
    });
  }
  if (resumableRun) {
    actions.push({
      id: 'resume-workflow',
      label: `Resume workflow ${resumableRun.workflow_name}`,
      severity: 'warn',
      command: '/workflow resume',
      reason: resumableRun.resume_stage?.reason || 'Workflow possui phase de resumed.',
      prompt: resumableRun.resume_prompt || null,
    });
  }
  if (highConfidenceCandidate) {
    actions.push({
      id: 'review-learning-candidate',
      label: `review ${highConfidenceCandidate.id}`,
      severity: highConfidenceCandidate.score >= 0.8 ? 'warn' : 'info',
      command: highConfidenceCandidate.actionHint,
      reason: `${highConfidenceCandidate.title} is ${highConfidenceCandidate.reviewState} com score ${highConfidenceCandidate.score}.`,
      prompt: null,
    });
  }
  if (input.summary.memoryPressure !== 'ok') {
    actions.push({
      id: 'review-memory-budget',
      label: 'Review memory budgets',
      severity: input.summary.memoryPressure === 'critical' ? 'critical' : 'warn',
      command: '/memory status',
      reason: `Layered memory is com pressure ${input.summary.memoryPressure}.`,
      prompt: null,
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: 'inspect-memory-plane',
      label: 'review memory plane',
      severity: 'info',
      command: '/memoryplane',
      reason: 'Replay, artifacts e learning are without bloqueios imediatos.',
      prompt: 'Show replay, reusable artifacts, and learning candidates for the current workspace.',
    });
  }
  return actions.slice(0, 8);
}
