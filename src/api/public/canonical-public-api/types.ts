import type { SharedSurfaceRuntime } from '../../../services/SurfaceRuntime.js';
import type { ZavorthGatewayService } from '../../../services/ZavorthGatewayService.js';
import type { ZavorthNodeMeshService } from '../../../services/ZavorthNodeMeshService.js';
import type { ZavorthPlatformRegistryService } from '../../../services/ZavorthPlatformRegistryService.js';
import type { ZavorthRemoteTransportService } from '../../../services/ZavorthRemoteTransportService.js';
import type { ZavorthSessionPlaneService } from '../../../services/ZavorthSessionPlaneService.js';
import type { OperationsHealthService } from '../../../observability/OperationsHealthService.js';
import type { ZavorthLearningPlaneService } from '../../../services/ZavorthLearningPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../../../services/ZavorthLayeredMemoryService.js';
import type { ProviderControlPlaneService } from '../../../services/ProviderControlPlaneService.js';
import type { ZavorthChannelMeshService } from '../../../services/ZavorthChannelMeshService.js';
import type { PermissionService } from '../../../services/PermissionService.js';
import type { SupervisedExecutionGatewayService } from '../../../services/SupervisedExecutionGatewayService.js';
import type { WebAppConversationService } from '../../../services/WebAppConversationService.js';
import type { WebRealtimeService } from '../../../services/WebRealtimeService.js';
import type { ZavorthChannelActionService } from '../../../services/ZavorthChannelActionService.js';
import type { ZavorthProviderReadinessMatrixService } from '../../../services/ZavorthProviderReadinessMatrixService.js';

export type CanonicalPublicApiRuntime = {
  getRuntime: () => SharedSurfaceRuntime | null;
  getGateway: () => (Pick<ZavorthGatewayService, 'buildHydratedSnapshot'> & Partial<Pick<
    ZavorthGatewayService,
    'buildDomainSummarySnapshot' | 'buildDomainSnapshot'
  >>) | null;
  getSessionPlane: () => Pick<ZavorthSessionPlaneService, 'buildSnapshot'> | null;
  getNodeMesh: () => Pick<ZavorthNodeMeshService, 'buildSnapshot'> | null;
  getPlatformRegistry: () => Pick<ZavorthPlatformRegistryService, 'buildSnapshot'> | null;
  getRemoteTransports: () => Pick<ZavorthRemoteTransportService, 'buildSnapshot'> | null;
  getOperationsHealth: () => Pick<OperationsHealthService, 'readSnapshotFast' | 'readSnapshotLive'> | null;
  getLearningPlane: () => Partial<Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction' | 'readMetrics'>> | null;
  getLayeredMemory: () => Partial<Pick<ZavorthLayeredMemoryService, 'buildStatus' | 'search' | 'readProcedures' | 'readMetrics'>> | null;
  getProviderControlPlane?: () => Pick<
    ProviderControlPlaneService,
    | 'listProviders'
    | 'listProfiles'
    | 'buildModelPickerContract'
    | 'resolveSelectedModelProfile'
  > | null;
  getChannelMesh?: () => Pick<ZavorthChannelMeshService, 'buildSnapshot'> | null;
  getPermissionService?: () => Pick<PermissionService, 'listRequests' | 'getRequest' | 'approveRequest' | 'rejectRequest'> | null;
  getConversationService?: () => Pick<WebAppConversationService, 'processChatSend'> | null;
  getRealtime?: () => Pick<WebRealtimeService, 'ensureSession' | 'captureBaseline' | 'subscribe' | 'getResolvedSnapshot'> | null;
  getChannelActions?: () => Pick<ZavorthChannelActionService, 'execute'> | null;
  getProviderReadiness?: () => Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'> | null;
  getSupervisedExecutionGateway?: () => Pick<SupervisedExecutionGatewayService, 'cancelAction'> | null;
};

export type ArtifactQuery = {
  userId?: string | null;
  sessionId?: string | null;
  chatId?: string | null;
};
