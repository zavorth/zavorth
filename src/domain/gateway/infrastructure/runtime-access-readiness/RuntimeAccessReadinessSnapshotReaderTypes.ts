import fs from "fs";
import type { McpCapabilityControlPlaneService } from "../../../../services/McpCapabilityControlPlaneService.js";
import type { ProviderDoctorService } from "../../../../services/ProviderDoctorService.js";

export type RuntimeAccessReadinessSnapshotReaderOptions = {
  now: () => Date;
  existsSync: typeof fs.existsSync;
  readFileSync: typeof fs.readFileSync;
  kill: (pid: number, signal?: number | NodeJS.Signals) => void;
  tenantRegistryFile: string;
  dashboardRuntimeFile: string;
  nodeMeshSmokeReportFile: string;
  nodeMeshSmokeMaxAgeMs: number;
  systemOverlordSmokeReportFile: string;
  systemOverlordSmokeMaxAgeMs: number;
  channelProviderDoctorReportFile: string;
  channelProviderDoctorMaxAgeMs: number;
  remoteTransportDoctorReportFile: string;
  remoteTransportDoctorMaxAgeMs: number;
  hostIdentityFile: string;
  webPort: number;
  webAuthToken: string;
  webAuthTokenFile: string;
  discordBridgeStatusFile: string;
  providerDoctorService: Pick<ProviderDoctorService, "inspect">;
  mcpCapabilityControlPlaneService: Pick<
    McpCapabilityControlPlaneService,
    "buildSnapshot"
  >;
};
