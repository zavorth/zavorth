import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthDependencyAnalyzerTool extends BaseTool {
  public readonly name = 'zavorth_dependency_analyzer';

  public readonly description =
    'Dependency analysis — check outdated packages, audit vulnerabilities, analyze licenses, inspect bundle size, detect unused dependencies, and generate dependency trees.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'outdated', 'audit', 'licenses', 'tree', 'unused', 'size', 'summary', 'fix'.",
      },
      directory: {
        type: 'string',
        description: 'Project directory to analyze. Default: current directory.',
      },
      package_manager: {
        type: 'string',
        description: "Package manager: 'npm', 'yarn', 'pnpm', 'pip', 'cargo', 'auto'. Default: 'auto'.",
      },
      depth: {
        type: 'number',
        description: 'Depth for dependency tree. Default: 3.',
      },
      include_dev: {
        type: 'boolean',
        description: 'Include devDependencies. Default: true.',
      },
      severity: {
        type: 'string',
        description: "Vulnerability severity filter: 'low', 'moderate', 'high', 'critical'.",
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json'. Default: 'text'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'outdated': return await this.checkOutdated(args);
      case 'audit': return await this.auditVulnerabilities(args);
      case 'licenses': return await this.checkLicenses(args);
      case 'tree': return await this.dependencyTree(args);
      case 'unused': return await this.findUnused(args);
      case 'size': return await this.analyzeSize(args);
      case 'summary': return await this.summary(args);
      case 'fix': return await this.fixVulnerabilities(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private detectPackageManager(dir: string): string {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'pip';
    if (fs.existsSync(path.join(dir, 'Cargo.lock'))) return 'cargo';
    return 'npm';
  }

  private async runCmd(cmd: string, cmdArgs: string[], cwd: string, timeout = 60000): Promise<string> {
    const { execFileSync } = await import('child_process');
    return execFileSync(cmd, cmdArgs, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 }).toString();
  }

  private async checkOutdated(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');
    const pm = String(args.package_manager || 'auto');
    const resolved = pm === 'auto' ? this.detectPackageManager(dir) : pm;

    try {
      switch (resolved) {
        case 'npm':
          return `Outdated packages:\n${await this.runCmd('npm', ['outdated', '--long'], dir)}`;
        case 'yarn':
          return `Outdated packages:\n${await this.runCmd('yarn', ['outdated'], dir)}`;
        case 'pnpm':
          return `Outdated packages:\n${await this.runCmd('pnpm', ['outdated'], dir)}`;
        case 'pip':
          return `Outdated packages:\n${await this.runCmd('pip', ['list', '--outdated', '--format=columns'], dir)}`;
        case 'cargo':
          return `Outdated packages:\n${await this.runCmd('cargo', ['install', 'cargo-outdated', '&&', 'cargo', 'outdated'], dir)}`;
        default:
          return `Error: Package manager "${resolved}" not supported for outdated check.`;
      }
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] operation failed', error); return ''; }
  }

  private async auditVulnerabilities(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');
    const pm = String(args.package_manager || 'auto');
    const resolved = pm === 'auto' ? this.detectPackageManager(dir) : pm;
    const severity = String(args.severity || '');

    try {
      switch (resolved) {
        case 'npm': {
          const auditArgs = ['audit', '--json'];
          if (severity) auditArgs.push(`--audit-level=${severity}`);
          const result = await this.runCmd('npm', auditArgs, dir);
          try {
            const parsed = JSON.parse(result);
            const vulns = parsed.metadata?.vulnerabilities || {};
            return [
              'NPM Audit Results:',
              `  Critical: ${vulns.critical || 0}`,
              `  High: ${vulns.high || 0}`,
              `  Moderate: ${vulns.moderate || 0}`,
              `  Low: ${vulns.low || 0}`,
              `  Total: ${vulns.total || 0}`,
            ].join('\n');
          } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] parsing failed', error); return ''; }
        }
        case 'yarn':
          return `Yarn Audit:\n${await this.runCmd('yarn', ['audit'], dir)}`;
        case 'pip':
          return `Pip Audit:\n${await this.runCmd('pip', ['audit'], dir)}`;
        case 'cargo':
          return `Cargo Audit:\n${await this.runCmd('cargo', ['audit'], dir)}`;
        default:
          return `Error: Package manager "${resolved}" not supported for audit.`;
      }
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] operation failed', error); return ''; }
  }

  private async checkLicenses(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['license-checker', '--summary', '--production'], { cwd: dir, timeout: 30000 }).toString();
      return `License summary:\n${result.trim().slice(0, 3000)}`;
    } catch (error: unknown) {
      try {
        const pkgPath = path.join(dir, 'package.json');
        if (!fs.existsSync(pkgPath)) return 'Error: No package.json found.';
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies };
        return `Dependencies (license check requires license-checker):\n${Object.keys(deps).join(', ')}`;
      } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] JSON parse failed', error); return ''; }
    }
  }

  private async dependencyTree(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');
    const depth = Number(args.depth || 3);

    try {
      const result = await this.runCmd('npm', ['ls', '--depth', String(depth), '--json'], dir);
      const parsed = JSON.parse(result);
      const lines: string[] = [];
      const walk = (deps: Record<string, unknown>, indent: number) => {
        for (const [name, info] of Object.entries(deps)) {
          const version = (info as Record<string, unknown>)?.version || '?';
          lines.push(`${'  '.repeat(indent)}${name}@${version}`);
          if (indent < depth) {
            const subDeps = (info as Record<string, unknown>)?.dependencies as Record<string, unknown> | undefined;
            if (subDeps) walk(subDeps, indent + 1);
          }
        }
      };
      walk(parsed.dependencies || {}, 0);
      return `Dependency tree (depth ${depth}):\n${lines.join('\n').slice(0, 5000)}`;
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] parsing failed', error); return ''; }
  }

  private async findUnused(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['depcheck', dir, '--json'], { timeout: 60000 }).toString();
      const parsed = JSON.parse(result);
      const unused = parsed.dependencies || [];
      const missing = Object.keys(parsed.missing || {});
      return [
        `Unused dependencies (${unused.length}):`,
        ...unused.map((d: string) => `  - ${d}`),
        '',
        `Missing dependencies (${missing.length}):`,
        ...missing.map((d: string) => `  - ${d}`),
      ].join('\n').slice(0, 3000);
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] parsing failed', error); return ''; }
  }

  private async analyzeSize(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['bundlephobia', dir], { timeout: 30000 }).toString();
      return `Bundle size analysis:\n${result.trim().slice(0, 2000)}`;
    } catch (error: unknown) {
      const nodeModulesPath = path.join(dir, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) return 'Error: node_modules not found.';

      const entries = fs.readdirSync(nodeModulesPath)
        .filter(e => !e.startsWith('.'))
        .map(e => {
          try {
            const stat = fs.statSync(path.join(nodeModulesPath, e));
            return { name: e, size: stat.size };
          } catch (error: unknown) {
    logger.warn('[Zavorth Dependency Analyzer] filesystem operation failed', error);
    return { name: e, size: 0 };
  }
        })
        .sort((a, b) => b.size - a.size)
        .slice(0, 20);

      return `Top packages by size:\n${entries.map(e => `  ${e.name}: ${(e.size / 1024).toFixed(1)} KB`).join('\n')}`;
    }
  }

  private async summary(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');

    try {
      const pkgPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgPath)) return 'Error: No package.json found.';
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      const peerDeps = Object.keys(pkg.peerDependencies || {});

      return [
        `Dependency Summary for ${pkg.name || 'unknown'}@${pkg.version || '0.0.0'}:`,
        `  Production: ${deps.length}`,
        `  Dev: ${devDeps.length}`,
        `  Peer: ${peerDeps.length}`,
        `  Total: ${deps.length + devDeps.length + peerDeps.length}`,
      ].join('\n');
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] operation failed', error); return ''; }
  }

  private async fixVulnerabilities(args: Record<string, unknown>): Promise<string> {
    const dir = String(args.directory || '.');

    try {
      const result = await this.runCmd('npm', ['audit', 'fix', '--json'], dir);
      try {
        const parsed = JSON.parse(result);
        const added = parsed.added || 0;
        const removed = parsed.removed || 0;
        const changed = parsed.changed || 0;
        return `Vulnerability fix results:\n  Added: ${added}\n  Removed: ${removed}\n  Changed: ${changed}`;
      } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] JSON parse failed', error); return ''; }
    } catch (error: unknown) { logger.warn('[Zavorth Dependency Analyzer] JSON parse failed', error); return ''; }
  }
}
