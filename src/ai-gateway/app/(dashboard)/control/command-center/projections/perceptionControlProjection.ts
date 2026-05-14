import type {
  UniversalAgentRun,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import type { ZavorthPerceptionCommandCenterProjection } from "../../../../../../contracts/ZavorthPerceptionCrossSurfaceCertificationContract.js";

export function mapPerceptionControlProjection(
  run: UniversalAgentRun | null,
): ZavorthPerceptionCommandCenterProjection | null {
  const raw = asRecord(run?.metadata?.perceptionControl)
    || asRecord(run?.metadata?.perceptionCrossSurface)
    || asRecord(run?.metadata?.perceptionCommandCenterProjection);
  if (!raw) {
    return null;
  }
  const projection = raw as unknown as ZavorthPerceptionCommandCenterProjection;
  if (!Array.isArray(projection.targets) || !projection.surface) {
    return null;
  }
  return {
    ...projection,
    status: normalizePerceptionProjectionStatus(projection.status),
    liveSafetyStatus: {
      ...projection.liveSafetyStatus,
      liveCanaryDisabledByDefault: true,
      explicitApprovalRequired: true,
      mutationRequiresApproval: true,
      hardBlocksPreserved: true,
      noVisualMutationWithoutOwnerApproval: true,
    },
    surface: {
      ...projection.surface,
      visualMutationApplied: false,
    },
  };
}

function normalizePerceptionProjectionStatus(value: unknown): ZavorthPerceptionCommandCenterProjection["status"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "passed" || raw === "attention" || raw === "blocked") {
    return raw;
  }
  return "attention";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
