import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveZavorthCodeCliLaunch } from '../../src/cli/ZavorthCodeCliDispatcher.js';

const monorepoRoot = path.resolve(__dirname, '../..');
const monorepoIndex = path.join(
  monorepoRoot,
  'packages',
  'zavorth-code',
  'cli',
  'src',
  'index.ts',
);
const codeCliCwd = path.join(monorepoRoot, 'packages', 'zavorth-code', 'cli');

describe('ZavorthCodeCliDispatcher', () => {
  describe('resolveZavorthCodeCliLaunch', () => {
    it('uses ZAVORTH_CODE_BIN override as spawn command with user args', () => {
      const plan = resolveZavorthCodeCliLaunch({
        projectRoot: monorepoRoot,
        args: ['--version'],
        env: { ZAVORTH_CODE_BIN: '/custom/zavorth-code' },
        whichCommand: () => null,
        platform: 'linux',
        cwd: monorepoRoot,
      });

      expect(plan.kind).toBe('spawn');
      if (plan.kind === 'spawn') {
        expect(plan.command).toBe('/custom/zavorth-code');
        expect(plan.args).toEqual(['--version']);
        expect(plan.cwd).toBe(monorepoRoot);
        expect(plan.label).toContain('ZAVORTH_CODE_BIN');
      }
    });

    it('prefers monorepo Bun entry when index.ts exists and bun is available', () => {
      if (!fs.existsSync(monorepoIndex)) {
        // Monorepo tree not synced; skip rather than false-fail CI without code packages.
        return;
      }

      const plan = resolveZavorthCodeCliLaunch({
        projectRoot: monorepoRoot,
        args: ['run', 'foo'],
        env: {},
        whichCommand: (name) => (name === 'bun' || name.startsWith('bun') ? '/usr/local/bin/bun' : null),
        platform: 'linux',
        cwd: monorepoRoot,
      });

      expect(plan.kind).toBe('spawn');
      if (plan.kind === 'spawn') {
        expect(plan.command).toBe('/usr/local/bin/bun');
        expect(plan.args).toEqual([
          'run',
          '--conditions=browser',
          'src/index.ts',
          'run',
          'foo',
        ]);
        expect(path.normalize(plan.cwd)).toBe(path.normalize(codeCliCwd));
        expect(plan.cwd.replace(/\\/g, '/')).toMatch(/packages\/zavorth-code\/cli$/);
        expect(plan.label.toLowerCase()).toContain('bun');
      }
    });

    it('returns missing with code:sync/code:install hints when no override, empty root, and no PATH bin', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-code-dispatch-'));
      try {
        const plan = resolveZavorthCodeCliLaunch({
          projectRoot: tempRoot,
          args: ['--version'],
          env: {},
          whichCommand: () => null,
          platform: 'linux',
          cwd: tempRoot,
        });

        expect(plan.kind).toBe('missing');
        if (plan.kind === 'missing') {
          expect(plan.message.length).toBeGreaterThan(0);
          const hintsJoined = plan.hints.join('\n');
          expect(hintsJoined).toMatch(/code:sync|code:install/);
          expect(plan.hints.some((h) => /code:sync|code:install/.test(h))).toBe(true);
        }
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it('preserves args passthrough for --version and nested run', () => {
      const versionPlan = resolveZavorthCodeCliLaunch({
        projectRoot: monorepoRoot,
        args: ['--version'],
        env: { ZAVORTH_CODE_BIN: 'C:\\tools\\zavorth-code.exe' },
        whichCommand: () => null,
        platform: 'win32',
        cwd: monorepoRoot,
      });

      expect(versionPlan.kind).toBe('spawn');
      if (versionPlan.kind === 'spawn') {
        expect(versionPlan.args).toEqual(['--version']);
      }

      const runPlan = resolveZavorthCodeCliLaunch({
        projectRoot: monorepoRoot,
        args: ['run', 'foo'],
        env: { ZAVORTH_CODE_BIN: 'C:\\tools\\zavorth-code.exe' },
        whichCommand: () => null,
        platform: 'win32',
        cwd: monorepoRoot,
      });

      expect(runPlan.kind).toBe('spawn');
      if (runPlan.kind === 'spawn') {
        expect(runPlan.args).toEqual(['run', 'foo']);
      }
    });

    it('falls back to PATH zavorth-code when monorepo index is absent', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-code-dispatch-path-'));
      try {
        const plan = resolveZavorthCodeCliLaunch({
          projectRoot: tempRoot,
          args: ['status'],
          env: {},
          whichCommand: (name) =>
            name === 'zavorth-code' || name.startsWith('zavorth-code') ? '/opt/bin/zavorth-code'
              : null,
          platform: 'linux',
          cwd: tempRoot,
        });

        expect(plan.kind).toBe('spawn');
        if (plan.kind === 'spawn') {
          expect(plan.command).toBe('/opt/bin/zavorth-code');
          expect(plan.args).toEqual(['status']);
          expect(plan.label).toContain('PATH');
        }
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });
  });
});
