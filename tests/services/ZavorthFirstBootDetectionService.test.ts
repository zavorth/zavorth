import { describe, it, expect } from '@jest/globals';

import {
  ZavorthFirstBootDetectionService,
  type FirstBootSnapshot,
  type WorkspaceHint,
} from '../../src/services/ZavorthFirstBootDetectionService.js';

// Helpers

function emptyEnv(): Record<string, string | undefined> {
  return {};
}

function fakeExistsSync(existing: string[]): (p: string) => boolean {
  return (p: string) => existing.some((e) => p.endsWith(e) || p === e);
}

function fakeNow(): () => Date {
  return () => new Date('2026-06-24T05:00:00.000Z');
}

function fakeDoctorReady(providerName = 'openai', modelName = 'gpt-4o') {
  return {
    inspect: () => ({
      activeProviderName: providerName,
      activeModelName: modelName,
      readyProviders: [{ id: providerName, readiness: 'ready' }],
      pendingConfigProviders: [],
      probeProviders: [],
    }),
  };
}

function fakeDoctorEmpty() {
  return {
    inspect: () => ({
      activeProviderName: '',
      activeModelName: '',
      readyProviders: [],
      pendingConfigProviders: [],
      probeProviders: [],
    }),
  };
}

function fakeDoctorThrows() {
  return {
    inspect: () => {
      throw new Error('doctor unavailable');
    },
  };
}

// detect() status tests

describe('ZavorthFirstBootDetectionService', () => {
  describe('detect()', () => {
    it('returns "fresh" when no env vars, no DB, no provider ready', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('fresh');
      expect(snapshot.detectedProviders).toEqual([]);
      expect(snapshot.activeProvider).toBeNull();
      expect(snapshot.activeModel).toBeNull();
      expect(snapshot.dbExists).toBe(false);
      expect(snapshot.generatedAt).toBe('2026-06-24T05:00:00.000Z');
    });

    it('returns "env_detected" when OPENAI_API_KEY is set', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'sk-test1234567890abcdef' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('env_detected');
      expect(snapshot.detectedProviders).toHaveLength(1);
      expect(snapshot.detectedProviders[0]).toEqual(
        expect.objectContaining({
          id: 'openai',
          name: 'OpenAI',
          envVar: 'OPENAI_API_KEY',
          type: 'openai',
        }),
      );
      expect(snapshot.activeProvider).toBeNull();
      expect(snapshot.activeModel).toBeNull();
    });

    it('returns "env_detected" when ANTHROPIC_API_KEY is set', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { ANTHROPIC_API_KEY: 'sk-ant-xxxx9999' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('env_detected');
      expect(snapshot.detectedProviders[0].type).toBe('anthropic');
    });

    it('returns "env_detected" when multiple env vars are set', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: {
          OPENAI_API_KEY: 'sk-test1234',
          GOOGLE_API_KEY: 'AIzaSyAbcdef',
          OPENROUTER_API_KEY: 'or-key-5678',
        },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('env_detected');
      expect(snapshot.detectedProviders).toHaveLength(3);
      const ids = snapshot.detectedProviders.map((p) => p.id);
      expect(ids).toContain('openai');
      expect(ids).toContain('google');
      expect(ids).toContain('openrouter');
    });

    it('returns "ready" when providerDoctor reports ready providers', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'sk-test1234567890abcdef' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorReady('openai', 'gpt-4o'),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('ready');
      expect(snapshot.activeProvider).toBe('openai');
      expect(snapshot.activeModel).toBe('gpt-4o');
    });

    it('returns "needs_provider" when DB exists but no ready providers and no env vars', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync(['zavorth.db']),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('needs_provider');
      expect(snapshot.dbExists).toBe(true);
      expect(snapshot.detectedProviders).toEqual([]);
    });

    it('falls back to heuristic detection when providerDoctor.inspect() throws', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { ANTHROPIC_API_KEY: 'sk-ant-abcd1234' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorThrows(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('env_detected');
      expect(snapshot.detectedProviders).toHaveLength(1);
    });

    it('returns "fresh" when providerDoctor is not provided', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/fake/dir',
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('fresh');
    });

    it('ignores empty or whitespace-only env var values', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: '   ', ANTHROPIC_API_KEY: '' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.status).toBe('fresh');
      expect(snapshot.detectedProviders).toEqual([]);
    });
  });

  // API key masking

  describe('API key masking', () => {
    it('masks API keys showing only last 4 chars', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'sk-test1234567890abcdef' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.detectedProviders[0].maskedValue).toBe('...cdef');
    });

    it('masks short keys with fallback pattern', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'ab' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.detectedProviders[0].maskedValue).toBe('...****');
    });

    it('masks exactly 4-char keys with fallback pattern', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'abcd' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.detectedProviders[0].maskedValue).toBe('...****');
    });

    it('masks 5+ char keys showing last 4', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: { OPENAI_API_KEY: 'abcde' },
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.detectedProviders[0].maskedValue).toBe('...bcde');
    });
  });

  // detectWorkspace()

  describe('detectWorkspace()', () => {
    it('returns nodejs when package.json exists', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/node-app',
        existsSync: fakeExistsSync(['package.json']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('nodejs');
      expect(hint.suggestedMission).toBe('Analise este projeto Node.js e resuma sua estrutura');
      expect(hint.readOnly).toBe(true);
    });

    it('returns python when pyproject.toml exists', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/py-app',
        existsSync: fakeExistsSync(['pyproject.toml']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('python');
      expect(hint.suggestedMission).toContain('Python');
      expect(hint.readOnly).toBe(true);
    });

    it('returns python when requirements.txt exists', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/py-app',
        existsSync: fakeExistsSync(['requirements.txt']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('python');
      expect(hint.readOnly).toBe(true);
    });

    it('returns git_repo when .git directory exists', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/some-repo',
        existsSync: fakeExistsSync(['.git']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('git_repo');
      expect(hint.suggestedMission).toContain('commits');
      expect(hint.readOnly).toBe(true);
    });

    it('returns docs_only when README.md exists', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/docs',
        existsSync: fakeExistsSync(['README.md']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('docs_only');
      expect(hint.suggestedMission).toContain('documentaction');
      expect(hint.readOnly).toBe(true);
    });

    it('returns unknown when no known files exist', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/empty',
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('unknown');
      expect(hint.suggestedMission).toContain('Explore');
      expect(hint.readOnly).toBe(true);
    });

    it('prefers nodejs over git_repo when both exist', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/full',
        existsSync: fakeExistsSync(['package.json', '.git', 'README.md']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('nodejs');
    });

    it('prefers python over git_repo when both exist', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/full',
        existsSync: fakeExistsSync(['pyproject.toml', '.git']),
        now: fakeNow(),
      });

      const hint = service.detectWorkspace();

      expect(hint.type).toBe('python');
    });
  });

  // WorkspaceHint readOnly invariant

  describe('WorkspaceHint readOnly invariant', () => {
    const cases: Array<{ files: string[]; expectedType: WorkspaceHint['type'] }> = [
      { files: ['package.json'], expectedType: 'nodejs' },
      { files: ['pyproject.toml'], expectedType: 'python' },
      { files: ['requirements.txt'], expectedType: 'python' },
      { files: ['.git'], expectedType: 'git_repo' },
      { files: ['README.md'], expectedType: 'docs_only' },
      { files: [], expectedType: 'unknown' },
    ];

    for (const { files, expectedType } of cases) {
      it(`readOnly is true for type "${expectedType}"`, () => {
        const service = new ZavorthFirstBootDetectionService({
          env: emptyEnv(),
          cwd: '/any',
          existsSync: fakeExistsSync(files),
          now: fakeNow(),
        });

        const hint = service.detectWorkspace();

        expect(hint.readOnly).toBe(true);
      });
    }
  });

  // Env-var → provider type mapping

  describe('env var to provider type mapping', () => {
    const mappings: Array<{ envVar: string; expectedType: string; expectedId: string }> = [
      { envVar: 'OPENAI_API_KEY', expectedType: 'openai', expectedId: 'openai' },
      { envVar: 'ANTHROPIC_API_KEY', expectedType: 'anthropic', expectedId: 'anthropic' },
      { envVar: 'GOOGLE_API_KEY', expectedType: 'google', expectedId: 'google' },
      { envVar: 'GOOGLE_GENERATIVE_AI_API_KEY', expectedType: 'google', expectedId: 'google-genai' },
      { envVar: 'GROQ_API_KEY', expectedType: 'openai-compatible', expectedId: 'groq' },
      { envVar: 'MISTRAL_API_KEY', expectedType: 'openai-compatible', expectedId: 'mistral' },
      { envVar: 'OPENROUTER_API_KEY', expectedType: 'openrouter', expectedId: 'openrouter' },
    ];

    for (const { envVar, expectedType, expectedId } of mappings) {
      it(`maps ${envVar} to type "${expectedType}" with id "${expectedId}"`, () => {
        const service = new ZavorthFirstBootDetectionService({
          env: { [envVar]: 'test-key-value-12345' },
          cwd: '/fake/dir',
          providerDoctor: fakeDoctorEmpty(),
          existsSync: fakeExistsSync([]),
          now: fakeNow(),
        });

        const snapshot = service.detect();

        expect(snapshot.detectedProviders).toHaveLength(1);
        expect(snapshot.detectedProviders[0].type).toBe(expectedType);
        expect(snapshot.detectedProviders[0].id).toBe(expectedId);
      });
    }
  });

  // Snapshot shape

  describe('snapshot shape', () => {
    it('includes all required fields', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/fake/dir',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync([]),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot).toHaveProperty('status');
      expect(snapshot).toHaveProperty('generatedAt');
      expect(snapshot).toHaveProperty('detectedProviders');
      expect(snapshot).toHaveProperty('activeProvider');
      expect(snapshot).toHaveProperty('activeModel');
      expect(snapshot).toHaveProperty('workspace');
      expect(snapshot).toHaveProperty('dbExists');
    });

    it('workspace is embedded in the snapshot', () => {
      const service = new ZavorthFirstBootDetectionService({
        env: emptyEnv(),
        cwd: '/project/node-app',
        providerDoctor: fakeDoctorEmpty(),
        existsSync: fakeExistsSync(['package.json']),
        now: fakeNow(),
      });

      const snapshot = service.detect();

      expect(snapshot.workspace.type).toBe('nodejs');
      expect(snapshot.workspace.readOnly).toBe(true);
    });
  });
});
