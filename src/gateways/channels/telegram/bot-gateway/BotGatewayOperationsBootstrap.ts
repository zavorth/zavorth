import { config } from "../../../../config/index.js";
import type { LiveChannelBroadcastGatewayContract } from "../../../../contracts/PlatformContract.js";
import { TaskManager } from "../../../../orchestrator/TaskManager.js";
import { LogRepository } from "../../../../storage/LogRepository.js";
import {
  ZavorthChannelActionService,
  type BroadcastCapableGateway,
} from "../../../../services/ZavorthChannelActionService.js";
import { DashboardService } from "../../../../services/DashboardService.js";
import { DailyReportService } from "../../../../services/DailyReportService.js";
import { OperationsCockpitService } from "../../../../services/OperationsCockpitService.js";
import { OperationsHealthService } from "../../../../observability/OperationsHealthService.js";
import { OperatorBriefService } from "../../../../observability/OperatorBriefService.js";
import { OperationsReportService } from "../../../../observability/OperationsReportService.js";
import { ProductObservabilityService } from "../../../../observability/ProductObservabilityService.js";
import { SessionContinuityService } from "../../../../runtime/context/SessionContinuityService.js";
import { WorkflowRunService } from "../../../../runtime/workflows/WorkflowRunService.js";
import type { LegacyUnifiedGatewayAdapter } from "../../../../context-engine/LegacyUnifiedGatewayAdapter.js";
import type { ZavorthAgentGateway } from "../../../../runtime/agent/index.js";

type TelegramOperationsRuntimeOptions = {
  mcpRuntimeService?: any;
  mcpCapabilityControlPlaneService?: any;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot'> | null;
};

export function initializeTelegramOperationsServices(
  gateway: any,
  taskManager: TaskManager,
  logRepo: LogRepository,
  runtimeOptions?: TelegramOperationsRuntimeOptions,
) {
  const operationsHealthService = new OperationsHealthService(logRepo);
  const operationsCockpitService = new OperationsCockpitService(logRepo, {
    operationsHealthService,
  });
  const operatorBriefService = new OperatorBriefService(
    operationsCockpitService,
  );
  const sessionContinuityService = new SessionContinuityService(taskManager);
  const workflowRunService = new WorkflowRunService();
  const productObservabilityService = new ProductObservabilityService(
    taskManager,
    gateway.permissionService,
    { workflowRunService },
  );
  const channelActionService = new ZavorthChannelActionService({
    broadcastGateways: {
      telegram: gateway as LiveChannelBroadcastGatewayContract &
        BroadcastCapableGateway,
    },
  });
  const operationsReportService = new OperationsReportService(
    operationsCockpitService,
    gateway.runtimeDiagnostics,
    taskManager,
    gateway.permissionService,
    operatorBriefService,
    sessionContinuityService,
    config.allowedUserIds[0] || "1",
  );

  gateway.dashboardService = new DashboardService(logRepo, {
    operationsHealthService,
    operationsCockpitService,
    operatorBriefService,
    operationsReportService,
    productObservabilityService,
    channelActionService,
    mcpRuntimeService: runtimeOptions?.mcpRuntimeService,
    legacyUnifiedGateway: runtimeOptions?.legacyUnifiedGateway || null,
    agentGateway: runtimeOptions?.agentGateway || null,
    echoOutputStage: gateway.echoOutputStage || null,
    mcpCapabilityControlPlaneService:
      runtimeOptions?.mcpCapabilityControlPlaneService,
    permissionService: gateway.permissionService,
    securityLock: gateway.securityLock,
    auditLogger: gateway.auditLogger,
    wslControl: gateway.wslControl,
    executionGateway: gateway.executionGateway,
  });

  gateway.dailyReportService = new DailyReportService(
    taskManager,
    logRepo,
    gateway.permissionService,
    gateway.runtimeDiagnostics,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      reportBuilder: operationsReportService,
      reportOverviewReaders:
        gateway.dashboardService.getOperationsOverviewReaders(),
    },
  );

  return {
    workflowRunService,
    productObservabilityService,
  };
}
