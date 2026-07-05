import fs from 'fs';
import path from 'path';
import type { AgentOsProjectTwinSnapshot } from '../contracts/AgentOsContract.js';
import { logger } from '../logger.js';
import {
isAgentOsSensitivePath,
  redactAgentOsText,
  toAgentOsPortablePath,
  truncateAgentOsText,
} from './AgentOsTextSafety.js';

type ProjectDigitalTwinRuntime = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
};

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-ops', '.next', '.cache', 'coverage', 'data']);
const MAX_FILES = 240;

export class ProjectDigitalTwinService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;

  constructor(runtime: ProjectDigitalTwinRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
  }

  public buildSnapshot(input: { workspaceRoot?: string | null }): AgentOsProjectTwinSnapshot {
    const root = input.workspaceRoot ? path.resolve(input.workspaceRoot) : process.cwd();
    if (!this.existsSync(root)) {
      return this.empty(root, 'missing');
    }
    const files = this.walk(root);
    const packageSummary = this.readPackageSummary(root);
    const sensitiveZones = files.filter(isAgentOsSensitivePath).slice(0, 24);
    const moduleMap = this.moduleMap(root);
    return {
      source: 'ProjectDigitalTwinService',
      workspaceRoot: toAgentOsPortablePath(root),
      generatedAt: this.now().toISOString(),
      freshness: files.length > 0 ? 'fresh' : 'stale',
      rawSecretsSerialized: false,
      fileSummary: {
        totalIndexed: files.length,
        sourceFiles: files.filter((file) => /^src\//.test(file)).length,
        testFiles: files.filter((file) => /^tests?\//.test(file) || /\.test\.[tj]sx?$/.test(file)).length,
        configFiles: files.filter((file) => /(^|\/)(package\.json|tsconfig|jest\.config|config\/)/i.test(file)).length,
        sensitiveZones: sensitiveZones.map((entry) => truncateAgentOsText(entry, 120)),
      },
      packageSummary,
      moduleMap,
      architecturePatterns: this.patterns(files, moduleMap, packageSummary.scripts),
      receipts: [
        'project-twin-read-only',
        'project-twin-no-secret-content',
        'project-twin-cache-not-source-of-truth',
      ],
    };
  }

  private empty(root: string, freshness: AgentOsProjectTwinSnapshot['freshness']): AgentOsProjectTwinSnapshot {
    return {
      source: 'ProjectDigitalTwinService',
      workspaceRoot: root ? toAgentOsPortablePath(root) : null,
      generatedAt: this.now().toISOString(),
      freshness,
      rawSecretsSerialized: false,
      fileSummary: { totalIndexed: 0, sourceFiles: 0, testFiles: 0, configFiles: 0, sensitiveZones: [] },
      packageSummary: { scripts: [], dependencies: [], devDependencies: [] },
      moduleMap: [],
      architecturePatterns: ['workspace ausente ou vazio'],
      receipts: ['project-twin-read-only', 'project-twin-empty'],
    };
  }

  private walk(root: string): string[] {
    const out: string[] = [];
    const visit = (dir: string) => {
      if (out.length >= MAX_FILES) return;
      for (const entry of this.safeReadDir(dir)) {
        if (out.length >= MAX_FILES) break;
        if (IGNORED_DIRS.has(entry)) continue;
        const absolute = path.join(dir, entry);
        const relative = path.relative(root, absolute).replace(/\\/g, '/');
        const stat = this.safeStat(absolute);
        if (!stat) continue;
        if (stat.isDirectory()) {
          visit(absolute);
        } else if (stat.isFile()) {
          out.push(redactAgentOsText(relative));
        }
      }
    };
    visit(root);
    return out.sort();
  }

  private safeReadDir(dir: string): string[] {
    try {
      return this.readdirSync(dir);
    } catch (error) { logger.warn('[Project Digital Twin] filesystem operation failed', error); return []; }
  }

  private safeStat(target: string): fs.Stats | null {
    try {
      return this.statSync(target);
    } catch (error) { logger.warn('[Project Digital Twin] filesystem operation failed', error); return null; }
  }

  private readPackageSummary(root: string): AgentOsProjectTwinSnapshot['packageSummary'] {
    const pkgPath = path.join(root, 'package.json');
    if (!this.existsSync(pkgPath)) return { scripts: [], dependencies: [], devDependencies: [] };
    try {
      const parsed = JSON.parse(this.readFileSync(pkgPath, 'utf8')) as {
        scripts?: Record<string, unknown>;
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };
      return {
        scripts: Object.keys(parsed.scripts || {}).slice(0, 40).map((entry) => truncateAgentOsText(entry, 80)),
        dependencies: Object.keys(parsed.dependencies || {}).slice(0, 40).map((entry) => truncateAgentOsText(entry, 80)),
        devDependencies: Object.keys(parsed.devDependencies || {}).slice(0, 40).map((entry) => truncateAgentOsText(entry, 80)),
      };
    } catch (error) {
    logger.warn('[Project Digital Twin] parsing failed', error);
    return { scripts: [], dependencies: [], devDependencies: [] };
  }
  }

  private moduleMap(root: string): AgentOsProjectTwinSnapshot['moduleMap'] {
    const candidates = ['src/runtime', 'src/services', 'src/contracts', 'src/security', 'src/tools', 'tests', 'scripts'];
    return candidates
      .filter((relative) => this.existsSync(path.join(root, relative)))
      .map((relative) => ({
        id: relative.replace(/\//g, '.'),
        path: relative,
        role: this.roleFor(relative),
      }));
  }

  private roleFor(relative: string): string {
    if (relative.includes('runtime')) return 'execucao e orquestracao';
    if (relative.includes('services')) return 'capacidades e politicas';
    if (relative.includes('contracts')) return 'contratos publicos';
    if (relative.includes('security')) return 'fronteira de seguranca';
    if (relative.includes('tools')) return 'ferramentas governadas';
    if (relative.includes('tests')) return 'validacao';
    return 'operacao';
  }

  private patterns(files: string[], modules: AgentOsProjectTwinSnapshot['moduleMap'], scripts: string[]): string[] {
    return [
      modules.some((entry) => entry.path === 'src/contracts') ? 'contratos versionados' : 'contratos nao detectados',
      scripts.includes('workspace:check') ? 'workspace check agregado' : 'workspace check nao detectado',
      files.some((entry) => entry.includes('security')) ? 'security boundary presente' : 'security boundary nao detectada',
      files.some((entry) => entry.includes('Capability')) ? 'capability system presente' : 'capability system nao detectado',
    ];
  }
}
