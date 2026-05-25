import type {
  ZavorthAgentGatewaySnapshot,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import {
  buildDashboardAdapterInputFromCommandCenterRuntimeProjection,
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from "../projections";
import {
  buildDashboardCommandCenterViewModel,
  type DashboardCommandCenterAdapterInput,
} from "./dashboardCommandCenterAdapter";

export function buildCommandCenterAdapterInputFromZavorthAgentGatewaySnapshot(
  snapshot: ZavorthAgentGatewaySnapshot,
): DashboardCommandCenterAdapterInput {
  return buildDashboardAdapterInputFromCommandCenterRuntimeProjection(
    buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot),
  );
}

export function buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot(
  snapshot: ZavorthAgentGatewaySnapshot,
) {
  return buildDashboardCommandCenterViewModel(
    buildCommandCenterAdapterInputFromZavorthAgentGatewaySnapshot(snapshot),
  );
}

export {
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
};
