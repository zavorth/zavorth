import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import {
  PRESENTATION_BOUNDARY_ALLOWED_CHANNELS,
  PRESENTATION_BOUNDARY_FORBIDDEN_PREFIXES,
  PRESENTATION_SURFACE_CONTRACTS,
  type PresentationBoundaryPolicySnapshot,
  type PresentationBoundaryPosture,
  type PresentationBoundaryViolation,
  type PresentationSurfaceContract,
} from '../contracts/PresentationBoundaryContract.js';

type PresentationSourceFile = {
  relativePath: string;
  contents: string;
};

type PresentationBoundaryPolicyDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  srcRoot?: string | null;
  surfaces?: PresentationSurfaceContract[];
  readSourceFiles?: () => PresentationSourceFile[];
};

type ImportReference = {
  specifier: string;
  line: number;
};

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)...(?:[\s\S]*?\s+from\s+)...['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export class PresentationBoundaryPolicyService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly srcRoot: string;
  private readonly surfaces: PresentationSurfaceContract[];
  private readonly readSourceFiles: () => PresentationSourceFile[];

  constructor(deps: PresentationBoundaryPolicyDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.workspaceRoot = String(deps.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.srcRoot = String(deps.srcRoot || path.join(this.workspaceRoot, 'src')).trim();
    this.surfaces = deps.surfaces || PRESENTATION_SURFACE_CONTRACTS;
    this.readSourceFiles = deps.readSourceFiles || (() => this.scanSourceFiles());
  }

  public buildSnapshot(): PresentationBoundaryPolicySnapshot {
    const files = this.readSourceFiles()
      .filter((entry) => /\.(ts|tsx)$/.test(entry.relativePath))
      .map((entry) => ({
        relativePath: this.normalizeRelativePath(entry.relativePath),
        contents: String(entry.contents || ''),
      }));
    const surfaces = this.surfaces.map((surface) => {
      const surfaceFiles = files.filter((file) => this.belongsToSurface(file.relativePath, surface));
      const violations = surfaceFiles.flatMap((file) => this.scanFile(surface, file));
      return {
        id: surface.id,
        label: surface.label,
        roots: [...surface.roots],
        fileCount: surfaceFiles.length,
        channels: [...surface.channels],
        violations,
        ready: surfaceFiles.length > 0 && violations.length === 0,
      };
    });
    const violations = surfaces.flatMap((surface) => surface.violations);
    const summary = {
      posture: this.resolvePosture(surfaces.filter((surface) => surface.ready).length, surfaces.length, violations.length),
      surfacesReady: surfaces.filter((surface) => surface.ready).length,
      surfacesTotal: surfaces.length,
      auditedFiles: surfaces.reduce((total, surface) => total + surface.fileCount, 0),
      violations: violations.length,
      allowedChannels: [...PRESENTATION_BOUNDARY_ALLOWED_CHANNELS],
    };
    return {
      generatedAt: this.now().toISOString(),
      summary,
      surfaces,
      violations,
      narrative: {
        headline: 'Presentation Boundary Policy',
        operatorSummary:
          `${summary.surfacesReady}/${summary.surfacesTotal} surface(s) visuais auditadas, `
          + `${summary.auditedFiles} presentation file(s) and ${summary.violations} prohibited dependency issue(s).`,
        nextAction:
          violations[0]?.reason
          || 'Manter UI e presentation dependentes only de snapshots, actions, events, streams e assets.',
      },
    };
  }

  private scanFile(
    surface: PresentationSurfaceContract,
    file: PresentationSourceFile,
  ): PresentationBoundaryViolation[] {
    return this.extractImports(file.contents).flatMap((reference) => {
      const resolvedPath = this.resolveImportPath(file.relativePath, reference.specifier);
      if (!resolvedPath || this.isAllowedInternalPath(surface, resolvedPath)) {
        return [];
      }
      const forbiddenPrefix = PRESENTATION_BOUNDARY_FORBIDDEN_PREFIXES.find((prefix) =>
        resolvedPath.startsWith(prefix),
      );
      if (!forbiddenPrefix) {
        return [];
      }
      return [{
        surfaceId: surface.id,
        file: file.relativePath,
        line: reference.line,
        importPath: reference.specifier,
        resolvedPath,
        reason:
          `${surface.label} importa ${forbiddenPrefix} diretamente; use contratos, snapshots, actions, events ou streams.`,
      }];
    });
  }

  private extractImports(contents: string): ImportReference[] {
    const references: ImportReference[] = [];
    for (const match of contents.matchAll(IMPORT_PATTERN)) {
      const specifier = String(match[1] || match[2] || '').trim();
      if (!specifier) {
        continue;
      }
      references.push({
        specifier,
        line: this.countLine(contents, match.index || 0),
      });
    }
    return references;
  }

  private resolveImportPath(fromFile: string, specifier: string): string | null {
    if (specifier.startsWith('@/')) {
      return this.normalizeRelativePath(path.posix.join('ai-gateway', specifier.slice(2)));
    }
    if (!specifier.startsWith('.')) {
      return null;
    }
    const directory = path.posix.dirname(fromFile);
    const resolved = path.posix.normalize(path.posix.join(directory, specifier));
    if (resolved.startsWith('../')) {
      return null;
    }
    return this.normalizeRelativePath(resolved);
  }

  private belongsToSurface(relativePath: string, surface: PresentationSurfaceContract): boolean {
    return surface.roots.some((root) => relativePath.startsWith(this.normalizeRelativePath(root)));
  }

  private isAllowedInternalPath(surface: PresentationSurfaceContract, resolvedPath: string): boolean {
    return surface.allowedInternalPrefixes.some((prefix) =>
      resolvedPath.startsWith(this.normalizeRelativePath(prefix)),
    );
  }

  private resolvePosture(ready: number, total: number, violations: number): PresentationBoundaryPosture {
    if (violations > 0) {
      return 'critical';
    }
    if (ready < total) {
      return 'attention';
    }
    return 'healthy';
  }

  private countLine(contents: string, index: number): number {
    return contents.slice(0, index).split(/\r?\n/g).length;
  }

  private scanSourceFiles(): PresentationSourceFile[] {
    const files: PresentationSourceFile[] = [];
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
          relativePath: this.normalizeRelativePath(path.relative(this.srcRoot, absolutePath)),
          contents: fs.readFileSync(absolutePath, 'utf8'),
        });
      }
    };
    walk(this.srcRoot);
    return files;
  }

  private normalizeRelativePath(value: string): string {
    return String(value || '').replace(/\\/g, '/').replace(/^src\//, '').replace(/^\.\//, '');
  }
}
