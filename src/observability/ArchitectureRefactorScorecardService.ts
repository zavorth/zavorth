import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { PresentationBoundaryPolicyService } from '../presentation/PresentationBoundaryPolicyService.js';
import type { PresentationBoundaryPolicySnapshot } from '../contracts/PresentationBoundaryContract.js';
import {
  ArchitectureDependencyGraphService,
  type ArchitectureDependencyGraphSnapshot,
} from './ArchitectureDependencyGraphService.js';

type ArchitecturePosture = 'healthy' | 'attention' | 'critical';
type ArchitectureSeverity = 'info' | 'warn' | 'critical';
type ArchitectureGateStatus = 'passed' | 'warning' | 'failed';
type ArchitectureRuleStatus = 'passed' | 'attention' | 'failed';

type SourceMetric = {
  absolutePath: string;
  relativePath: string;
  bytes: number;
  lines: number;
  topLevelDirectory: string;
};

type ArchitectureRefactorScorecardDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  srcRoot?: string | null;
  lineLimit?: number;
  readSourceFiles?: () => SourceMetric[];
  buildPresentationBoundarySnapshot?: () => PresentationBoundaryPolicySnapshot;
  buildDependencyGraphSnapshot?: () => ArchitectureDependencyGraphSnapshot;
};

export type ArchitectureRefactorRule = {
  id: string;
  label: string;
  status: ArchitectureRuleStatus;
  summary: string;
  target: string;
  observed: string;
};

export type ArchitectureRefactorHotspot = {
  path: string;
  bytes: number;
  lines: number;
  status: 'critical' | 'watch';
};

export type ArchitectureRefactorSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  srcRoot: string;
  summary: {
    posture: ArchitecturePosture;
    totalSourceFiles: number;
    servicesFiles: number;
    domainFiles: number;
    hottestFileLines: number;
    hotspotCount: number;
    legacyHotspotCount: number;
    legacyHotspotRegressionCount: number;
    criticalFlowsTracked: number;
    officialDomainsPresent: number;
    officialDomainsTotal: number;
    officialDomainOwnershipReady: number;
    officialDomainOwnershipTotal: number;
    domainsAdopted: number;
    domainsTracked: number;
    priorityDomainOwnershipReady: number;
    priorityDomainOwnershipTotal: number;
    boundaryPortsPresent: number;
    boundaryPortsTotal: number;
    canonicalExecutionEnginesReady: number;
    canonicalExecutionEnginesTotal: number;
    controlPlaneFamiliesReady: number;
    controlPlaneFamiliesTotal: number;
    presentationSurfacesReady: number;
    presentationSurfacesTotal: number;
    presentationBoundaryViolations: number;
    architectureDocsReady: number;
    architectureDocsTotal: number;
    compatibilityFacadeFiles: number;
    domainDependencyViolations: number;
    dependencyModulesTracked: number;
  };
  rules: ArchitectureRefactorRule[];
  hotspots: ArchitectureRefactorHotspot[];
  legacyHotspots: ArchitectureRefactorHotspot[];
  directorySummary: Array<{
    id: string;
    files: number;
    lines: number;
  }>;
  criticalFlows: Array<{
    id: string;
    label: string;
    command: string;
    status: 'tracked';
    notes: string;
  }>;
  officialDomains: Array<{
    id: string;
    path: string;
    present: boolean;
    files: number;
    applicationFiles: number;
    domainFiles: number;
    infrastructureFiles: number;
    presentationFiles: number;
    ownershipReady: boolean;
  }>;
  architectureDocs: Array<{
    id: string;
    label: string;
    path: string;
    present: boolean;
  }>;
  boundaryPorts: Array<{
    id: string;
    files: string[];
    present: boolean;
  }>;
  canonicalExecutionEngines: Array<{
    id: string;
    files: string[];
    ready: boolean;
  }>;
  controlPlaneFamilies: Array<{
    id: string;
    files: string[];
    ready: boolean;
  }>;
  dependencyGraph: ArchitectureDependencyGraphSnapshot;
  presentationBoundary: PresentationBoundaryPolicySnapshot;
  actions: Array<{
    id: string;
    label: string;
    severity: ArchitectureSeverity;
    reason: string;
    command: string | null;
  }>;
  gate: {
    status: ArchitectureGateStatus;
    canProceed: boolean;
    blockingReasons: string[];
    warnings: string[];
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  sourceSnapshots: {
    topFilesByLines: SourceMetric[];
  };
};

type BoundaryPortSnapshot = ArchitectureRefactorSnapshot['boundaryPorts'][number];
type ControlPlaneFamilySnapshot = ArchitectureRefactorSnapshot['controlPlaneFamilies'][number];

const OFFICIAL_DOMAIN_IDS = [
  'surface',
  'gateway',
  'execution',
  'sessions',
  'memory',
  'channels',
  'nodes',
  'transports',
  'trust-governance',
  'platform-ecosystem',
  'observability',
] as const;

const PRIORITY_DOMAIN_OWNERSHIP_IDS = [
  'execution',
  'sessions',
  'channels',
  'nodes',
] as const;

const LEGACY_HOTSPOT_BASELINE: Record<string, number> = {
  'cli/ZavorthCliLiveNamespaces.ts': 4240,
  'zavorth-cli.ts': 4019,
  'cli/ZavorthCliSurfaceHelpers.ts': 2286,
  'runtime/agent/AgentRunService.ts': 2227,
  'services/ZavorthSpeculativeAutonomyService.ts': 2179,
  'domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts': 2163,
  'services/SwarmV2Service.ts': 1922,
  'ai-gateway/app/(zavorthControl)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts': 1662,
  'cli/ZavorthCliRegistry.ts': 1574,
  'ai-gateway/app/(zavorthControl)/control/command-center/components/CommandCenterControlShell.tsx': 1561,
  'cli/ZavorthCliFlowHelpers.ts': 1519,
};

const CRITICAL_FLOWS = [
  {
    id: 'cli-natural-entry',
    label: 'Entrada natural por CLI',
    command: 'npm run cli:fast -- chat',
    notes: 'A mesma semantica compartilhada precisa continuar disponivel fora da UI web.',
  },
  {
    id: 'web-control-runtime',
    label: 'Surfaces web /zavorthControl e runtime',
    command: 'npm run test:web:smoke',
    notes: 'Control plane e runtime web continuam sendo fluxos operatoriais criticos.',
  },
  {
    id: 'telegram-commands',
    label: 'Telegram commands e dispatch conversacional',
    command: 'npm run test:gateway:smoke',
    notes: 'A refatoracao nao pode quebrar o roteamento multissuperficie.',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    command: 'npm run test:smoke:flows',
    notes: 'Toda mutacao critica continua passando por approval quando exigido.',
  },
  {
    id: 'sessions',
    label: 'Sessions, history, send e spawn',
    command: 'npm run test:gateway:smoke',
    notes: 'Continuity e session plane sao fluxos must-not-break da plataforma.',
  },
  {
    id: 'control-planes',
    label: 'Control planes principais',
    command: 'npm run ops:stability:json',
    notes: 'Os snapshots operacionais precisam continuar honestos e acionaveis.',
  },
] as const;

const BOUNDARY_PORTS = [
  {
    id: 'surface-api',
    files: ['src/contracts/InternalBoundaryContract.ts', 'src/api/internal/InternalSurfaceApiService.ts'],
  },
  {
    id: 'control-plane-api',
    files: ['src/contracts/InternalBoundaryContract.ts', 'src/api/internal/InternalControlPlaneApiService.ts'],
  },
  {
    id: 'execution-api',
    files: ['src/contracts/InternalBoundaryContract.ts', 'src/api/internal/InternalExecutionApiService.ts'],
  },
] as const;

const CANONICAL_EXECUTION_ENGINES = [
  {
    id: 'automation',
    files: ['src/services/CanonicalExecutionPipelineService.ts', 'src/services/ZavorthAutomationActionService.ts'],
  },
  {
    id: 'node-invoke',
    files: ['src/services/CanonicalExecutionPipelineService.ts', 'src/services/NodeInvokeService.ts', 'src/services/NodeInvocationStoreService.ts'],
  },
  {
    id: 'swarm',
    files: ['src/services/CanonicalExecutionPipelineService.ts', 'src/services/SwarmV2Service.ts'],
  },
  {
    id: 'selfmod',
    files: ['src/services/CanonicalExecutionPipelineService.ts', 'src/services/SelfModificationCommandService.ts'],
  },
  {
    id: 'host-actions',
    files: ['src/services/supervised-execution/SupervisedExecutionGatewayRecordBuilder.ts'],
  },
  {
    id: 'workflow-runs',
    files: ['src/services/WorkflowRunService.ts', 'src/services/workflow-run/WorkflowRunSupport.ts'],
  },
] as const;

const CONTROL_PLANE_FAMILIES = [
  {
    id: 'overview-kit',
    files: ['src/domain/observability/infrastructure/control-plane/ControlPlaneOverviewKit.ts'],
  },
  {
    id: 'operational-overview',
    files: ['src/services/ZavorthOperationalOverviewService.ts'],
  },
  {
    id: 'trust-overview',
    files: ['src/services/ZavorthTrustOverviewService.ts'],
  },
  {
    id: 'product-overview',
    files: ['src/services/ZavorthProductOverviewService.ts'],
  },
  {
    id: 'control-plane-catalog',
    files: ['src/domain/observability/infrastructure/control-plane/ZavorthControlPlaneCatalogService.ts'],
  },
] as const;

const ARCHITECTURE_ONBOARDING_DOCS = [
  {
    id: 'architecture-source-of-truth',
    label: 'Mapa oficial de dominios e boundaries',
    path: 'docs/product-direction.md',
  },
  {
    id: 'contributing-architecture',
    label: 'Guia de onde colocar codigo novo',
    path: 'docs/product-direction.md',
  },
] as const;

const COMPATIBILITY_FACADE_FILE = /^(?:(?:\/\/[^\n]*\n)|\s|export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"];?\s*)+$/;

export class ArchitectureRefactorScorecardService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly srcRoot: string;
  private readonly lineLimit: number;
  private readonly readSourceFiles: () => SourceMetric[];
  private readonly buildPresentationBoundarySnapshot: () => PresentationBoundaryPolicySnapshot;
  private readonly buildDependencyGraphSnapshot: () => ArchitectureDependencyGraphSnapshot;

  constructor(deps: ArchitectureRefactorScorecardDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.workspaceRoot = String(deps.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.srcRoot = String(deps.srcRoot || path.join(this.workspaceRoot, 'src')).trim();
    this.lineLimit = Number.isFinite(deps.lineLimit) ? Number(deps.lineLimit) : 1500;
    this.readSourceFiles = deps.readSourceFiles || (() => this.scanSourceFiles());
    this.buildPresentationBoundarySnapshot = deps.buildPresentationBoundarySnapshot || (() =>
      new PresentationBoundaryPolicyService({
        now: this.now,
        workspaceRoot: this.workspaceRoot,
        srcRoot: this.srcRoot,
      }).buildSnapshot());
    this.buildDependencyGraphSnapshot = deps.buildDependencyGraphSnapshot || (() =>
      new ArchitectureDependencyGraphService({
        now: this.now,
        workspaceRoot: this.workspaceRoot,
        srcRoot: this.srcRoot,
      }).buildSnapshot());
  }

  public buildSnapshot(): ArchitectureRefactorSnapshot {
    const files = this.readSourceFiles()
      .filter((entry) => entry.relativePath.endsWith('.ts') || entry.relativePath.endsWith('.tsx'))
      .sort((left, right) => right.lines - left.lines);
    const oversizedFiles = files.filter((entry) => entry.lines > this.lineLimit);
    const legacyHotspots: ArchitectureRefactorHotspot[] = oversizedFiles
      .filter((entry) => this.isLegacyHotspot(entry))
      .map((entry) => this.toHotspot(entry));
    const hotspots: ArchitectureRefactorHotspot[] = oversizedFiles
      .filter((entry) => this.isActionableHotspot(entry))
      .slice(0, 12)
      .map((entry) => this.toHotspot(entry));
    const directorySummary = this.buildDirectorySummary(files);
    const servicesFiles = files.filter((entry) => entry.topLevelDirectory === 'services').length;
    const compatibilityFacadeFiles = files.filter((entry) => this.isCompatibilityFacadeFile(entry)).length;
    const domainFiles = files.filter((entry) => entry.relativePath.startsWith('domain/')).length;
    const officialDomains = OFFICIAL_DOMAIN_IDS.map((id) => {
      const absolutePath = path.join(this.workspaceRoot, 'src', 'domain', id);
      const domainFilesForPath = files.filter((entry) => entry.relativePath.startsWith(`domain/${id}/`)).length;
      const applicationFiles = this.countDomainLayerFiles(files, id, 'application');
      const domainLayerFiles = this.countDomainLayerFiles(files, id, 'domain');
      const infrastructureFiles = this.countDomainLayerFiles(files, id, 'infrastructure');
      const presentationFiles = this.countDomainLayerFiles(files, id, 'presentation');
      return {
        id,
        path: `src/domain/${id}`,
        present: fs.existsSync(absolutePath),
        files: domainFilesForPath,
        applicationFiles,
        domainFiles: domainLayerFiles,
        infrastructureFiles,
        presentationFiles,
        ownershipReady: applicationFiles > 0 && domainLayerFiles > 0 && infrastructureFiles > 0 && presentationFiles > 0,
      };
    });
    const boundaryPorts: BoundaryPortSnapshot[] = BOUNDARY_PORTS.map((entry) => ({
      id: entry.id,
      files: [...entry.files],
      present: entry.files.every((relativePath) => fs.existsSync(path.join(this.workspaceRoot, relativePath))),
    }));
    const architectureDocs = ARCHITECTURE_ONBOARDING_DOCS.map((entry) => ({
      ...entry,
      present: fs.existsSync(path.join(this.workspaceRoot, entry.path)),
    }));
    const canonicalExecutionEngines = CANONICAL_EXECUTION_ENGINES.map((entry) => ({
      id: entry.id,
      files: [...entry.files],
      ready: entry.files.every((relativePath) => fs.existsSync(path.join(this.workspaceRoot, relativePath))),
    }));
    const controlPlaneFamilies: ControlPlaneFamilySnapshot[] = CONTROL_PLANE_FAMILIES.map((entry) => ({
      id: entry.id,
      files: [...entry.files],
      ready: entry.files.every((relativePath) => fs.existsSync(path.join(this.workspaceRoot, relativePath))),
    }));
    const dependencyGraph = this.buildDependencyGraphSnapshot();
    const presentationBoundary = this.buildPresentationBoundarySnapshot();
    const rules = this.buildRules({
      files,
      hotspots,
      legacyHotspots,
      servicesFiles,
      compatibilityFacadeFiles,
      domainFiles,
      officialDomains,
      architectureDocs,
      boundaryPorts,
      canonicalExecutionEngines,
      controlPlaneFamilies,
      dependencyGraph,
      presentationBoundary,
    });
    const gate = this.buildGate(rules, hotspots);
    const summary = {
      posture: this.resolvePosture(gate, rules),
      totalSourceFiles: files.length,
      servicesFiles,
      domainFiles,
      hottestFileLines: files[0]?.lines || 0,
      hotspotCount: hotspots.length,
      legacyHotspotCount: legacyHotspots.length,
      legacyHotspotRegressionCount: legacyHotspots.filter((entry) => entry.lines > (LEGACY_HOTSPOT_BASELINE[entry.path] || 0)).length,
      criticalFlowsTracked: CRITICAL_FLOWS.length,
      officialDomainsPresent: officialDomains.filter((entry) => entry.present).length,
      officialDomainsTotal: officialDomains.length,
      officialDomainOwnershipReady: officialDomains.filter((entry) => entry.ownershipReady).length,
      officialDomainOwnershipTotal: officialDomains.length,
      domainsAdopted: dependencyGraph.summary.domainsAdopted,
      domainsTracked: dependencyGraph.summary.domainsTracked,
      priorityDomainOwnershipReady: officialDomains.filter((entry) =>
        (PRIORITY_DOMAIN_OWNERSHIP_IDS as readonly string[]).includes(entry.id) && entry.ownershipReady,
      ).length,
      priorityDomainOwnershipTotal: PRIORITY_DOMAIN_OWNERSHIP_IDS.length,
      boundaryPortsPresent: boundaryPorts.filter((entry) => entry.present).length,
      boundaryPortsTotal: boundaryPorts.length,
      canonicalExecutionEnginesReady: canonicalExecutionEngines.filter((entry) => entry.ready).length,
      canonicalExecutionEnginesTotal: canonicalExecutionEngines.length,
      controlPlaneFamiliesReady: controlPlaneFamilies.filter((entry) => entry.ready).length,
      controlPlaneFamiliesTotal: controlPlaneFamilies.length,
      presentationSurfacesReady: presentationBoundary.summary.surfacesReady,
      presentationSurfacesTotal: presentationBoundary.summary.surfacesTotal,
      presentationBoundaryViolations: presentationBoundary.summary.violations,
      architectureDocsReady: architectureDocs.filter((entry) => entry.present).length,
      architectureDocsTotal: architectureDocs.length,
      compatibilityFacadeFiles,
      domainDependencyViolations: dependencyGraph.summary.crossDomainViolations,
      dependencyModulesTracked: dependencyGraph.summary.modulesTracked,
    };
    const actions = this.buildActions({
      hotspots,
      gate,
      rules,
      officialDomains,
      architectureDocs,
    });
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      srcRoot: this.srcRoot,
      summary,
      rules,
      hotspots,
      legacyHotspots,
      directorySummary,
      criticalFlows: CRITICAL_FLOWS.map((entry) => ({
        ...entry,
        status: 'tracked' as const,
      })),
      officialDomains,
      architectureDocs,
      boundaryPorts,
      canonicalExecutionEngines,
      controlPlaneFamilies,
      dependencyGraph,
      presentationBoundary,
      actions,
      gate,
      narrative: {
        headline: 'Scorecard arquitetural da refatoracao incremental',
        operatorSummary:
          `${summary.hotspotCount} hotspot(s) novo(s)/regredido(s) acima de ${this.lineLimit} linhas, `
          + `${summary.legacyHotspotCount} hotspot(s) legado(s) congelado(s) por baseline, `
          + `${summary.servicesFiles}/${summary.totalSourceFiles} arquivo(s) ainda concentrados em src/services e `
          + `${summary.officialDomainOwnershipReady}/${summary.officialDomainOwnershipTotal} dominio(s) oficial(is) com ownership real por camadas; `
          + `${summary.domainsAdopted}/${summary.domainsTracked} dominio(s) oficial(is) adotado(s) por composition roots; `
          + `${summary.priorityDomainOwnershipReady}/${summary.priorityDomainOwnershipTotal} dominio(s) prioritario(s) com ownership real por camadas; `
          + `${summary.boundaryPortsPresent}/${summary.boundaryPortsTotal} porta(s) canonicas presentes; `
          + `${summary.canonicalExecutionEnginesReady}/${summary.canonicalExecutionEnginesTotal} motor(es) ligados ao lifecycle canonico; `
          + `${summary.controlPlaneFamiliesReady}/${summary.controlPlaneFamiliesTotal} familia(s) de control plane no catalogo canonico; `
          + `${summary.presentationSurfacesReady}/${summary.presentationSurfacesTotal} surface(s) visuais no boundary de presentation; `
          + `${summary.architectureDocsReady}/${summary.architectureDocsTotal} guia(s) oficiais de onboarding arquitetural; `
          + `${summary.compatibilityFacadeFiles} facade(s) pura(s) de compatibilidade ainda restando em src/services; `
          + `${summary.domainDependencyViolations} violacao(oes) de dependencia cruzada entre dominios.`,
        nextAction:
          gate.blockingReasons[0]
          || actions[0]?.label
          || 'Continuar extraindo o core para dominios oficiais e quebrando os monolitos maiores.',
      },
      sourceSnapshots: {
        topFilesByLines: files.slice(0, 10),
      },
    };
  }

  public renderReport(): string {
    const snapshot = this.buildSnapshot();
    const lines = [
      'Arquitetura e baseline de refatoracao',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Gate: ${snapshot.gate.status} | pode prosseguir: ${snapshot.gate.canProceed ? 'sim' : 'nao'}.`,
      `Arquivos fonte: ${snapshot.summary.totalSourceFiles} | src/services: ${snapshot.summary.servicesFiles} | src/domain: ${snapshot.summary.domainFiles}.`,
      `Ownership oficial: ${snapshot.summary.officialDomainOwnershipReady}/${snapshot.summary.officialDomainOwnershipTotal}.`,
      `Adocao de dominios: ${snapshot.summary.domainsAdopted}/${snapshot.summary.domainsTracked}.`,
      `Ownership prioritario: ${snapshot.summary.priorityDomainOwnershipReady}/${snapshot.summary.priorityDomainOwnershipTotal}.`,
      `Boundary ports: ${snapshot.summary.boundaryPortsPresent}/${snapshot.summary.boundaryPortsTotal}.`,
      `Control plane platform: ${snapshot.summary.controlPlaneFamiliesReady}/${snapshot.summary.controlPlaneFamiliesTotal}.`,
      `Dependencias entre dominios: violacoes ${snapshot.summary.domainDependencyViolations} | modulos ${snapshot.summary.dependencyModulesTracked}.`,
      `Presentation boundary: ${snapshot.summary.presentationSurfacesReady}/${snapshot.summary.presentationSurfacesTotal} | violacoes: ${snapshot.summary.presentationBoundaryViolations}.`,
      `Onboarding arquitetural: ${snapshot.summary.architectureDocsReady}/${snapshot.summary.architectureDocsTotal}.`,
      `Hotspots legados congelados: ${snapshot.summary.legacyHotspotCount} | regressoes: ${snapshot.summary.legacyHotspotRegressionCount}.`,
      `Facades puras de compatibilidade: ${snapshot.summary.compatibilityFacadeFiles}.`,
      '',
      'Regras:',
      ...snapshot.rules.map((entry) => `- ${entry.label}: ${entry.status} | ${entry.summary}`),
    ];
    if (snapshot.hotspots.length > 0) {
      lines.push(
        '',
        'Hotspots:',
        ...snapshot.hotspots.map((entry) => `- ${entry.path}: ${entry.lines} linhas | ${entry.status}`),
      );
    }
    if (snapshot.dependencyGraph.violations.length > 0) {
      lines.push(
        '',
        'Violacoes Entre Dominios:',
        ...snapshot.dependencyGraph.violations.slice(0, 8).map((entry) =>
          `- ${entry.importerDomain} -> ${entry.targetDomain}: ${entry.importerPath} importa ${entry.targetPath}`),
      );
    }
    if (snapshot.dependencyGraph.moduleHotspots.length > 0) {
      lines.push(
        '',
        'Top Modulos Por Dependencia:',
        ...snapshot.dependencyGraph.moduleHotspots.slice(0, 5).map((entry) =>
          `- ${entry.id}: fan-out ${entry.fanOut} | fan-in ${entry.fanIn} | arquivos ${entry.fileCount}`),
      );
    }
    if (snapshot.dependencyGraph.entrypointHotspots.length > 0) {
      lines.push(
        '',
        'Top Entrypoints Por Fan-In/Fan-Out:',
        ...snapshot.dependencyGraph.entrypointHotspots.slice(0, 5).map((entry) =>
          `- ${entry.path}: ${entry.kind} | fan-in ${entry.fanIn} | fan-out ${entry.fanOut}`),
      );
    }
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.gate.blockingReasons.length > 0 || snapshot.gate.warnings.length > 0) {
      lines.push(
        '',
        'Gate:',
        ...snapshot.gate.blockingReasons.map((entry) => `- bloqueio: ${entry}`),
        ...snapshot.gate.warnings.map((entry) => `- aviso: ${entry}`),
      );
    }
    return lines.join('\n');
  }

  private buildRules(input: {
    files: SourceMetric[];
    hotspots: ArchitectureRefactorHotspot[];
    legacyHotspots: ArchitectureRefactorHotspot[];
    servicesFiles: number;
    compatibilityFacadeFiles: number;
    domainFiles: number;
    officialDomains: ArchitectureRefactorSnapshot['officialDomains'];
    architectureDocs: ArchitectureRefactorSnapshot['architectureDocs'];
    boundaryPorts: ArchitectureRefactorSnapshot['boundaryPorts'];
    canonicalExecutionEngines: ArchitectureRefactorSnapshot['canonicalExecutionEngines'];
    controlPlaneFamilies: ArchitectureRefactorSnapshot['controlPlaneFamilies'];
    dependencyGraph: ArchitectureDependencyGraphSnapshot;
    presentationBoundary: PresentationBoundaryPolicySnapshot;
  }): ArchitectureRefactorRule[] {
    const servicesShare = input.files.length > 0 ? input.servicesFiles / input.files.length : 0;
    const missingDomains = input.officialDomains.filter((entry) => !entry.present).length;
    const priorityDomains = input.officialDomains.filter((entry) =>
      (PRIORITY_DOMAIN_OWNERSHIP_IDS as readonly string[]).includes(entry.id),
    );
    const officialOwnershipReady = input.officialDomains.filter((entry) => entry.ownershipReady).length;
    const priorityOwnershipReady = priorityDomains.filter((entry) => entry.ownershipReady).length;
    const architectureDocsReady = input.architectureDocs.filter((entry) => entry.present).length;
    return [
      {
        id: 'line-limit',
        label: 'Nenhum hotspot novo ou regredido acima de 1500 linhas',
        status: input.hotspots.length === 0 ? 'passed' : 'failed',
        summary:
          input.hotspots.length === 0
            ? `${input.legacyHotspots.length} hotspot(s) legado(s) congelado(s) por baseline; nenhum novo/regredido.`
            : `${input.hotspots.length} arquivo(s) novo(s) ou regredido(s) acima do limite precisam ser quebrados.`,
        target: `0 hotspot(s) novo(s) ou regredido(s) acima de ${this.lineLimit} linhas`,
        observed: `${input.hotspots.length} acionavel(is), ${input.legacyHotspots.length} legado(s) congelado(s)`,
      },
      {
        id: 'services-dominance',
        label: 'Reduzir dominancia de src/services',
        status: servicesShare <= 0.35 ? 'passed' : (servicesShare <= 0.5 ? 'attention' : 'failed'),
        summary:
          `src/services concentra ${Math.round(servicesShare * 100)}% dos arquivos fonte monitorados `
          + `(${input.servicesFiles}/${input.files.length}).`,
        target: 'src/services abaixo de 35% do volume de codigo monitorado',
        observed: `${Math.round(servicesShare * 100)}%`,
      },
      {
        id: 'compatibility-facades',
        label: 'Zerar facades puras de compatibilidade',
        status:
          input.compatibilityFacadeFiles === 0
            ? 'passed'
            : (input.compatibilityFacadeFiles <= 2 ? 'attention' : 'failed'),
        summary:
          `${input.compatibilityFacadeFiles} arquivo(s) em src/services ainda sao apenas ponte para caminho canonico.`,
        target: '0 facades puras de compatibilidade em src/services',
        observed: `${input.compatibilityFacadeFiles} facade(s)`,
      },
      {
        id: 'official-domains',
        label: 'Cobertura dos dominios oficiais',
        status: missingDomains === 0 ? 'passed' : 'attention',
        summary:
          `${input.officialDomains.length - missingDomains}/${input.officialDomains.length} dominio(s) `
          + 'oficiais ja existem como fronteira explicita.',
        target: `${input.officialDomains.length}/${input.officialDomains.length} dominios presentes`,
        observed: `${input.officialDomains.length - missingDomains}/${input.officialDomains.length}`,
      },
      {
        id: 'priority-domain-ownership',
        label: 'Ownership real dos dominios prioritarios',
        status:
          priorityOwnershipReady === priorityDomains.length
            ? 'passed'
            : (priorityOwnershipReady > 0 ? 'attention' : 'failed'),
        summary:
          `${priorityOwnershipReady}/${priorityDomains.length} dominio(s) prioritario(s) possuem ` +
          'application, domain, infrastructure e presentation/facade explicitos.',
        target: `${priorityDomains.length}/${priorityDomains.length} dominios prioritarios com use cases reais`,
        observed: `${priorityOwnershipReady}/${priorityDomains.length}`,
      },
      {
        id: 'official-domain-ownership',
        label: 'Ownership real dos dominios oficiais',
        status:
          officialOwnershipReady === input.officialDomains.length
            ? 'passed'
            : (officialOwnershipReady > 0 ? 'attention' : 'failed'),
        summary:
          `${officialOwnershipReady}/${input.officialDomains.length} dominio(s) oficial(is) possuem `
          + 'application, domain, infrastructure e presentation/facade explicitos.',
        target: `${input.officialDomains.length}/${input.officialDomains.length} dominios oficiais com ownership real`,
        observed: `${officialOwnershipReady}/${input.officialDomains.length}`,
      },
      {
        id: 'architecture-onboarding-docs',
        label: 'Onboarding arquitetural oficial',
        status:
          architectureDocsReady === input.architectureDocs.length
            ? 'passed'
            : (architectureDocsReady > 0 ? 'attention' : 'failed'),
        summary:
          `${architectureDocsReady}/${input.architectureDocs.length} guia(s) oficiais de onboarding `
          + 'arquitetural estao publicados no repo.',
        target: `${input.architectureDocs.length}/${input.architectureDocs.length} guias oficiais publicados`,
        observed: `${architectureDocsReady}/${input.architectureDocs.length}`,
      },
      {
        id: 'domain-cross-dependencies',
        label: 'Dependencias cruzadas entre dominios oficiais',
        status: input.dependencyGraph.summary.crossDomainViolations === 0 ? 'passed' : 'failed',
        summary:
          `${input.dependencyGraph.summary.crossDomainViolations} dependencia(s) cruzada(s) nao autorizada(s) `
          + `e ${input.dependencyGraph.summary.crossDomainEdges} aresta(s) entre dominios auditadas.`,
        target: '0 dependencia cruzada nao autorizada entre dominios oficiais',
        observed: `${input.dependencyGraph.summary.crossDomainViolations} violacao(oes)`,
      },
      {
        id: 'boundary-ports',
        label: 'Boundary ports canonicos',
        status: input.boundaryPorts.every((entry) => entry.present) ? 'passed' : 'attention',
        summary:
          `${input.boundaryPorts.filter((entry) => entry.present).length}/${input.boundaryPorts.length} `
          + 'porta(s) canonicas publicadas na camada interna.',
        target: `${input.boundaryPorts.length}/${input.boundaryPorts.length} portas presentes`,
        observed: `${input.boundaryPorts.filter((entry) => entry.present).length}/${input.boundaryPorts.length}`,
      },
      {
        id: 'critical-flows',
        label: 'Inventario dos fluxos criticos',
        status: CRITICAL_FLOWS.length >= 6 ? 'passed' : 'attention',
        summary: `${CRITICAL_FLOWS.length} fluxo(s) criticos foram congelados como must-not-break.`,
        target: 'Inventario explicito dos fluxos publicos criticos',
        observed: `${CRITICAL_FLOWS.length} fluxo(s)`,
      },
      {
        id: 'canonical-execution-engines',
        label: 'Motores ligados ao pipeline canonico de execucao',
        status: input.canonicalExecutionEngines.every((entry) => entry.ready) ? 'passed' : 'attention',
        summary:
          `${input.canonicalExecutionEngines.filter((entry) => entry.ready).length}/`
          + `${input.canonicalExecutionEngines.length} motor(es) prioritario(s) publicam lifecycle/correlacao canonicos.`,
        target: `${input.canonicalExecutionEngines.length}/${input.canonicalExecutionEngines.length} motores prioritarios`,
        observed: `${input.canonicalExecutionEngines.filter((entry) => entry.ready).length}/${input.canonicalExecutionEngines.length}`,
      },
      {
        id: 'control-plane-platform-kit',
        label: 'Control planes como produto de plataforma',
        status: input.controlPlaneFamilies.every((entry) => entry.ready) ? 'passed' : 'attention',
        summary:
          `${input.controlPlaneFamilies.filter((entry) => entry.ready).length}/`
          + `${input.controlPlaneFamilies.length} familia(s) e kit/catalogo de control plane presentes.`,
        target: `${input.controlPlaneFamilies.length}/${input.controlPlaneFamilies.length} familias oficiais`,
        observed: `${input.controlPlaneFamilies.filter((entry) => entry.ready).length}/${input.controlPlaneFamilies.length}`,
      },
      {
        id: 'presentation-boundary',
        label: 'UI e presentation consomem somente contratos',
        status:
          input.presentationBoundary.summary.violations === 0
          && input.presentationBoundary.summary.surfacesReady === input.presentationBoundary.summary.surfacesTotal
            ? 'passed'
            : (input.presentationBoundary.summary.violations > 0 ? 'failed' : 'attention'),
        summary:
          `${input.presentationBoundary.summary.surfacesReady}/`
          + `${input.presentationBoundary.summary.surfacesTotal} surface(s) visuais auditadas; `
          + `${input.presentationBoundary.summary.violations} dependencia(s) proibida(s).`,
        target: 'UI depende de snapshots, actions, events, streams e assets; sem services/domain/runtime diretos',
        observed:
          `${input.presentationBoundary.summary.surfacesReady}/${input.presentationBoundary.summary.surfacesTotal} `
          + `surface(s), ${input.presentationBoundary.summary.violations} violacao(oes)`,
      },
    ];
  }

  private buildGate(
    rules: ArchitectureRefactorRule[],
    hotspots: ArchitectureRefactorHotspot[],
  ): ArchitectureRefactorSnapshot['gate'] {
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    const blockingRuleIds = new Set<string>([
      'domain-cross-dependencies',
      'presentation-boundary',
    ]);
    if (hotspots.length > 0) {
      warnings.push(
        `Ainda existem ${hotspots.length} hotspot(s) legados acima do limite de ${this.lineLimit} linhas.`,
      );
    }
    for (const rule of rules) {
      if (rule.status === 'failed' && blockingRuleIds.has(rule.id)) {
        blockingReasons.push(rule.summary);
      } else if (rule.status === 'failed') {
        warnings.push(rule.summary);
      }
      if (rule.status === 'attention') {
        warnings.push(rule.summary);
      }
    }
    const status: ArchitectureGateStatus =
      blockingReasons.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed');
    return {
      status,
      canProceed: status !== 'failed',
      blockingReasons,
      warnings,
    };
  }

  private buildActions(input: {
    hotspots: ArchitectureRefactorHotspot[];
    gate: ArchitectureRefactorSnapshot['gate'];
    rules: ArchitectureRefactorRule[];
    officialDomains: ArchitectureRefactorSnapshot['officialDomains'];
    architectureDocs: ArchitectureRefactorSnapshot['architectureDocs'];
  }): ArchitectureRefactorSnapshot['actions'] {
    const actions: ArchitectureRefactorSnapshot['actions'] = [];
    if (input.hotspots.length > 0) {
      const topHotspot = input.hotspots[0];
      actions.push({
        id: 'break-top-hotspot',
        label: 'Quebrar o maior hotspot primeiro',
        severity: 'critical',
        reason: `${topHotspot.path} esta acima do budget e concentra risco de manutencao.`,
        command: 'npm run ops:architecture',
      });
    }
    const missingDomains = input.officialDomains.filter((entry) => !entry.present);
    if (missingDomains.length > 0) {
      actions.push({
        id: 'seed-missing-domains',
        label: 'Semear dominios oficiais faltantes',
        severity: 'warn',
        reason: `Ainda faltam ${missingDomains.length} dominio(s) oficiais como fronteira explicita.`,
        command: 'npm run ops:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'services-dominance' && entry.status !== 'passed')) {
      actions.push({
        id: 'stop-growing-services',
        label: 'Parar de crescer src/services',
        severity: 'warn',
        reason: 'Codigo novo deve nascer em dominio/application em vez de ampliar service sprawl.',
        command: null,
      });
    }
    if (input.rules.some((entry) => entry.id === 'compatibility-facades' && entry.status !== 'passed')) {
      actions.push({
        id: 'remove-compatibility-facades',
        label: 'Remover facades puras restantes',
        severity: 'warn',
        reason: 'Facades de reexport puro em src/services devem sair assim que os consumers internos migrarem para o caminho canonico.',
        command: 'npm run qa:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'priority-domain-ownership' && entry.status !== 'passed')) {
      actions.push({
        id: 'finish-priority-domain-ownership',
        label: 'Fechar ownership dos dominios prioritarios',
        severity: 'warn',
        reason: 'Execution, sessions, channels e nodes devem ter use cases reais e camadas explicitas antes de fechar este gate.',
        command: 'npm run ops:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'official-domain-ownership' && entry.status !== 'passed')) {
      actions.push({
        id: 'expand-official-domain-ownership',
        label: 'Expandir ownership dos dominios oficiais restantes',
        severity: 'warn',
        reason: 'Surface, gateway, memory, transports, trust-governance, platform-ecosystem e observability devem operar com camadas explicitas, nao so seed/facade.',
        command: 'npm run ops:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'architecture-onboarding-docs' && entry.status !== 'passed')) {
      actions.push({
        id: 'publish-architecture-onboarding-docs',
        label: 'Publicar onboarding arquitetural oficial',
        severity: 'warn',
        reason: 'Novos contribuidores precisam de mapa oficial de dominios, regra de placement e guias de use case/zavorthControl plane/surface action.',
        command: 'npm run ops:architecture:report',
      });
    }
    if (input.rules.some((entry) => entry.id === 'domain-cross-dependencies' && entry.status !== 'passed')) {
      actions.push({
        id: 'fix-domain-cross-dependencies',
        label: 'Remover dependencia cruzada indevida entre dominios',
        severity: 'warn',
        reason: 'Dominios oficiais devem depender de contracts, adapters e services canonicos, nao importar outro dominio diretamente sem allowlist explicita.',
        command: 'npm run qa:architecture',
      });
    }
    if (input.rules.some((entry) => entry.id === 'canonical-execution-engines' && entry.status !== 'passed')) {
      actions.push({
        id: 'finish-canonical-execution-engines',
        label: 'Fechar motores no pipeline canonico',
        severity: 'warn',
        reason: 'Automations, node invoke, swarm, selfmod, host actions e workflows devem emitir lifecycle/correlacao pelo mesmo modelo.',
        command: 'npm run ops:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'control-plane-platform-kit' && entry.status !== 'passed')) {
      actions.push({
        id: 'finish-control-plane-platform-kit',
        label: 'Fechar plataforma comum de control planes',
        severity: 'warn',
        reason: 'Operational, Trust, Product, kit comum e catalogo devem ficar presentes antes de encerrar a Data readiness.',
        command: 'npm run ops:architecture:json',
      });
    }
    if (input.rules.some((entry) => entry.id === 'presentation-boundary' && entry.status !== 'passed')) {
      actions.push({
        id: 'finish-presentation-boundary',
        label: 'Fechar boundary de presentation',
        severity: 'warn',
        reason: 'Web UI, zavorthControl assets, ai-gateway zavorthControl e voice/companion devem depender de contratos, snapshots, actions, events, streams e assets.',
        command: 'npm run ops:architecture:json',
      });
    }
    if (actions.length === 0 && input.gate.status === 'passed') {
      actions.push({
        id: 'preserve-scorecard',
        label: 'Preservar o gate arquitetural',
        severity: 'info',
        reason: 'A baseline atual esta consistente; o proximo passo e manter o gate no CI.',
        command: 'npm run ops:architecture:json',
      });
    }
    return actions;
  }

  private resolvePosture(
    gate: ArchitectureRefactorSnapshot['gate'],
    rules: ArchitectureRefactorRule[],
  ): ArchitecturePosture {
    if (gate.status === 'failed') {
      return 'critical';
    }
    if (gate.status === 'warning' || rules.some((entry) => entry.status === 'attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private isCompatibilityFacadeFile(entry: SourceMetric): boolean {
    if (entry.topLevelDirectory !== 'services' || !fs.existsSync(entry.absolutePath)) {
      return false;
    }
    const source = fs.readFileSync(entry.absolutePath, 'utf8').trim();
    return COMPATIBILITY_FACADE_FILE.test(source);
  }

  private isLegacyHotspot(entry: SourceMetric): boolean {
    const baseline = LEGACY_HOTSPOT_BASELINE[entry.relativePath];
    return typeof baseline === 'number' && entry.lines <= baseline;
  }

  private isActionableHotspot(entry: SourceMetric): boolean {
    const baseline = LEGACY_HOTSPOT_BASELINE[entry.relativePath];
    return typeof baseline !== 'number' || entry.lines > baseline;
  }

  private toHotspot(entry: SourceMetric): ArchitectureRefactorHotspot {
    return {
      path: entry.relativePath,
      bytes: entry.bytes,
      lines: entry.lines,
      status: entry.lines > this.lineLimit * 2 ? 'critical' : 'watch',
    };
  }

  private buildDirectorySummary(files: SourceMetric[]): ArchitectureRefactorSnapshot['directorySummary'] {
    const buckets = new Map<string, { files: number; lines: number }>();
    for (const file of files) {
      const bucket = buckets.get(file.topLevelDirectory) || { files: 0, lines: 0 };
      bucket.files += 1;
      bucket.lines += file.lines;
      buckets.set(file.topLevelDirectory, bucket);
    }
    return Array.from(buckets.entries())
      .map(([id, value]) => ({
        id,
        files: value.files,
        lines: value.lines,
      }))
      .sort((left, right) => right.lines - left.lines)
      .slice(0, 12);
  }

  private countDomainLayerFiles(
    files: SourceMetric[],
    domainId: string,
    layer: 'application' | 'domain' | 'infrastructure' | 'presentation',
  ): number {
    return files.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/${layer}/`)).length;
  }

  private scanSourceFiles(): SourceMetric[] {
    const files: SourceMetric[] = [];
    if (!fs.existsSync(this.srcRoot)) {
      return files;
    }
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (['.next', 'node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          walk(absolutePath);
          continue;
        }
        if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
          continue;
        }
        const relativePath = path.relative(this.srcRoot, absolutePath).replace(/\\/g, '/');
        const topLevelDirectory = relativePath.includes('/') ? relativePath.slice(0, relativePath.indexOf('/')) : '<root>';
        const contents = fs.readFileSync(absolutePath, 'utf8');
        files.push({
          absolutePath,
          relativePath,
          bytes: Buffer.byteLength(contents),
          lines: contents.length === 0 ? 0 : contents.split(/\r?\n/).length,
          topLevelDirectory,
        });
      }
    };
    walk(this.srcRoot);
    return files;
  }
}
