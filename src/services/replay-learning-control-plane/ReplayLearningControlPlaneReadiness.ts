import type {
  ZavorthReplayLearningArtifactEntry,
} from '../ZavorthReplayLearningControlPlaneService.js';
import type { WorkflowRunSnapshot } from '../WorkflowRunService.js';

export function resolveReplayLearningResumeReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memoryPlane: any,
  workflowRuns: WorkflowRunSnapshot[],
  artifacts: ZavorthReplayLearningArtifactEntry[],
): boolean {
  const replayEntry = memoryPlane?.replay?.recommendedEntry || null;
  return Boolean(
    (replayEntry && replayEntry.kind !== 'fresh')
    || workflowRuns.some((run) => Boolean(run.resume_stage))
    || artifacts.some((entry) => entry.reusable),
  );
}

export function resolveReplayLearningRestoreReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memoryPlane: any,
  workflowRuns: WorkflowRunSnapshot[],
): boolean {
  return Boolean(
    Number(memoryPlane?.workspace?.continuityRecommendations?.length || 0) > 0
    || Number(memoryPlane?.workspace?.workflowRecommendations?.length || 0) > 0
    || workflowRuns.some((run) => Boolean(run.resume_prompt || run.resume_stage)),
  );
}
