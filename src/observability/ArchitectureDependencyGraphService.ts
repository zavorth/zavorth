import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

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

const ALLOWED_DOMAIN_DEPENDENCIES: Record<string, string[]> = {};

type ArchitectureDependencyGraphDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  srcRoot?: string | null;
  readSourceFiles?: () => Array<{
    absolutePath: string;
    relativePath: string;
  }>;
};

type GraphFileRecord = {
  absolutePath: string;
  relativePath: string;
  moduleId: string;
  domainId: string | null;
};

export type ArchitectureDomainDependencyViolation = {
  importerPath: string;
  importerDomain: string;
  targetPath: string;
  targetDomain: string;
  specifier: string;
  allowed: boolean;
};

export type ArchitectureDomainDependencyEdge = {
  fromDomain: string;
  toDomain: string;
  imports: number;
  allowed: boolean;
  importers: string[];
};

export type ArchitectureModuleDependencyHotspot = {
  id: string;
  fileCount: number;
  fanOut: number;
  fanIn: number;
  outgoingEdges: number;
  incomingEdges: number;
};

export type ArchitectureEntrypointFanSnapshot = {
  path: string;
  kind: string;
  moduleId: string;
  fanIn: number;
  fanOut: number;
  score: number;
};

export type ArchitectureDomainMigrationSnapshot = {
  id: string;
  path: string;
  present: boolean;
  ownershipReady: boolean;
  applicationFiles: number;
  domainFiles: number;
  infrastructureFiles: number;
  presentationFiles: number;
  externalConsumers: number;
  serviceConsumers: number;
  stage: 'missing' | 'seeded' | 'owned' | 'adopted';
  nextAction: string;
};

export type ArchitectureDependencyGraphSnapshot = {
  generatedAt: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    modulesTracked: number;
    crossDomainEdges: number;
    crossDomainViolations: number;
    entrypointsTracked: number;
    domainsTracked: number;
    domainsAdopted: number;
  };
  crossDomainEdges: ArchitectureDomainDependencyEdge[];
  violations: ArchitectureDomainDependencyViolation[];
  moduleHotspots: ArchitectureModuleDependencyHotspot[];
  entrypointHotspots: ArchitectureEntrypointFanSnapshot[];
  domainMigration: ArchitectureDomainMigrationSnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ArchitectureDependencyGraphService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly srcRoot: string;
  private readonly readSourceFiles: () => Array<{ absolutePath: string; relativePath: string }>;

  constructor(deps: ArchitectureDependencyGraphDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.workspaceRoot = String(deps.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.srcRoot = String(deps.srcRoot || path.join(this.workspaceRoot, 'src')).trim();
    this.readSourceFiles = deps.readSourceFiles || (() => this.scanSourceFiles());
  }

  public buildSnapshot(): ArchitectureDependencyGraphSnapshot {
    const files = this.readSourceFiles()
      .filter((entry) => entry.relativePath.endsWith('.ts') || entry.relativePath.endsWith('.tsx'))
      .map((entry) => this.toGraphFileRecord(entry));
    const fileMap = new Map<string, GraphFileRecord>();
    for (const file of files) {
      fileMap.set(this.normalizeKey(file.absolutePath), file);
    }

    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();
    const moduleStats = new Map<string, {
      fileCount: number;
      fanOut: Set<string>;
      fanIn: Set<string>;
      outgoingEdges: number;
      incomingEdges: number;
    }>();
    const crossDomainEdgeMap = new Map<string, {
      fromDomain: string;
      toDomain: string;
      allowed: boolean;
      importers: Set<string>;
      imports: number;
    }>();
    const violations: ArchitectureDomainDependencyViolation[] = [];

    for (const file of files) {
      this.ensureModuleStats(moduleStats, file.moduleId).fileCount += 1;
      const resolvedTargets = this.readResolvedImports(file, fileMap);
      outgoing.set(file.relativePath, new Set(resolvedTargets.map((entry) => entry.target.relativePath)));
      for (const edge of resolvedTargets) {
        const targetPath = edge.target.relativePath;
        const targetIncoming = incoming.get(targetPath) || new Set<string>();
        targetIncoming.add(file.relativePath);
        incoming.set(targetPath, targetIncoming);

        const fromModule = file.moduleId;
        const toModule = edge.target.moduleId;
        if (fromModule !== toModule) {
          this.ensureModuleStats(moduleStats, fromModule).fanOut.add(toModule);
          this.ensureModuleStats(moduleStats, fromModule).outgoingEdges += 1;
          this.ensureModuleStats(moduleStats, toModule).fanIn.add(fromModule);
          this.ensureModuleStats(moduleStats, toModule).incomingEdges += 1;
        }

        if (
          file.domainId
          && edge.target.domainId
          && file.domainId !== edge.target.domainId
          && this.isOfficialDomain(file.domainId)
          && this.isOfficialDomain(edge.target.domainId)
        ) {
          const allowed = this.isAllowedDomainDependency(file.domainId, edge.target.domainId);
          const edgeKey = `${file.domainId}->${edge.target.domainId}`;
          const aggregate = crossDomainEdgeMap.get(edgeKey) || {
            fromDomain: file.domainId,
            toDomain: edge.target.domainId,
            allowed,
            importers: new Set<string>(),
            imports: 0,
          };
          aggregate.importers.add(file.relativePath);
          aggregate.imports += 1;
          crossDomainEdgeMap.set(edgeKey, aggregate);
          if (!allowed) {
            violations.push({
              importerPath: file.relativePath,
              importerDomain: file.domainId,
              targetPath: edge.target.relativePath,
              targetDomain: edge.target.domainId,
              specifier: edge.specifier,
              allowed: false,
            });
          }
        }
      }
    }

    const moduleHotspots = Array.from(moduleStats.entries())
      .map(([id, stats]) => ({
        id,
        fileCount: stats.fileCount,
        fanOut: stats.fanOut.size,
        fanIn: stats.fanIn.size,
        outgoingEdges: stats.outgoingEdges,
        incomingEdges: stats.incomingEdges,
      }))
      .sort((left, right) =>
        (right.fanOut + right.fanIn + right.outgoingEdges + right.incomingEdges)
        - (left.fanOut + left.fanIn + left.outgoingEdges + left.incomingEdges),
      )
      .slice(0, 12);

    const entrypointHotspots = files
      .filter((file) => this.isEntrypoint(file.relativePath))
      .map((file) => {
        const fanOut = outgoing.get(file.relativePath)?.size || 0;
        const fanIn = incoming.get(file.relativePath)?.size || 0;
        return {
          path: file.relativePath,
          kind: this.resolveEntrypointKind(file.relativePath),
          moduleId: file.moduleId,
          fanIn,
          fanOut,
          score: fanIn + fanOut,
        } satisfies ArchitectureEntrypointFanSnapshot;
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);

    const domainMigration = OFFICIAL_DOMAIN_IDS.map((domainId) => this.buildDomainMigrationSnapshot(domainId, files, incoming));
    const crossDomainEdges = Array.from(crossDomainEdgeMap.values())
      .map((entry) => ({
        fromDomain: entry.fromDomain,
        toDomain: entry.toDomain,
        imports: entry.imports,
        allowed: entry.allowed,
        importers: Array.from(entry.importers).sort().slice(0, 8),
      }))
      .sort((left, right) => right.imports - left.imports);
    const posture = violations.length > 0 ? 'critical' : 'healthy';

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        posture,
        modulesTracked: moduleStats.size,
        crossDomainEdges: crossDomainEdges.length,
        crossDomainViolations: violations.length,
        entrypointsTracked: entrypointHotspots.length,
        domainsTracked: domainMigration.length,
        domainsAdopted: domainMigration.filter((entry) => entry.stage === 'adopted').length,
      },
      crossDomainEdges,
      violations,
      moduleHotspots,
      entrypointHotspots,
      domainMigration,
      narrative: {
        headline: 'Dependency graph arquitetural',
        operatorSummary:
          `${moduleStats.size} modulo(s) monitorado(s), ${crossDomainEdges.length} aresta(s) entre domains e `
          + `${violations.length} unauthorized cross-dependency/dependencies.`,
        nextAction:
          violations[0] ? `Remover import cruzada ${violations[0].importerDomain} -> ${violations[0].targetDomain}.`
            : 'Preserve domain boundaries and use fan-in/fan-out hotspots for new cuts.',
      },
    };
  }

  private buildDomainMigrationSnapshot(
    domainId: string,
    files: GraphFileRecord[],
    incoming: Map<string, Set<string>>,
  ): ArchitectureDomainMigrationSnapshot {
    const domainFiles = files.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/`));
    const applicationFiles = domainFiles.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/application/`)).length;
    const domainLayerFiles = domainFiles.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/domain/`)).length;
    const infrastructureFiles = domainFiles.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/infrastructure/`)).length;
    const presentationFiles = domainFiles.filter((entry) => entry.relativePath.startsWith(`domain/${domainId}/presentation/`)).length;
    const ownershipReady = applicationFiles > 0 && domainLayerFiles > 0 && infrastructureFiles > 0 && presentationFiles > 0;
    const consumerPaths = new Set<string>();
    const serviceConsumerPaths = new Set<string>();
    for (const file of domainFiles) {
      for (const importer of incoming.get(file.relativePath) || []) {
        if (importer.startsWith(`domain/${domainId}/`)) {
          continue;
        }
        consumerPaths.add(importer);
        if (importer.startsWith('services/')) {
          serviceConsumerPaths.add(importer);
        }
      }
    }

    const present = domainFiles.length > 0;
    const externalConsumers = consumerPaths.size;
    const serviceConsumers = serviceConsumerPaths.size;
    const stage: ArchitectureDomainMigrationSnapshot['stage'] = !present ? 'missing'
      : !ownershipReady ? 'seeded'
        : externalConsumers > 0
          ? 'adopted'
          : 'owned';

    return {
      id: domainId,
      path: `src/domain/${domainId}`,
      present,
      ownershipReady,
      applicationFiles,
      domainFiles: domainLayerFiles,
      infrastructureFiles,
      presentationFiles,
      externalConsumers,
      serviceConsumers,
      stage,
      nextAction: this.resolveDomainMigrationAction(stage),
    };
  }

  private resolveDomainMigrationAction(stage: ArchitectureDomainMigrationSnapshot['stage']): string {
    if (stage === 'missing') {
      return 'Seed the official domain boundary.';
    }
    if (stage === 'seeded') {
      return 'Fechar application, domain, infrastructure e presentation.';
    }
    if (stage === 'owned') {
      return 'Connect composition roots, compatibility services, or surfaces to the domain.';
    }
    return 'Preserve ownership and move new code into the domain.';
  }

  private ensureModuleStats(
    registry: Map<string, {
      fileCount: number;
      fanOut: Set<string>;
      fanIn: Set<string>;
      outgoingEdges: number;
      incomingEdges: number;
    }>,
    moduleId: string,
  ) {
    const current = registry.get(moduleId);
    if (current) {
      return current;
    }
    const created = {
      fileCount: 0,
      fanOut: new Set<string>(),
      fanIn: new Set<string>(),
      outgoingEdges: 0,
      incomingEdges: 0,
    };
    registry.set(moduleId, created);
    return created;
  }

  private readResolvedImports(
    file: GraphFileRecord,
    fileMap: Map<string, GraphFileRecord>,
  ): Array<{ specifier: string; target: GraphFileRecord }> {
    const contents = fs.readFileSync(file.absolutePath, 'utf8');
    const specifiers = this.parseImportSpecifiers(contents);
    const resolved: Array<{ specifier: string; target: GraphFileRecord }> = [];
    const seen = new Set<string>();
    for (const specifier of specifiers) {
      const target = this.resolveImportTarget(file.absolutePath, specifier, fileMap);
      if (!target) {
        continue;
      }
      const key = `${specifier}::${target.relativePath}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      resolved.push({ specifier, target });
    }
    return resolved;
  }

  private parseImportSpecifiers(contents: string): string[] {
    const values: string[] = [];
    const patterns = [
      /\b(?:import|export)\s+(?:type\s+)...(?:[\s\S]*?\s+from\s+)...["']([^"']+)["']/g,
      /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(contents)) !== null) {
        const specifier = String(match[1] || '').trim();
        if (specifier) {
          values.push(specifier);
        }
      }
    }
    return values;
  }

  private resolveImportTarget(
    importerPath: string,
    specifier: string,
    fileMap: Map<string, GraphFileRecord>,
  ): GraphFileRecord | null {
    if (!specifier.startsWith('.')) {
      return null;
    }
    const importerDir = path.dirname(importerPath);
    const rawTarget = path.resolve(importerDir, specifier);
    const candidates = this.buildCandidateTargets(rawTarget, specifier);
    for (const candidate of candidates) {
      const resolved = fileMap.get(this.normalizeKey(candidate));
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  private buildCandidateTargets(rawTarget: string, specifier: string): string[] {
    const withoutJs = specifier.endsWith('.js') ? rawTarget.slice(0, -3) : rawTarget;
    const candidates = new Set<string>([
      rawTarget,
      withoutJs,
      `${rawTarget}.ts`,
      `${rawTarget}.tsx`,
      `${withoutJs}.ts`,
      `${withoutJs}.tsx`,
      path.join(rawTarget, 'index.ts'),
      path.join(rawTarget, 'index.tsx'),
      path.join(withoutJs, 'index.ts'),
      path.join(withoutJs, 'index.tsx'),
    ]);
    return Array.from(candidates);
  }

  private isAllowedDomainDependency(fromDomain: string, toDomain: string): boolean {
    return (ALLOWED_DOMAIN_DEPENDENCIES[fromDomain] || []).includes(toDomain);
  }

  private isEntrypoint(relativePath: string): boolean {
    const base = path.posix.basename(relativePath);
    return /(Facade|Service|Runtime|Gateway|Cli|RouteService|ControlPlaneService)\.(ts|tsx)$/.test(base)
      || /^(index\.ts|page\.tsx|route\.ts)$/.test(base);
  }

  private resolveEntrypointKind(relativePath: string): string {
    const base = path.posix.basename(relativePath);
    if (base === 'page.tsx') {
      return 'next-page';
    }
    if (base === 'route.ts') {
      return 'next-route';
    }
    if (base === 'index.ts') {
      return 'barrel';
    }
    if (base.endsWith('Facade.ts')) {
      return 'facade';
    }
    if (base.endsWith('ControlPlaneService.ts')) {
      return 'control-plane';
    }
    if (base.endsWith('RouteService.ts')) {
      return 'route';
    }
    if (base.endsWith('Gateway.ts')) {
      return 'gateway';
    }
    if (base.endsWith('Runtime.ts')) {
      return 'runtime';
    }
    if (base.endsWith('Cli.ts')) {
      return 'cli';
    }
    return 'service';
  }

  private toGraphFileRecord(entry: { absolutePath: string; relativePath: string }): GraphFileRecord {
    const relativePath = entry.relativePath.replace(/\\/g, '/');
    return {
      absolutePath: path.resolve(entry.absolutePath),
      relativePath,
      moduleId: this.resolveModuleId(relativePath),
      domainId: this.resolveDomainId(relativePath),
    };
  }

  private resolveDomainId(relativePath: string): string | null {
    const parts = relativePath.split('/');
    if (parts[0] === 'domain' && parts.length >= 3 && parts[1] && !parts[1].includes('.')) {
      return parts[1];
    }
    return null;
  }

  private isOfficialDomain(domainId: string): boolean {
    return (OFFICIAL_DOMAIN_IDS as readonly string[]).includes(domainId);
  }

  private resolveModuleId(relativePath: string): string {
    const parts = relativePath.split('/');
    if (parts[0] === 'domain' && parts[1]) {
      return `domain/${parts[1]}`;
    }
    if (parts.length >= 3 && (parts[0] === 'services' || parts[0] === 'ai-gateway')) {
      return `${parts[0]}/${parts[1]}`;
    }
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0] || '<root>';
  }

  private normalizeKey(filePath: string): string {
    return path.resolve(filePath).replace(/\\/g, '/').toLowerCase();
  }

  private scanSourceFiles(): Array<{ absolutePath: string; relativePath: string }> {
    const files: Array<{ absolutePath: string; relativePath: string }> = [];
    if (!fs.existsSync(this.srcRoot)) {
      return files;
    }
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolutePath);
          continue;
        }
        if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
          continue;
        }
        files.push({
          absolutePath,
          relativePath: path.relative(this.srcRoot, absolutePath).replace(/\\/g, '/'),
        });
      }
    };
    walk(this.srcRoot);
    return files;
  }
}
