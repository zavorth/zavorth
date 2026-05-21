import type { DashboardClassicAccessDeps } from './DashboardClassicAccessService.js';
import type { DashboardCoreRouteDeps } from './DashboardCoreRouteService.js';
import type { DashboardHttpCorsDeps } from './DashboardHttpSupportService.js';
import type { DashboardLegacyRouteDeps } from './DashboardLegacyRouteService.js';
import { ExperienceCoreService } from '../../../../services/experience/index.js';

export type DashboardPresentationDepsBridgeInput = {
  host: string;
  port: number;
  snippetUserId: string;
  localBaseUrl: string;
  publicBaseUrl: string | null;
};

export type DashboardPresentationDepsBridgeSource = {
  authService: DashboardClassicAccessDeps['authService'] & DashboardCoreRouteDeps['authService'];
  nodeHeartbeat: DashboardCoreRouteDeps['nodeHeartbeat'];
  nodeMesh: DashboardCoreRouteDeps['nodeMesh'];
  responseWriter: {
    writeHtml: DashboardLegacyRouteDeps['writeHtml'];
    writeJson: DashboardLegacyRouteDeps['writeJson'];
    writeText: DashboardCoreRouteDeps['writeText'];
    writeRedirect: DashboardCoreRouteDeps['writeRedirect'];
  };
  httpSupport: {
    readJsonBody: DashboardCoreRouteDeps['readJsonBody'];
    readRawBody: DashboardCoreRouteDeps['readRawBody'];
  };
  slackIngressGateway: DashboardCoreRouteDeps['slackIngressGateway'];
  teamsIngressGateway: DashboardCoreRouteDeps['teamsIngressGateway'];
  whatsappIngressGateway: DashboardCoreRouteDeps['whatsappIngressGateway'];
  instagramIngressGateway: DashboardCoreRouteDeps['instagramIngressGateway'];
  a2ui: DashboardCoreRouteDeps['a2ui'];
  proactivePermissions: DashboardCoreRouteDeps['proactivePermissions'];
  experienceCoreService?: DashboardCoreRouteDeps['experienceCore'];
  agentGateway?: any;
  memoryPlane?: any;
  learningPlane?: any;
  runtimeAccessReadiness?: any;
  echoService: DashboardCoreRouteDeps['echo'];
  getPublicBaseUrl: DashboardLegacyRouteDeps['getPublicBaseUrl'];
  getClassicDashboardHtml: DashboardLegacyRouteDeps['getClassicDashboardHtml'];
  observability: {
    getStats: DashboardLegacyRouteDeps['getStats'];
    getRecentLogs: DashboardLegacyRouteDeps['getRecentLogs'];
    getAuditLogs: DashboardLegacyRouteDeps['getAuditLogs'];
    getAuditStats: DashboardLegacyRouteDeps['getAuditStats'];
  };
  sidecarStatus: {
    readSummary: DashboardLegacyRouteDeps['getSidecars'];
  };
  skillCatalogApi: {
    buildSnapshot: DashboardLegacyRouteDeps['getSkillCatalogSnapshot'];
  };
  skillMcpSidecar: {
    buildSnapshot: DashboardLegacyRouteDeps['getSkillMcpSnapshot'];
  };
  skillLibraryPresentation: {
    buildSnapshot: DashboardLegacyRouteDeps['getSkillLibrarySnapshot'];
  };
  skillBridgeRegistry: {
    buildSnapshot: DashboardLegacyRouteDeps['getSkillBridgeSnapshot'];
  };
  skillInstallPlanPresentation: {
    buildSnapshot: DashboardLegacyRouteDeps['getSkillInstallPlanSnapshot'];
  };
};

export class DashboardPresentationDepsBridgeService {
  public buildClassicAccessDeps(
    source: DashboardPresentationDepsBridgeSource,
  ): DashboardClassicAccessDeps {
    return {
      authService: source.authService,
    };
  }

  public buildCoreRouteDeps(
    source: DashboardPresentationDepsBridgeSource,
  ): DashboardCoreRouteDeps {
    return {
      nodeHeartbeat: source.nodeHeartbeat,
      nodeMesh: source.nodeMesh,
      authService: source.authService,
      readJsonBody: (req) => source.httpSupport.readJsonBody(req),
      readRawBody: (req) => source.httpSupport.readRawBody(req),
      writeJson: (res, body, statusCode) => source.responseWriter.writeJson(res, body, statusCode),
      writeText: (res, body, statusCode) => source.responseWriter.writeText(res, body, statusCode),
      writeRedirect: (res, location, statusCode) => source.responseWriter.writeRedirect(res, location, statusCode),
      slackIngressGateway: source.slackIngressGateway,
      teamsIngressGateway: source.teamsIngressGateway,
      whatsappIngressGateway: source.whatsappIngressGateway,
      instagramIngressGateway: source.instagramIngressGateway,
      a2ui: source.a2ui,
      proactivePermissions: source.proactivePermissions,
      experienceCore: source.experienceCoreService || new ExperienceCoreService({
        agentGateway: source.agentGateway || null,
        memoryPlane: source.memoryPlane || null,
        learningPlane: source.learningPlane || null,
        runtimeAccessReadiness: source.runtimeAccessReadiness || null,
      }),
      echo: source.echoService,
    };
  }

  public buildLegacyRouteDeps(
    source: DashboardPresentationDepsBridgeSource,
    input: DashboardPresentationDepsBridgeInput,
  ): DashboardLegacyRouteDeps {
    return {
      host: input.host,
      port: input.port,
      snippetUserId: input.snippetUserId,
      getPublicBaseUrl: () => source.getPublicBaseUrl(),
      getClassicDashboardHtml: () => source.getClassicDashboardHtml(),
      getStats: () => source.observability.getStats(),
      getSidecars: () => source.sidecarStatus.readSummary(),
      getRecentLogs: (limit) => source.observability.getRecentLogs(limit),
      getAuditLogs: (url) => source.observability.getAuditLogs(url),
      getAuditStats: () => source.observability.getAuditStats(),
      getSkillCatalogSnapshot: (input) => source.skillCatalogApi.buildSnapshot(input),
      getSkillMcpSnapshot: (input) => source.skillMcpSidecar.buildSnapshot(input),
      getSkillLibrarySnapshot: (input) => source.skillLibraryPresentation.buildSnapshot(input),
      getSkillBridgeSnapshot: (input) => source.skillBridgeRegistry.buildSnapshot(input),
      getSkillInstallPlanSnapshot: (input) => source.skillInstallPlanPresentation.buildSnapshot(input),
      writeHtml: (res, body, statusCode) => source.responseWriter.writeHtml(res, body, statusCode),
      writeJson: (res, body, statusCode) => source.responseWriter.writeJson(res, body, statusCode),
      readJsonBody: (req) => source.httpSupport.readJsonBody(req),
    };
  }

  public buildHttpCorsDeps(
    input: DashboardPresentationDepsBridgeInput,
  ): DashboardHttpCorsDeps {
    return {
      host: input.host,
      port: input.port,
      localBaseUrl: input.localBaseUrl,
      publicBaseUrl: input.publicBaseUrl,
    };
  }
}
