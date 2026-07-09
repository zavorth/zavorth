import type {
  SurfaceConsistencyActionContext,
  SurfaceConsistencyActionSnapshot,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';
import { pushAccessActions } from './SharedSurfaceConsistencyAccessActions.js';

import { pushApprovalActions } from './SharedSurfaceConsistencyApprovalActions.js';
import { pushArtifactActions } from './SharedSurfaceConsistencyArtifactActions.js';
import { pushContinuityActions } from './SharedSurfaceConsistencyContinuityActions.js';
import type { SurfaceConsistencyPrioritizedAction } from './SharedSurfaceConsistencyActionSupport.js';
import { pushWorkflowActions } from './SharedSurfaceConsistencyWorkflowActions.js';

export function buildActions(
  context: SurfaceConsistencyActionContext | null,
  readiness: SurfaceConsistencyReadiness,
): SurfaceConsistencyActionSnapshot[] {
  if (!context) {
    return [];
  }

  const actions: SurfaceConsistencyPrioritizedAction[] = [];
  pushAccessActions(actions, context, readiness);
  pushContinuityActions(actions, context, readiness);
  pushWorkflowActions(actions, context, readiness);
  pushApprovalActions(actions, context, readiness);
  pushArtifactActions(actions, context, readiness);

  return actions
    .sort((left, right) => right.priority - left.priority)
    .map((entry) => entry.snapshot)
    .filter(Boolean) as SurfaceConsistencyActionSnapshot[];
}
