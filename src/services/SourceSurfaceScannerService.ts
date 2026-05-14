import fs from 'node:fs';
import path from 'node:path';
import type {
  SourceDiscoveredSurface,
  SourceSurfaceCategory,
  SourceSurfaceEvidenceCounts,
} from '../contracts/SourceSurfaceLedgerContract.js';

export type SourceSurfaceScanSnapshot = {
  sourceRoot: string;
  discovered: SourceDiscoveredSurface[];
  ignored: string[];
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const GENERATED_OR_VOLATILE_ROOTS = new Set([
  '.artifacts',
  '.git',
  '.local',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'tmp',
]);

const RECURSIVE_COUNT_IGNORES = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'tmp',
]);

const TRACKED_RUNTIME_DEPENDENCIES = new Set([
  '@agentclientprotocol/sdk',
  '@agentclientprotocol/claude-agent-acp',
  '@anthropic-ai/sdk',
  '@anthropic-ai/vertex-sdk',
  '@anthropic-ai/claude-agent-sdk',
  '@anthropic-ai/claude-code',
  '@aws-sdk/client-bedrock',
  '@aws-sdk/client-bedrock-runtime',
  '@aws/bedrock-token-generator',
  '@google/genai',
  '@modelcontextprotocol/sdk',
  '@zed-industries/codex-acp',
  'acpx',
  'grammy',
  '@grammyjs/runner',
  '@grammyjs/transformer-throttler',
  '@slack/bolt',
  '@slack/web-api',
  '@lydell/node-pty',
  '@mariozechner/pi-agent-core',
  '@mariozechner/pi-ai',
  '@mariozechner/pi-coding-agent',
  '@mariozechner/pi-tui',
  'sqlite-vec',
  'pdfjs-dist',
  '@mozilla/readability',
  'tree-sitter-bash',
  'web-tree-sitter',
  'tokenjuice',
  'proxy-agent',
  'https-proxy-agent',
  'undici',
  'qrcode',
  '@whiskeysockets/baileys',
]);

const SUPPORT_SURFACE_PATHS = [
  'qa',
  'qa/convex-credential-broker',
  'security/opengrep',
  'deploy/fly.private.toml',
  'vendor/a2ui',
  'docs',
  'docs/providers',
  'docs/channels',
  'docs/plugins',
  'ui',
];

const SCRIPT_GROUPS = [
  'static-boundary-quality',
  'test-qa-perf-live',
  'release-package',
  'plugin-extension-ops',
  'container-deploy-sandbox',
  'docs-i18n',
  'generation-build',
  'native-app-build',
  'security-auth',
  'agent-provider-live',
  'other',
] as const;

type ScriptGroup = typeof SCRIPT_GROUPS[number];

export class SourceSurfaceScannerService {
  public scan(sourceRoot: string): SourceSurfaceScanSnapshot {
    const normalizedRoot = path.resolve(sourceRoot);
    const discovered: SourceDiscoveredSurface[] = [];
    const ignored: string[] = [];

    if (!fs.existsSync(normalizedRoot)) {
      return {
        sourceRoot: normalizePath(normalizedRoot),
        discovered,
        ignored: [`missing-root:${normalizePath(normalizedRoot)}`],
      };
    }

    this.scanRoot(normalizedRoot, discovered, ignored);
    this.scanDirectoryChildren(normalizedRoot, 'apps', 'native_app', discovered);
    this.scanDirectoryChildren(normalizedRoot, 'packages', 'internal_package', discovered);
    this.scanSrc(normalizedRoot, discovered);
    this.scanScriptGroups(normalizedRoot, discovered);
    this.scanSupportSurfaces(normalizedRoot, discovered);
    this.scanPatchSurfaces(normalizedRoot, discovered);
    this.scanGithubWorkflows(normalizedRoot, discovered);
    this.scanDirectoryChildren(normalizedRoot, 'skills', 'skill', discovered);
    this.scanRuntimeDependencies(normalizedRoot, discovered);

    return {
      sourceRoot: normalizePath(normalizedRoot),
      discovered: sortSurfaces(dedupeSurfaces(discovered)),
      ignored: ignored.sort(),
    };
  }

  private scanRoot(
    sourceRoot: string,
    discovered: SourceDiscoveredSurface[],
    ignored: string[],
  ): void {
    for (const entry of readDir(sourceRoot)) {
      if (entry.isDirectory()) {
        if (GENERATED_OR_VOLATILE_ROOTS.has(entry.name)) {
          ignored.push(entry.name);
          continue;
        }
        discovered.push(this.filesystemSurface(
          'root_directory',
          entry.name,
          entry.name,
          'directory',
          path.join(sourceRoot, entry.name),
        ));
        continue;
      }

      if (entry.isFile()) {
        discovered.push(this.filesystemSurface(
          'root_file',
          entry.name,
          entry.name,
          'file',
          path.join(sourceRoot, entry.name),
        ));
      }
    }
  }

  private scanDirectoryChildren(
    sourceRoot: string,
    relativeDirectory: string,
    category: SourceSurfaceCategory,
    discovered: SourceDiscoveredSurface[],
  ): void {
    const absoluteDirectory = path.join(sourceRoot, relativeDirectory);
    if (!fs.existsSync(absoluteDirectory)) return;

    for (const entry of readDir(absoluteDirectory)) {
      if (!entry.isDirectory()) continue;
      if (RECURSIVE_COUNT_IGNORES.has(entry.name)) continue;
      const relativePath = joinPath(relativeDirectory, entry.name);
      discovered.push(this.filesystemSurface(
        category,
        relativePath,
        entry.name,
        'directory',
        path.join(absoluteDirectory, entry.name),
      ));
    }
  }

  private scanSrc(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const srcRoot = path.join(sourceRoot, 'src');
    if (!fs.existsSync(srcRoot)) return;

    for (const entry of readDir(srcRoot)) {
      const relativePath = joinPath('src', entry.name);
      const absolutePath = path.join(srcRoot, entry.name);
      if (entry.isDirectory()) {
        if (RECURSIVE_COUNT_IGNORES.has(entry.name)) continue;
        discovered.push(this.filesystemSurface(
          'src_module',
          relativePath,
          entry.name,
          'directory',
          absolutePath,
        ));
      } else if (entry.isFile()) {
        discovered.push(this.filesystemSurface(
          'src_singleton_file',
          relativePath,
          entry.name,
          'file',
          absolutePath,
        ));
      }
    }
  }

  private scanScriptGroups(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const scriptsRoot = path.join(sourceRoot, 'scripts');
    if (!fs.existsSync(scriptsRoot)) return;

    const allScriptNames = collectRelativeFiles(scriptsRoot);
    const groups = new Map<ScriptGroup, string[]>();
    for (const group of SCRIPT_GROUPS) {
      groups.set(group, []);
    }

    for (const script of allScriptNames) {
      const group = classifyScriptGroup(script);
      groups.get(group)?.push(script);
    }

    for (const group of SCRIPT_GROUPS) {
      const scripts = groups.get(group) || [];
      if (scripts.length === 0) continue;
      discovered.push({
        category: 'script_group',
        sourcePath: `scripts/${group}`,
        item: group,
        kind: 'semantic-group',
        source: 'semantic-script-group',
        evidence: [`files=${scripts.length}`, `examples=${scripts.slice(0, 5).join(',')}`],
        counts: {
          files: scripts.length,
          dirs: 0,
        },
      });
    }
  }

  private scanSupportSurfaces(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const scenarioRoot = path.join(sourceRoot, 'qa', 'scenarios');
    if (fs.existsSync(scenarioRoot)) {
      for (const entry of readDir(scenarioRoot)) {
        if (!entry.isDirectory()) continue;
        const relativePath = joinPath('qa/scenarios', entry.name);
        discovered.push(this.filesystemSurface(
          'support_surface',
          relativePath,
          relativePath,
          'directory',
          path.join(scenarioRoot, entry.name),
        ));
      }
    }

    for (const supportPath of SUPPORT_SURFACE_PATHS) {
      const absolutePath = path.join(sourceRoot, supportPath);
      if (!fs.existsSync(absolutePath)) continue;
      const stat = fs.statSync(absolutePath);
      discovered.push(this.filesystemSurface(
        'support_surface',
        supportPath,
        supportPath,
        stat.isDirectory() ? 'directory' : 'file',
        absolutePath,
      ));
    }
  }

  private scanPatchSurfaces(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const patchesRoot = path.join(sourceRoot, 'patches');
    if (!fs.existsSync(patchesRoot)) return;

    for (const entry of readDir(patchesRoot)) {
      if (!entry.isFile() || !entry.name.endsWith('.patch')) continue;
      const relativePath = joinPath('patches', entry.name);
      discovered.push(this.filesystemSurface(
        'dependency_patch',
        relativePath,
        entry.name,
        'file',
        path.join(patchesRoot, entry.name),
      ));
    }
  }

  private scanGithubWorkflows(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const workflowsRoot = path.join(sourceRoot, '.github', 'workflows');
    if (!fs.existsSync(workflowsRoot)) return;

    for (const entry of readDir(workflowsRoot)) {
      if (!entry.isFile() || !/\.(ya?ml)$/i.test(entry.name)) continue;
      const relativePath = joinPath('.github/workflows', entry.name);
      discovered.push(this.filesystemSurface(
        'github_workflow',
        relativePath,
        entry.name,
        'file',
        path.join(workflowsRoot, entry.name),
      ));
    }
  }

  private scanRuntimeDependencies(sourceRoot: string, discovered: SourceDiscoveredSurface[]): void {
    const packageJsonPath = path.join(sourceRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return;

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJsonShape;
    const dependencyNames = new Set<string>();
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      const dependencies = packageJson[section] || {};
      for (const dependencyName of Object.keys(dependencies)) {
        if (TRACKED_RUNTIME_DEPENDENCIES.has(dependencyName)) {
          dependencyNames.add(dependencyName);
        }
      }
    }

    for (const dependencyName of Array.from(dependencyNames).sort()) {
      discovered.push({
        category: 'runtime_dependency',
        sourcePath: `package.json#${dependencyName}`,
        item: dependencyName,
        kind: 'package-dependency',
        source: 'package-json',
        evidence: ['files=1', 'dirs=0'],
        counts: {
          files: 1,
          dirs: 0,
        },
      });
    }
  }

  private filesystemSurface(
    category: SourceSurfaceCategory,
    sourcePath: string,
    item: string,
    kind: 'directory' | 'file',
    absolutePath: string,
  ): SourceDiscoveredSurface {
    const counts = kind === 'directory'
      ? countTree(absolutePath)
      : { files: 1, dirs: 0 };
    return {
      category,
      sourcePath: normalizePath(sourcePath),
      item,
      kind,
      source: 'filesystem',
      evidence: [`files=${counts.files}`, `dirs=${counts.dirs}`],
      counts,
    };
  }
}

function classifyScriptGroup(relativeScriptPath: string): ScriptGroup {
  const name = relativeScriptPath.toLowerCase();

  if (/docs|i18n|changelog|spellcheck|glossary|link-audit/.test(name)) return 'docs-i18n';
  if (/plugin|extension|bundled/.test(name)) return 'plugin-extension-ops';
  if (/docker|podman|k8s|sandbox|deploy|fly|render|container/.test(name)) return 'container-deploy-sandbox';
  if (/release|publish|package|prepack|appcast|dmg|codesign|notarize|sparkle/.test(name)) return 'release-package';
  if (/ios|mac|mobile|swift|android|native/.test(name)) return 'native-app-build';
  if (/auth|security|secret|credential|sbom|opengrep|ghsa|webhook-auth|temp-path/.test(name)) return 'security-auth';
  if (/claude|codex|acp|model|provider|gateway|bedrock|vertex|anthropic/.test(name)) return 'agent-provider-live';
  if (/test|qa|bench|perf|smoke|live|e2e|vitest/.test(name)) return 'test-qa-perf-live';
  if (/generate|build|tsdown|protocol|write-|copy-|sync-|stamp/.test(name)) return 'generation-build';
  if (/boundary|quality|lint|oxlint|topology|deadcode|cycle|architecture|deprecated|duplicates/.test(name)) return 'static-boundary-quality';
  return 'other';
}

function countTree(absolutePath: string): SourceSurfaceEvidenceCounts {
  let files = 0;
  let dirs = 0;
  const stack = [absolutePath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readDir(current)) {
      if (entry.isDirectory()) {
        if (RECURSIVE_COUNT_IGNORES.has(entry.name)) continue;
        dirs += 1;
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile()) {
        files += 1;
      }
    }
  }

  return { files, dirs };
}

function collectRelativeFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [''];

  while (stack.length > 0) {
    const currentRelative = stack.pop() || '';
    const currentAbsolute = path.join(root, currentRelative);
    for (const entry of readDir(currentAbsolute)) {
      if (entry.isDirectory()) {
        if (RECURSIVE_COUNT_IGNORES.has(entry.name)) continue;
        stack.push(path.join(currentRelative, entry.name));
      } else if (entry.isFile()) {
        files.push(normalizePath(path.join(currentRelative, entry.name)));
      }
    }
  }

  return files.sort();
}

function readDir(absolutePath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absolutePath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

function dedupeSurfaces(surfaces: SourceDiscoveredSurface[]): SourceDiscoveredSurface[] {
  const seen = new Map<string, SourceDiscoveredSurface>();
  for (const surface of surfaces) {
    seen.set(`${surface.category}:${surface.sourcePath}`, surface);
  }
  return Array.from(seen.values());
}

function sortSurfaces(surfaces: SourceDiscoveredSurface[]): SourceDiscoveredSurface[] {
  return surfaces.sort((left, right) => {
    const category = left.category.localeCompare(right.category);
    if (category !== 0) return category;
    return left.sourcePath.localeCompare(right.sourcePath);
  });
}

function joinPath(...parts: string[]): string {
  return normalizePath(path.join(...parts));
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
