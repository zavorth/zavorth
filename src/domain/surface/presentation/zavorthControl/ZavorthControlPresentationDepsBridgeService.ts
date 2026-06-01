import type { ZavorthControlClassicAccessDeps } from './ZavorthControlClassicAccessService.js';
import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';
import type { ZavorthControlHttpCorsDeps } from './ZavorthControlHttpSupportService.js';
import type { ZavorthControlLegacyRouteDeps } from './ZavorthControlLegacyRouteService.js';
import { ExperienceCoreService } from '../../../../services/experience/ExperienceCoreService.js';

export type ZavorthControlPresentationDepsBridgeInput = {
  host: string;
  port: number;
  snippetUserId: string;
  localBaseUrl: string;
  publicBaseUrl: string | null;
};

export type ZavorthControlPresentationDepsBridgeSource = {
  authService: ZavorthControlClassicAccessDeps['authService'] & ZavorthControlCoreRouteDeps['authService'];
  nodeHeartbeat: ZavorthControlCoreRouteDeps['nodeHeartbeat'];
  nodeMesh: ZavorthControlCoreRouteDeps['nodeMesh'];
  responseWriter: {
    writeHtml: ZavorthControlLegacyRouteDeps['writeHtml'];
    writeJson: ZavorthControlLegacyRouteDeps['writeJson'];
    writeText: ZavorthControlCoreRouteDeps['writeText'];
    writeRedirect: ZavorthControlCoreRouteDeps['writeRedirect'];
  };
  httpSupport: {
    readJsonBody: ZavorthControlCoreRouteDeps['readJsonBody'];
    readRawBody: ZavorthControlCoreRouteDeps['readRawBody'];
  };
  slackIngressGateway: ZavorthControlCoreRouteDeps['slackIngressGateway'];
  teamsIngressGateway: ZavorthControlCoreRouteDeps['teamsIngressGateway'];
  whatsappIngressGateway: ZavorthControlCoreRouteDeps['whatsappIngressGateway'];
  instagramIngressGateway: ZavorthControlCoreRouteDeps['instagramIngressGateway'];
  a2ui: ZavorthControlCoreRouteDeps['a2ui'];
  proactivePermissions: ZavorthControlCoreRouteDeps['proactivePermissions'];
  experienceCoreService?: ZavorthControlCoreRouteDeps['experienceCore'];
  agentGateway?: any;
  memoryPlane?: any;
  learningPlane?: any;
  runtimeAccessReadiness?: any;
  echoService: ZavorthControlCoreRouteDeps['echo'];
  getPublicBaseUrl: ZavorthControlLegacyRouteDeps['getPublicBaseUrl'];
  getClassicZavorthControlHtml: ZavorthControlLegacyRouteDeps['getClassicZavorthControlHtml'];
  observability: {
    getStats: ZavorthControlLegacyRouteDeps['getStats'];
    getRecentLogs: ZavorthControlLegacyRouteDeps['getRecentLogs'];
    getAuditLogs: ZavorthControlLegacyRouteDeps['getAuditLogs'];
    getAuditStats: ZavorthControlLegacyRouteDeps['getAuditStats'];
  };
  sidecarStatus: {
    readSummary: ZavorthControlLegacyRouteDeps['getSidecars'];
  };
  skillCatalogApi: {
    buildSnapshot: ZavorthControlLegacyRouteDeps['getSkillCatalogSnapshot'];
  };
  skillMcpSidecar: {
    buildSnapshot: ZavorthControlLegacyRouteDeps['getSkillMcpSnapshot'];
  };
  skillLibraryPresentation: {
    buildSnapshot: ZavorthControlLegacyRouteDeps['getSkillLibrarySnapshot'];
  };
  skillBridgeRegistry: {
    buildSnapshot: ZavorthControlLegacyRouteDeps['getSkillBridgeSnapshot'];
  };
  skillInstallPlanPresentation: {
    buildSnapshot: ZavorthControlLegacyRouteDeps['getSkillInstallPlanSnapshot'];
  };
};

export class ZavorthControlPresentationDepsBridgeService {
  public buildClassicAccessDeps(
    source: ZavorthControlPresentationDepsBridgeSource,
  ): ZavorthControlClassicAccessDeps {
    return {
      authService: source.authService,
    };
  }

  public buildCoreRouteDeps(
    source: ZavorthControlPresentationDepsBridgeSource,
  ): ZavorthControlCoreRouteDeps {
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
    source: ZavorthControlPresentationDepsBridgeSource,
    input: ZavorthControlPresentationDepsBridgeInput,
  ): ZavorthControlLegacyRouteDeps {
    return {
      host: input.host,
      port: input.port,
      snippetUserId: input.snippetUserId,
      getPublicBaseUrl: () => source.getPublicBaseUrl(),
      getClassicZavorthControlHtml: () => source.getClassicZavorthControlHtml(),
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
    input: ZavorthControlPresentationDepsBridgeInput,
  ): ZavorthControlHttpCorsDeps {
    return {
      host: input.host,
      port: input.port,
      localBaseUrl: input.localBaseUrl,
      publicBaseUrl: input.publicBaseUrl,
    };
  }
}
