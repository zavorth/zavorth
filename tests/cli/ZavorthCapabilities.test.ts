/**
 * Monorepo terminal capability registry and routing.
 */
import path from 'path';
import * as caps from '../../bin/lib/zavorth-capabilities.cjs';

describe('ZavorthCapabilities', () => {
  describe('resolveCapability', () => {
    it('hits native doctor and strips the command', () => {
      const r = caps.resolveCapability(['doctor', '--json']);
      expect(r.hit).toBe(true);
      if (r.hit) {
        expect(r.def.command).toBe('doctor');
        expect(r.def.strategy).toBe('native');
        expect(r.rest).toEqual(['--json']);
      }
    });

    it('maps aliases to canonical command', () => {
      const r = caps.resolveCapability(['diagnose']);
      expect(r.hit).toBe(true);
      if (r.hit) {
        expect(r.def.command).toBe('doctor');
      }
    });

    it('maps setup-health and models-providers clusters', () => {
      expect(caps.resolveCapability(['status']).hit).toBe(true);
      expect(caps.resolveCapability(['home']).hit).toBe(true);
      expect(caps.resolveCapability(['providers']).hit).toBe(true);
      expect(caps.resolveCapability(['models']).hit).toBe(true);
    });

    it('maps channels-memory and approvals-trust', () => {
      expect(caps.resolveCapability(['channels']).hit).toBe(true);
      expect(caps.resolveCapability(['memory']).hit).toBe(true);
      expect(caps.resolveCapability(['mnemos']).hit).toBe(true);
      expect(caps.resolveCapability(['approve']).hit).toBe(true);
      expect(caps.resolveCapability(['trust']).hit).toBe(true);
    });

    it('does not intercept coding-owned commands', () => {
      expect(caps.resolveCapability(['mcp']).hit).toBe(false);
      expect(caps.resolveCapability(['session']).hit).toBe(false);
      expect(caps.resolveCapability(['run']).hit).toBe(false);
      expect(caps.resolveCapability(['stats']).hit).toBe(false);
      expect(caps.resolveCapability(['acp']).hit).toBe(false);
    });

    it('does not intercept flags or empty argv', () => {
      expect(caps.resolveCapability([]).hit).toBe(false);
      expect(caps.resolveCapability(['--version']).hit).toBe(false);
      expect(caps.resolveCapability(['-h']).hit).toBe(false);
    });

    it('lists inventory with all required clusters', () => {
      const list = caps.listCapabilities();
      const clusters = new Set(list.map((d) => d.cluster));
      expect(clusters.has('setup-health')).toBe(true);
      expect(clusters.has('models-providers')).toBe(true);
      expect(clusters.has('channels-memory')).toBe(true);
      expect(clusters.has('approvals-trust')).toBe(true);
      expect(clusters.has('operator')).toBe(true);
      expect(list.some((d) => d.command === 'setup' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'doctor' && d.strategy === 'native')).toBe(true);
      expect(list.some((d) => d.command === 'providers' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'models' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'channels' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'approve' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'trust' && d.strategy === 'hybrid')).toBe(true);
      expect(list.some((d) => d.command === 'inspect' && d.strategy === 'hybrid')).toBe(true);
    });
  });

  describe('hybrid summary routing', () => {
    it('wantsNativeSummary only when no positional subcommand', () => {
      expect(caps.wantsNativeSummary([])).toBe(true);
      expect(caps.wantsNativeSummary(['--json'])).toBe(true);
      expect(caps.wantsNativeSummary(['--help'])).toBe(true);
      expect(caps.wantsNativeSummary(['add'])).toBe(false);
      expect(caps.wantsNativeSummary(['add', '--provider', 'openai'])).toBe(false);
      expect(caps.wantsNativeSummary(['list'])).toBe(false);
    });
  });

  describe('native health helpers', () => {
    it('collectHealthSnapshot reports product paths and routing posture', async () => {
      const root = path.resolve(__dirname, '../..');
      const snap = await caps.collectHealthSnapshot({
        projectRoot: root,
        env: {
          ...process.env,
          ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
          ZAVORTH_RUNTIME_SOURCE: 'workspace',
        },
      });
      expect(snap.projectRoot).toBe(root);
      expect(snap.checks.some((c) => c.id === 'code-tui')).toBe(true);
      expect(snap.checks.some((c) => c.id === 'gateway')).toBe(true);
      expect(snap.checks.some((c) => c.id === 'routing')).toBe(true);
      expect(snap.routing?.productHosted).toBe(true);
      expect(snap.routing?.openaiCompatibleRouted).toBe(true);
      expect(snap.routing?.anthropicRouted).toBe(true);
      expect(typeof snap.nextAction).toBe('string');
    }, 15000);

    it('wantsNativeForCommand covers inspect and providers list', () => {
      const inspect = caps.resolveCapability(['inspect']);
      expect(inspect.hit).toBe(true);
      if (inspect.hit) {
        expect(caps.wantsNativeForCommand(inspect.def, [])).toBe(true);
        expect(caps.wantsNativeForCommand(inspect.def, ['status'])).toBe(true);
      }
      const providers = caps.resolveCapability(['providers']);
      expect(providers.hit).toBe(true);
      if (providers.hit) {
        expect(caps.wantsNativeForCommand(providers.def, ['list'])).toBe(true);
        expect(caps.wantsNativeForCommand(providers.def, ['add'])).toBe(false);
      }
    });
  });

  describe('native providers / models / channels / trust summaries', () => {
    const root = path.resolve(__dirname, '../..');
    const env = {
      ...process.env,
      ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:9',
      OPENAI_API_KEY: 'sk-test-not-real',
      OPENAI_MODEL: 'gpt-test',
      TELEGRAM_BOT_TOKEN: 'tg-test-not-real',
    };

    it('collectProvidersSnapshot marks env-configured providers without leaking secrets', async () => {
      const snap = await caps.collectProvidersSnapshot({ projectRoot: root, env });
      expect(snap.providers.some((p) => p.id === 'openai' && p.configured)).toBe(true);
      const serialized = JSON.stringify(snap);
      expect(serialized).not.toContain('sk-test-not-real');
      expect(snap.nextSteps.length).toBeGreaterThan(0);
    });

    it('collectModelsSnapshot reads monorepo model config when present', async () => {
      const snap = await caps.collectModelsSnapshot({ projectRoot: root, env });
      expect(snap.envModels.some((m) => m.providerId === 'openai' && m.model === 'gpt-test')).toBe(
        true,
      );
      // monorepo ships runtime-model-specs.json
      expect(Array.isArray(snap.runtimeSpecs)).toBe(true);
    });

    it('collectChannelsSnapshot lists env readiness and manifests', () => {
      const snap = caps.collectChannelsSnapshot({ projectRoot: root, env });
      expect(snap.envChannels.some((c) => c.id === 'telegram' && c.envReady)).toBe(true);
      const serialized = JSON.stringify(snap);
      expect(serialized).not.toContain('tg-test-not-real');
    });

    it('collectApprovalsSnapshot returns control URL and non-negative pending', async () => {
      const snap = await caps.collectApprovalsSnapshot({ projectRoot: root, env });
      expect(snap.controlUrl).toContain('/control');
      expect(typeof snap.pendingEstimate).toBe('number');
      expect(snap.pendingEstimate).toBeGreaterThanOrEqual(0);
    });

    it('collectTrustSnapshot surfaces network / permission profiles', () => {
      const snap = caps.collectTrustSnapshot({ projectRoot: root, env });
      expect(snap.controlUrl).toContain('/control');
      // monorepo ships these configs
      expect(snap.networkPath || snap.permissionsPath).toBeTruthy();
    });

    it('executeCapability runs hybrid bare providers natively without exit', async () => {
      const code = await caps.executeCapability(
        { command: 'providers', cluster: 'models-providers', strategy: 'hybrid', summary: 't' },
        [],
        { projectRoot: root, env, exit: false },
      );
      expect(code).toBe(0);
    });

    it('executeCapability runs hybrid bare approve natively without exit', async () => {
      const code = await caps.executeCapability(
        { command: 'approve', cluster: 'approvals-trust', strategy: 'hybrid', summary: 't' },
        ['--json'],
        { projectRoot: root, env, exit: false },
      );
      expect(code).toBe(0);
    });
  });
});
