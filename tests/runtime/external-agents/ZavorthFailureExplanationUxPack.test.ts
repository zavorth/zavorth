import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  ZAVORTH_FAILURE_EXPLANATION_UX_PACK_RUNTIME_ID,
  createZavorthFailureExplanationUxPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import {
  allZavorthFailureKinds,
  buildZavorthFailureExplanation,
  formatZavorthFailureExplanation,
  renderZavorthFailureExplanation,
} from '../../../src/cli/ZavorthCliFailureExplanation.js';
import { formatZavorthGoFailure } from '../../../src/cli/ZavorthCliGoRenderer.js';

const DOC_284 = 'docs/284-zavorth-failure-explanation-ux-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthFailureExplanationUxPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const oldLower = ['bas', 'ilisk'].join('');
const oldTitle = ['Bas', 'ilisk'].join('');
const oldUpper = ['BAS', 'ILISK'].join('');
const oldIdentityPattern = new RegExp(`${oldTitle}|${oldLower}|${oldUpper}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-failure-ux-'));
}

function cleanup(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain(['_auth', 'Token'].join(''));
}

function assertHumanFailure(output: string): void {
  expect(output).toContain('Zavorth could not continue');
  expect(output).toContain('What happened:');
  expect(output).toContain('Likely cause:');
  expect(output).toContain('Next step:');
  expect(output).toContain('Try:');
  expect(output).toMatch(/Try: zavorth (doctor|setup|go --dry-run|setup --dry-run)/);
  expect(output).not.toMatch(/Error:\s*\n\s*at\s+/);
  expect(output).not.toMatch(/\bat\s+.+\.(ts|js):\d+:\d+/);
  expect(output).not.toMatch(oldIdentityPattern);
  assertNoRawSecret(output);
}

describe('Zavorth failure explanation UX pack', () => {
  const pack = createZavorthFailureExplanationUxPackFixture();

  it('exports the pack 284 boundary and final state', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFailureExplanationUxPack/v1');
    expect(index).toContain("from './ZavorthFailureExplanationUxPack.js'");
    expect(pack.normalization.packId).toBe('284');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_FAILURE_EXPLANATION_UX_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-failure-explanation-ux-ready');
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      stacktraceHiddenByDefault: true,
      publicOutputZavorthOnly: true,
      doctorIsRecoveryHub: true,
      setupDryRunStillNoWrite: true,
      runtimePersistentStartPerformed: false,
      npmPublishPerformed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('covers every mandatory failure category', () => {
    expect(pack.failureKinds()).toEqual([
      'missing-config',
      'runtime-not-running',
      'provider-not-configured',
      'permission-required',
      'policy-blocked',
      'timeout',
      'invalid-workspace',
      'non-interactive-terminal',
      'unexpected-error',
    ]);
    expect(allZavorthFailureKinds()).toEqual(pack.failureKinds());
    expect(pack.doctorIsRecoveryHub()).toBe(true);
  });

  it('builds and renders human explanations without stacktraces by default', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:18789');
    error.stack = 'Error: connect ECONNREFUSED\n    at shouldNotLeak (secret.ts:1:2)';
    const explanation = buildZavorthFailureExplanation({ error });
    const output = renderZavorthFailureExplanation(explanation);

    expect(explanation.kind).toBe('runtime-not-running');
    expect(explanation.stacktraceHiddenByDefault).toBe(true);
    expect(explanation.debugDetail).toBeNull();
    assertHumanFailure(output);
    expect(output).not.toContain('shouldNotLeak');
  });

  it('redacts secret-shaped text and routes provider gaps to setup', () => {
    const token = ['sk', 'proj', 'supersecretvalue1234567890'].join('-');
    const output = formatZavorthFailureExplanation({
      error: new Error(`provider api key missing ${token}`),
    });

    assertHumanFailure(output);
    expect(output).toContain('Try: zavorth setup');
    expect(output).toContain('[redacted]');
    expect(output).not.toContain(token);
  });

  it('renders go failures as actionable recovery output', () => {
    const output = formatZavorthGoFailure(new Error('runtime listener timeout'));

    assertHumanFailure(output);
    expect(output).toContain('Zavorth could not open the main entry point.');
    expect(output).toContain('Try: zavorth doctor');
  });

  it('keeps setup dry-run and JSON dry-run side-effect free', () => {
    const tempRoot = makeTempRoot();
    const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    try {
      const env = {
        ...process.env,
        ZAVORTH_FIRST_RUN_STORAGE_ROOT: tempRoot,
        NODE_ENV: 'test',
      };
      const dryRun = execFileSync(process.execPath, [tsxCli, 'scripts/setup-v3.ts', '--dry-run'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env,
      });
      const jsonOutput = execFileSync(process.execPath, [tsxCli, 'scripts/setup-v3.ts', '--json', '--dry-run'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env,
      });
      const parsed = JSON.parse(jsonOutput);
      const profilePath = path.join(tempRoot, 'data', 'runtime', 'first-run', 'profile.json');

      expect(dryRun).toContain('Dry-run: nenhuma mudanca sera gravada.');
      expect(parsed.dryRun).toBe(true);
      expect(parsed.safety.rawSecretSerialized).toBe(false);
      expect(fs.existsSync(profilePath)).toBe(false);
      expect(`${dryRun}\n${jsonOutput}`).not.toMatch(oldIdentityPattern);
      assertNoRawSecret(`${dryRun}\n${jsonOutput}`);
    } finally {
      cleanup(tempRoot);
    }
  });

  it('handles non-interactive setup without hanging and without writing profile files', () => {
    const tempRoot = makeTempRoot();
    const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    try {
      const output = execFileSync(process.execPath, [tsxCli, 'scripts/setup-v3.ts', '--non-interactive'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          ZAVORTH_FIRST_RUN_STORAGE_ROOT: tempRoot,
          NODE_ENV: 'test',
        },
      });
      const profilePath = path.join(tempRoot, 'data', 'runtime', 'first-run', 'profile.json');

      assertHumanFailure(output);
      expect(output).toContain('Try: zavorth setup --dry-run');
      expect(fs.existsSync(profilePath)).toBe(false);
    } finally {
      cleanup(tempRoot);
    }
  });

  it('documents the failure UX without blocked actions or unsafe identity leaks', () => {
    const doc = read(DOC_284);
    const serialized = JSON.stringify(pack.normalization);

    expect(doc).toContain('decision=zavorth-failure-explanation-ux-ready');
    expect(doc).toContain('What happened');
    expect(doc).toContain('Likely cause');
    expect(doc).toContain('Next step');
    expect(doc).toContain('zavorth doctor');
    expect(doc).not.toMatch(oldIdentityPattern);
    expect(serialized).not.toMatch(oldIdentityPattern);
    assertNoRawSecret(`${doc}\n${serialized}`);
  });
});
