/**
 * Wave 1 hygiene contract: canonical npm script gates must exist, every script
 * invoked by automation surfaces (CI, hooks, process files) must resolve, and
 * deprecated entries must stay quarantined in the legacy manifest instead of
 * silently returning to package.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../');
const SCRIPT_REFERENCE_PATTERN = /\b(?:npm|pnpm|yarn|bun)\s+run\s+([a-zA-Z0-9][a-zA-Z0-9:_-]*)/g;
const CANONICAL_GATES = ['check', 'typecheck', 'build', 'dev', 'test', 'lint'];

const AUTOMATION_TARGETS = [
  '.github',
  '.githooks',
  'Procfile',
  'Dockerfile',
  'zavorth.yml',
].map((target) => path.join(root, target));

/**
 * Workflow steps may resolve scripts against a workspace package instead of the
 * repository root (working-directory), so an invocation counts as resolved when
 * any package manifest in the monorepo exposes it.
 */
function collectWorkspaceScriptNames(): Set<string> {
  const names = new Set<string>();
  const manifests = [
    path.join(root, 'package.json'),
    ...collectFilesRecursively(path.join(root, 'packages')).filter((file) => file.endsWith('package.json')),
  ];
  for (const manifestPath of manifests) {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { scripts?: Record<string, string> };
    for (const scriptName of Object.keys(parsed.scripts ?? {})) {
      names.add(scriptName);
    }
  }
  return names;
}

function collectFilesRecursively(absolutePath: string): string[] {
  if (!fs.existsSync(absolutePath)) return [];
  if (fs.statSync(absolutePath).isFile()) return [absolutePath];
  const files: string[] = [];
  const pending = [absolutePath];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else files.push(fullPath);
    }
  }
  return files;
}

function isFilePathInvocation(content: string, matchEnd: number): boolean {
  return content[matchEnd] === '/';
}

function extractScriptReferences(targets: string[]): Map<string, string[]> {
  const referencesToFilePaths = new Map<string, string[]>();
  for (const targetPath of targets) {
    for (const filePath of collectFilesRecursively(targetPath)) {
      const executableLines = fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n');
      for (const match of executableLines.matchAll(SCRIPT_REFERENCE_PATTERN)) {
        if (isFilePathInvocation(executableLines, match.index + match[0].length)) continue;
        const knownPaths = referencesToFilePaths.get(match[1]) ?? [];
        knownPaths.push(path.relative(root, filePath));
        referencesToFilePaths.set(match[1], knownPaths);
      }
    }
  }
  return referencesToFilePaths;
}

describe('PackageScriptsContractHygiene', () => {
  const packageJsonPath = path.join(root, 'package.json');
  const manifestPath = path.join(root, 'scripts', 'legacy', 'deprecated-package-scripts.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts: Record<string, string> };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    manifestVersion: number;
    reason: string;
    removedCount: number;
    scripts: Record<string, string>;
  };

  it('exposes the canonical verification and lifecycle gates', () => {
    for (const gate of CANONICAL_GATES) {
      expect(pkg.scripts[gate]).toBeDefined();
    }
    expect(pkg.scripts.check).toContain('runtime:check');
    expect(pkg.scripts.typecheck).toContain('runtime:check');
  });

  it('resolves every script invoked by automation surfaces', () => {
    const workspaceScripts = collectWorkspaceScriptNames();
    const missing: string[] = [];
    for (const [scriptName, filePaths] of extractScriptReferences(AUTOMATION_TARGETS)) {
      if (pkg.scripts[scriptName] === undefined && !workspaceScripts.has(scriptName)) {
        missing.push(`${scriptName} <- ${[...new Set(filePaths)].slice(0, 3).join(', ')}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('resolves every script-to-script reference inside package.json', () => {
    const dangling: string[] = [];
    for (const [scriptName, command] of Object.entries(pkg.scripts)) {
      for (const match of command.matchAll(SCRIPT_REFERENCE_PATTERN)) {
        if (pkg.scripts[match[1]] === undefined) {
          dangling.push(`${scriptName} -> ${match[1]}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('keeps deprecated scripts quarantined in the legacy manifest', () => {
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.reason.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.scripts).length).toBe(manifest.removedCount);

    const resurrected = Object.keys(manifest.scripts).filter((name) => pkg.scripts[name] !== undefined);
    expect(resurrected).toEqual([]);
  });

  it(
    'never quarantines scripts referenced by source or test literals',
    () => {
      const escapedNames = Object.keys(manifest.scripts).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const anyNameLiteral = new RegExp(`['"](${escapedNames.join('|')})['"]`);
      const offenders: string[] = [];
      for (const directory of ['src', 'tests', 'scripts']) {
        for (const filePath of collectFilesRecursively(path.join(root, directory))) {
          if (!/\.(ts|tsx|mjs)$/.test(filePath)) continue;
          if (filePath.includes(`${path.sep}legacy${path.sep}`)) continue;
          const content = fs.readFileSync(filePath, 'utf8');
          const found = content.match(anyNameLiteral);
          if (found) offenders.push(`${found[1]} <- ${path.relative(root, filePath)}`);
        }
      }
      expect(offenders).toEqual([]);
    },
    120_000,
  );
});
