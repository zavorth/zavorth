import type {
  RemoteMeshNotebookApprovalUxCard,
  RemoteMeshNotebookApprovalUxSource,
} from "../../../../../../contracts/RemoteMeshNotebookApprovalUxContract.js";
import { buildRemoteMeshNotebookApprovalUxCard } from "../../../../../../contracts/RemoteMeshNotebookApprovalUxContract.js";

export const COMMAND_CENTER_REMOTE_MESH_APPROVAL_UX_PROJECTION_VERSION =
  "command-center-remote-mesh-approval-ux/v1" as const;

export type CommandCenterRemoteMeshApprovalUxProjection = {
  projectionVersion: typeof COMMAND_CENTER_REMOTE_MESH_APPROVAL_UX_PROJECTION_VERSION;
  card: RemoteMeshNotebookApprovalUxCard;
  commandCenterReady: true;
  rawJsonRequiredFromUser: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  secretValuesSerialized: false;
};

export function buildCommandCenterRemoteMeshApprovalUxProjection(
  source: RemoteMeshNotebookApprovalUxSource,
): CommandCenterRemoteMeshApprovalUxProjection {
  return {
    projectionVersion: COMMAND_CENTER_REMOTE_MESH_APPROVAL_UX_PROJECTION_VERSION,
    card: buildRemoteMeshNotebookApprovalUxCard({
      source,
      surface: "command-center",
      generatedAt: new Date().toISOString(),
    }),
    commandCenterReady: true,
    rawJsonRequiredFromUser: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    secretValuesSerialized: false,
  };
}
