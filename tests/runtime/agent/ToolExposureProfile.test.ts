import {
  DAILY_OPS_MAX_EXPOSED_TOOLS,
  DAILY_OPS_PREFERRED_TOOLS,
  FULL_MAX_EXPOSED_TOOLS,
  SAFE_ALWAYS_EXPOSE_TOOLS,
  SAFE_MAX_EXPOSED_TOOLS,
  isDailyOpsPreferredTool,
  isDestructiveExposureTool,
  isFullProfileSecurityExposable,
  isProfileAlwaysExpose,
  isSafePluginObservationTool,
  rankingBoostForProfile,
  resolveExposureProfile,
  resolveExposureProfileName,
  resolveMaxExposedTools,
} from '../../../src/runtime/agent/tools/ToolExposureProfile.js';

describe('ToolExposureProfile', () => {
  describe('resolveMaxExposedTools', () => {
    it('returns safe/daily-ops/full max caps', () => {
      expect(resolveMaxExposedTools('safe')).toBe(SAFE_MAX_EXPOSED_TOOLS);
      expect(resolveMaxExposedTools('safe')).toBe(12);
      expect(resolveMaxExposedTools('daily-ops')).toBe(DAILY_OPS_MAX_EXPOSED_TOOLS);
      expect(resolveMaxExposedTools('daily-ops')).toBe(24);
      expect(resolveMaxExposedTools('full')).toBe(FULL_MAX_EXPOSED_TOOLS);
      expect(resolveMaxExposedTools('full')).toBe(40);
    });
  });

  describe('resolveExposureProfileName / resolveExposureProfile', () => {
    it('defaults to safe when unset', () => {
      expect(resolveExposureProfileName()).toBe('safe');
      expect(resolveExposureProfileName({ envValue: '' })).toBe('safe');
      expect(resolveExposureProfileName({ envValue: undefined })).toBe('safe');
    });

    it('reads env ZAVORTH_TOOL_EXPOSURE_PROFILE aliases', () => {
      expect(resolveExposureProfileName({ envValue: 'daily-ops' })).toBe('daily-ops');
      expect(resolveExposureProfileName({ envValue: 'daily_ops' })).toBe('daily-ops');
      expect(resolveExposureProfileName({ envValue: 'FULL' })).toBe('full');
      expect(resolveExposureProfileName({ envValue: 'safe-12' })).toBe('safe');
    });

    it('prefers request metadata over run metadata over env', () => {
      expect(resolveExposureProfileName({
        requestMetadata: { toolExposureProfile: 'full' },
        runMetadata: { toolExposureProfile: 'daily-ops' },
        envValue: 'safe',
      })).toBe('full');

      expect(resolveExposureProfileName({
        runMetadata: { exposureProfile: 'daily-ops' },
        envValue: 'safe',
      })).toBe('daily-ops');

      expect(resolveExposureProfile({
        request: { metadata: { toolExposureProfile: 'daily-ops' } },
        run: { metadata: { toolExposureProfile: 'full' } },
        envValue: 'safe',
      })).toBe('daily-ops');
    });
  });

  describe('isProfileAlwaysExpose membership', () => {
    it('safe profile only force-exposes the baseline always-safe set', () => {
      for (const name of SAFE_ALWAYS_EXPOSE_TOOLS) {
        expect(isProfileAlwaysExpose('safe', name)).toBe(true);
      }
      expect(isProfileAlwaysExpose('safe', 'web_search')).toBe(false);
      expect(isProfileAlwaysExpose('safe', 'doctor_run')).toBe(false);
      expect(isProfileAlwaysExpose('safe', 'plugin.github.status')).toBe(false);
    });

    it('daily-ops always-exposes preferred tools and safe plugin observation names', () => {
      expect(isProfileAlwaysExpose('daily-ops', 'read_file')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'web_search')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'doctor_run')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'pr_ship_draft')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'memory_search')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'cost_summary')).toBe(true);
      // W7 product surface
      expect(isProfileAlwaysExpose('daily-ops', 'zavorth_skill_marketplace')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'agent_manager')).toBe(true);
      expect(isDailyOpsPreferredTool('zavorth_skill_marketplace')).toBe(true);
      expect(isDailyOpsPreferredTool('agent_manager')).toBe(true);
      expect(isDailyOpsPreferredTool('zavorth_delegate')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'plugin.marketplace.status')).toBe(true);
      expect(isProfileAlwaysExpose('daily-ops', 'plugin.os.recommend')).toBe(true);
      // Destructive / create paths stay out of always-expose.
      expect(isProfileAlwaysExpose('daily-ops', 'pr_ship_create')).toBe(false);
      expect(isProfileAlwaysExpose('daily-ops', 'bash_unsafe')).toBe(false);
    });

    it('full profile inherits daily-ops always-expose membership', () => {
      expect(isProfileAlwaysExpose('full', 'ci_status')).toBe(true);
      expect(isProfileAlwaysExpose('full', 'github_pr_list')).toBe(true);
      expect(isProfileAlwaysExpose('full', 'zavorth_tool_catalog')).toBe(true);
    });

    it('covers core daily-ops preferred membership set', () => {
      const required = [
        'read_file',
        'list_directory',
        'plugin_recommend',
        'zavorth_skill_marketplace',
        'agent_manager',
        'zavorth_delegate',
        'search_query',
        'doctor_env',
        'security_scan',
        'secrets_scan',
        'github_status',
        'pr_ship_status',
        'ci_latest',
        'task_list',
        'memory_get',
        'recall_recent',
        'session_search',
      ];
      for (const name of required) {
        expect(DAILY_OPS_PREFERRED_TOOLS.has(name)).toBe(true);
        expect(isDailyOpsPreferredTool(name)).toBe(true);
        expect(isProfileAlwaysExpose('daily-ops', name)).toBe(true);
      }
    });
  });

  describe('plugin observation + destructive helpers', () => {
    it('classifies safe plugin.* observation tools', () => {
      expect(isSafePluginObservationTool('plugin.foo.status')).toBe(true);
      expect(isSafePluginObservationTool('plugin.bar.list')).toBe(true);
      expect(isSafePluginObservationTool('plugin.search')).toBe(true);
      expect(isSafePluginObservationTool('plugin.scan.workspace')).toBe(true);
      expect(isSafePluginObservationTool('plugin.doctor')).toBe(true);
      expect(isSafePluginObservationTool('plugin.foo.apply')).toBe(false);
      expect(isSafePluginObservationTool('plugin_recommend')).toBe(false);
    });

    it('flags destructive exposure tools', () => {
      expect(isDestructiveExposureTool('rm')).toBe(true);
      expect(isDestructiveExposureTool('bash_unsafe')).toBe(true);
      expect(isDestructiveExposureTool('shell.exec')).toBe(true);
      expect(isDestructiveExposureTool('send_email')).toBe(true);
      expect(isDestructiveExposureTool('forge.apply')).toBe(true);
      expect(isDestructiveExposureTool('plugin.forge.apply')).toBe(true);
      expect(isDestructiveExposureTool('pr_ship_create')).toBe(true);
      expect(isDestructiveExposureTool('read_file')).toBe(false);
      expect(isDestructiveExposureTool('pr_ship_draft')).toBe(false);
    });
  });

  describe('full profile security exposable + ranking boost', () => {
    it('allows safe/review without confirmation; blocks confirmation and danger', () => {
      expect(isFullProfileSecurityExposable({
        toolName: 'code_review',
        defaultRisk: 'safe',
        requiresConfirmation: false,
      })).toBe(true);
      expect(isFullProfileSecurityExposable({
        toolName: 'soft_review_tool',
        defaultRisk: 'review',
        requiresConfirmation: false,
      })).toBe(true);
      expect(isFullProfileSecurityExposable({
        toolName: 'workspace.write',
        defaultRisk: 'review',
        requiresConfirmation: true,
      })).toBe(false);
      expect(isFullProfileSecurityExposable({
        toolName: 'send_email',
        defaultRisk: 'dangerous',
        requiresConfirmation: true,
      })).toBe(false);
      expect(isFullProfileSecurityExposable({
        toolName: 'unknown_tool',
        defaultRisk: null,
        requiresConfirmation: null,
      })).toBe(false);
    });

    it('boosts daily-ops preferred tools for daily-ops/full ranking only', () => {
      expect(rankingBoostForProfile('safe', 'doctor_run')).toBe(0);
      expect(rankingBoostForProfile('daily-ops', 'doctor_run')).toBeGreaterThan(0);
      expect(rankingBoostForProfile('full', 'web_search')).toBeGreaterThan(0);
      expect(rankingBoostForProfile('daily-ops', 'totally_unknown_tool_xyz')).toBe(0);
    });
  });
});
