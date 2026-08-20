import { config } from "../../../../config/index.js";
import type { LiveChannelBroadcastGatewayContract } from "../../../../contracts/PlatformContract.js";
import { TaskManager } from "../../../../orchestrator/TaskManager.js";
import { LogRepository } from "../../../../storage/LogRepository.js";
import {
  ZavorthChannelActionService,
  type BroadcastCapableGateway,
} from "../../../../services/ZavorthChannelActionService.js";
import { ZavorthControlService } from "../../../../services/ZavorthControlService.js";

import { DailyReportService } from "../../../../services/DailyReportService.js";
import { OperationsDashboardService as OperationsCockpitService } from "../../../../services/OperationsDashboardService.js";
import { OperationsHealthService } from "../../../../observability/OperationsHealthService.js";
import { OperatorBriefService } from "../../../../observability/OperatorBriefService.js";
import { OperationsReportService } from "../../../../observability/OperationsReportService.js";
import { ProductObservabilityService } from "../../../../observability/ProductObservabilityService.js";
import { SessionContinuityService } from "../../../../runtime/context/SessionContinuityService.js";
import { WorkflowRunService } from "../../../../runtime/workflows/WorkflowRunService.js";
import type { LegacyUnifiedGatewayAdapter } from "../../../../context-engine/LegacyUnifiedGatewayAdapter.js";
import type { ZavorthAgentGateway } from "../../../../runtime/agent/index.js";
import type { McpRuntimeService } from "../../../../mcp/McpRuntimeService.js";
import type { McpCapabilityControlPlaneService } from "../../../../services/McpCapabilityControlPlaneService.js";
import type { PermissionService } from "../../../../services/PermissionService.js";
import type { RuntimeDiagnosticsService } from "../../../../services/RuntimeDiagnosticsService.js";
import type { EchoOutputStageService } from "../../../../services/EchoOutputStageService.js";
import type { SecurityLockService } from "../../../../services/SecurityLockService.js";
import type { AuditLogger } from "../../../../monitoring/AuditLogger.js";
import type { WslControlService } from "../../../../services/WslControlService.js";
import type { ExecutionGateway } from "../../../../execution/ExecutionGateway.js";

type TelegramOperationsRuntimeOptions = {
  mcpRuntimeService?: McpRuntimeService;
  mcpCapabilityControlPlaneService?: McpCapabilityControlPlaneService;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot'> | null;
};

type BotGatewayOperationsTarget = {
  permissionService: PermissionService;
  runtimeDiagnostics: RuntimeDiagnosticsService;
  echoOutputStage: EchoOutputStageService | null;
  securityLock: SecurityLockService;
  auditLogger: AuditLogger;
  wslControl: WslControlService;
  executionGateway: ExecutionGateway;
  zavorthControlService: ZavorthControlService;
  dailyReportService: DailyReportService;
};

export function initializeTelegramOperationsServices(
  gateway: BotGatewayOperationsTarget,
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
      telegram: gateway as unknown as LiveChannelBroadcastGatewayContract &
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

  gateway.zavorthControlService = new ZavorthControlService(logRepo, {
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
        gateway.zavorthControlService.getOperationsOverviewReaders(),
    },
  );

  return {
    workflowRunService,
    productObservabilityService,
  };
}
