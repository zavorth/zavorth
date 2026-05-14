import type {
  SurfaceParityActionContext,
  SurfaceParityActionSnapshot,
  SurfaceParityReadiness,
} from './SharedSurfaceParityTypes.js';
import { pushAccessActions } from './SharedSurfaceParityAccessActions.js';
import { pushApprovalActions } from './SharedSurfaceParityApprovalActions.js';
import { pushArtifactActions } from './SharedSurfaceParityArtifactActions.js';
import { pushContinuityActions } from './SharedSurfaceParityContinuityActions.js';
import type { SurfaceParityPrioritizedAction } from './SharedSurfaceParityActionSupport.js';
import { pushWorkflowActions } from './SharedSurfaceParityWorkflowActions.js';

export function buildActions(
  context: SurfaceParityActionContext | null,
  readiness: SurfaceParityReadiness,
): SurfaceParityActionSnapshot[] {
  if (!context) {
    return [];
  }

  const actions: SurfaceParityPrioritizedAction[] = [];
  pushAccessActions(actions, context, readiness);
  pushContinuityActions(actions, context, readiness);
  pushWorkflowActions(actions, context, readiness);
  pushApprovalActions(actions, context, readiness);
  pushArtifactActions(actions, context, readiness);

  return actions
    .sort((left, right) => right.priority - left.priority)
    .map((entry) => entry.snapshot)
    .filter(Boolean) as SurfaceParityActionSnapshot[];
}
