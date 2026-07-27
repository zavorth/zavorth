import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  firstArg,
  readFlag,
  stateDir,
  readArray,
  readJson,
  writeJson,
  appendJsonArray,
  idWithTime,
  runProcess,
  render,
  isInside,
} from '../ZavorthCliSharedHelpers.js';
import { idFromSpec, resolveNpmCommand } from '../ZavorthCliLiveNamespaces.js';
import { PluginStateBridgeService } from '../../services/PluginStateBridgeService.js';
import { PluginDiscoveryService } from '../../services/PluginDiscoveryService.js';
import { PluginDevService, formatSnapshotText } from '../../services/PluginDevService.js';
import { PluginUrlInstallService } from '../../services/PluginUrlInstallService.js';
import { PluginTestHarnessService } from '../../services/PluginTestHarnessService.js';
import { PluginOsControlPlaneService } from '../../services/PluginOsControlPlaneService.js';
import { PluginSignatureService } from '../../services/PluginSignatureService.js';
import { PluginNewService } from '../../services/PluginNewService.js';
import { PluginRouterService } from '../../services/PluginRouterService.js';
import { PluginForgeService } from '../../services/PluginForgeService.js';
import { PluginMcpBridgeService } from '../../services/PluginMcpBridgeService.js';
import { PluginCuratedMarketplaceService } from '../../services/PluginCuratedMarketplaceService.js';
import { PluginOsMarketplaceService } from '../../services/PluginOsMarketplaceService.js';
import { PluginOsObservabilityService } from '../../services/PluginOsObservabilityService.js';
import { PluginOsAgentSurfaceService } from '../../services/PluginOsAgentSurfaceService.js';
import { PluginOsTelemetryService } from '../../services/PluginOsTelemetryService.js';
import { PluginOsOnboardingService } from '../../services/PluginOsOnboardingService.js';
import { PluginOsOnboardingWizardService } from '../../services/PluginOsOnboardingWizardService.js';
import { PluginOsPromptInjectionService } from '../../services/PluginOsPromptInjectionService.js';
import { PluginOsSuggestService } from '../../services/PluginOsSuggestService.js';
import { PluginOsReceiptTimelineService } from '../../services/PluginOsReceiptTimelineService.js';
import { PluginOsPermissionPreviewService } from '../../services/PluginOsPermissionPreviewService.js';
import {
  buildPluginRecord,
  calculatePluginChecksum,
  doctorPlugin,
  findPlugin,
  isLocalPluginSpec,
  normalizePermissions,
  pluginPermissionLines,
  pluginSandboxForPermissions,
  resolvePluginPath,
  resolveScaffoldOptions,
  runPluginHook,
  sanitizePluginRecord,
  scaffoldPlugin,
  writePluginRuntimeState,
} from './ZavorthCliPluginsHelpers.js';
import { PLUGIN_HELP_LINES } from './ZavorthCliPluginsHelp.js';
type JsonObject = Record<string, unknown>;

export async function runPlugins(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const pkg = (await readJson(path.join(root, 'package.json'), {})) as JsonObject;
  const deps = Object.keys({
    ...((pkg.dependencies as JsonObject) || {}),
    ...((pkg.devDependencies as JsonObject) || {}),
  });
  const pluginFile = path.join(stateDir(root), 'plugins.json');
  const local = await readArray(pluginFile);
  const runtimeFile = path.join(stateDir(root), 'plugins-runtime.json');
  const bridge = new PluginStateBridgeService({ projectRoot: root });

  if (action === 'help' || action === '--help' || action === '-h') {
    return render(args, 'Zavorth plugins', PLUGIN_HELP_LINES, { ok: true, commands: PLUGIN_HELP_LINES });
  }

  if (action === 'plane' || action === 'status') {
    const plane = new PluginOsControlPlaneService({ projectRoot: root, stateBridge: bridge });
    const snapshot = plane.buildSnapshot(root);
    return render(args, 'Zavorth plugin control plane', plane.formatSnapshotText(snapshot).split('\n'), {
      ok: true,
      snapshot,
    });
  }

  if (action === 'metrics') {
    const observability = new PluginOsObservabilityService({ projectRoot: root, stateBridge: bridge });
    const persist = args.includes('--persist') || args.includes('--write');
    if (persist) {
      const written = observability.persistSnapshot(root);
      return render(
        args,
        'Zavorth plugin metrics',
        [
          ...written.snapshot.formatText().split('\n'),
          written.path ? `persisted: ${written.path}` : 'persist soft-failed',
        ],
        {
          ok: written.ok,
          metrics: written.snapshot,
          path: written.path,
        },
      );
    }
    const metrics = observability.buildSnapshot(root);
    return render(args, 'Zavorth plugin metrics', metrics.formatText().split('\n'), {
      ok: true,
      metrics,
    });
  }

  if (action === 'agent-surface' || action === 'surface') {
    const surface = new PluginOsAgentSurfaceService({ projectRoot: root, stateBridge: bridge }).buildSurface({ root });
    const wantInject = args.includes('--inject') || args.includes('--prompt');
    if (wantInject) {
      const injection = new PluginOsPromptInjectionService({ projectRoot: root }).buildInjection({
        root,
        recordTelemetry: true,
      });
      return render(
        args,
        'Zavorth plugin agent surface (inject)',
        [`injected=${injection.injected} reason=${injection.reason}`, injection.block || '(empty)'],
        {
          ok: injection.injected,
          injection,
          surface: {
            generatedAt: surface.generatedAt,
            health: surface.health,
            promptBlock: surface.promptBlock,
          },
        },
      );
    }
    return render(args, 'Zavorth plugin agent surface', surface.formatText().split('\n'), {
      ok: true,
      surface: {
        generatedAt: surface.generatedAt,
        health: surface.health,
        enabledPluginIds: surface.enabledPluginIds,
        firstPartyCatalog: surface.firstPartyCatalog,
        recommendHints: surface.recommendHints,
        promptBlock: surface.promptBlock,
        deepLinks: surface.deepLinks,
      },
    });
  }

  if (action === 'telemetry') {
    const sub = String(args[1] || '')
      .trim()
      .toLowerCase();
    const telemetry = new PluginOsTelemetryService({ projectRoot: root });
    if (sub === 'history') {
      const windowHours = Number(readFlag(args, 'hours') || 168) || 168;
      const bucketHours = Number(readFlag(args, 'bucket') || 6) || 6;
      const history = telemetry.history({ root, windowHours, bucketHours });
      return render(args, 'Zavorth plugin telemetry history', history.formatText().split('\n'), {
        ok: true,
        history,
      });
    }
    const hoursRaw =
      args[1] && !String(args[1]).startsWith('-') ? Number(args[1]) : Number(readFlag(args, 'hours') || 0);
    const windowHours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? hoursRaw : 168;
    if (args.includes('--sample')) {
      telemetry.recordSample({ root });
    }
    const aggregate = telemetry.aggregate({ root, windowHours });
    return render(args, 'Zavorth plugin telemetry', aggregate.formatText().split('\n'), {
      ok: true,
      telemetry: aggregate,
    });
  }

  if (action === 'wizard') {
    const wizard = new PluginOsOnboardingWizardService({
      projectRoot: root,
      onboarding: new PluginOsOnboardingService({ projectRoot: root, stateBridge: bridge }),
    });
    const sub = String(args[1] || 'start')
      .trim()
      .toLowerCase();
    const stateFile = path.join(stateDir(root), 'plugin-os-wizard.json');

    const loadWizardState = async () => {
      if (!existsSync(stateFile)) return wizard.start({ root });
      try {
        const raw = (await readJson(stateFile, null)) as any;
        if (!raw || !raw.step) return wizard.start({ root });
        // rebuild from saved fields
        let state = wizard.start({
          root,
          profile: raw.profile,
          optionalIds: raw.optionalIds || [],
        });
        // advance to saved step index best-effort
        const target = String(raw.step || 'welcome');
        let guard = 0;
        while (state.step !== target && guard < 10) {
          const next = wizard.next(state, { root });
          if (next.stepIndex <= state.stepIndex) break;
          state = next;
          guard += 1;
        }
        if (raw.injectMode) {
          state = wizard.setInject(state, raw.injectMode, Number(raw.injectSamplePercent || 100), { root });
        }
        return state;
      } catch {
        return wizard.start({ root });
      }
    };

    const saveWizardState = async (state: any) => {
      await writeJson(stateFile, {
        step: state.step,
        profile: state.profile,
        optionalIds: state.optionalIds,
        injectMode: state.injectMode,
        injectSamplePercent: state.injectSamplePercent,
        updatedAt: new Date().toISOString(),
      });
    };

    let state = await loadWizardState();

    if (sub === 'start' || sub === 'reset') {
      state = wizard.start({ root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'show' || sub === 'status') {
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'next') {
      state = wizard.next(state, { root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'back') {
      state = wizard.back(state, { root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'profile') {
      const profile = String(args[2] || readFlag(args, 'profile') || '').trim();
      if (!profile) {
        return render(args, 'Zavorth plugin wizard', ['Usage: wizard profile <minimal|core|recommended|full>'], {
          ok: false,
        });
      }
      state = wizard.setProfile(state, profile, { root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'optional') {
      const id = String(args[2] || '').trim();
      const on = !args.includes('--off');
      if (!id) {
        return render(args, 'Zavorth plugin wizard', ['Usage: wizard optional <id> [--off]'], { ok: false });
      }
      state = wizard.setOptional(state, id, on, { root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'inject') {
      const mode = String(args[2] || readFlag(args, 'mode') || 'compact').trim() as any;
      const sample = Number(readFlag(args, 'sample') || args[3] || 100) || 100;
      state = wizard.setInject(state, mode, sample, { root });
      await saveWizardState(state);
      return render(args, 'Zavorth plugin wizard', state.formatText().split('\n'), { ok: true, state });
    }
    if (sub === 'apply' || sub === 'finish') {
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugin wizard',
          ['Preview only — pass --yes to apply.', ...state.formatText().split('\n')],
          { ok: false, dryRun: true, state },
        );
      }
      const applied = wizard.apply(state, { root, approved: true, force: args.includes('--force') });
      await saveWizardState(applied.state);
      return render(
        args,
        'Zavorth plugin wizard apply',
        [...applied.result.formatText().split('\n'), '', ...applied.state.formatText().split('\n')],
        { ok: applied.result.ok, result: applied.result, state: applied.state },
      );
    }

    return render(
      args,
      'Zavorth plugin wizard',
      [
        'Usage:',
        '  zavorth plugins wizard start',
        '  zavorth plugins wizard next|back|show',
        '  zavorth plugins wizard profile recommended',
        '  zavorth plugins wizard optional gmail',
        '  zavorth plugins wizard optional gmail --off',
        '  zavorth plugins wizard inject compact|standard|full|ab|off [--sample 50]',
        '  zavorth plugins wizard apply --yes',
      ],
      { ok: false },
    );
  }

  if (action === 'onboarding' || action === 'onboard') {
    const onboarding = new PluginOsOnboardingService({ projectRoot: root, stateBridge: bridge });
    const sub = String(args[1] || 'status')
      .trim()
      .toLowerCase();
    if (sub === 'status' || sub === 'show') {
      const status = onboarding.status(root);
      return render(args, 'Zavorth plugin onboarding', status.formatText().split('\n'), {
        ok: true,
        status,
      });
    }
    if (sub === 'plan' || sub === 'preview') {
      const profile = String(args[2] || readFlag(args, 'profile') || '').trim() || undefined;
      const optionalRaw = readFlag(args, 'optional') || readFlag(args, 'opt') || '';
      const optionalIds = optionalRaw
        ? String(optionalRaw)
            .split(/[,\s]+/u)
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      const plan = onboarding.plan(profile, { root, optionalIds });
      return render(args, 'Zavorth plugin onboarding plan', plan.formatText().split('\n'), {
        ok: plan.ok,
        plan,
      });
    }
    if (sub === 'apply' || sub === 'run') {
      const profile = String(args[2] || readFlag(args, 'profile') || '').trim() || undefined;
      const optionalRaw = readFlag(args, 'optional') || readFlag(args, 'opt') || '';
      const optionalIds = optionalRaw
        ? String(optionalRaw)
            .split(/[,\s]+/u)
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      if (!args.includes('--yes')) {
        const plan = onboarding.plan(profile, { root, optionalIds });
        return render(
          args,
          'Zavorth plugin onboarding apply',
          ['Preview only — pass --yes to apply.', ...plan.formatText().split('\n')],
          { ok: false, dryRun: true, plan },
        );
      }
      const result = onboarding.apply(profile, {
        root,
        optionalIds,
        approved: true,
        force: args.includes('--force'),
      });
      return render(args, 'Zavorth plugin onboarding apply', result.formatText().split('\n'), {
        ok: result.ok,
        result,
      });
    }
    if (sub === 'undo' || sub === 'revert') {
      if (!args.includes('--yes')) {
        const status = onboarding.status(root);
        return render(
          args,
          'Zavorth plugin onboarding undo',
          [
            'Preview only — pass --yes to disable plugins enabled by last onboarding.',
            'Does not delete packages.',
            ...status.formatText().split('\n'),
            status.enabledIds?.length ? `would disable: ${status.enabledIds.join(', ')}`
              : 'would disable: (no enabledIds recorded)',
          ],
          { ok: false, dryRun: true, status },
        );
      }
      const result = onboarding.undo({ root, approved: true });
      return render(args, 'Zavorth plugin onboarding undo', result.formatText().split('\n'), {
        ok: result.ok,
        result,
      });
    }
    return render(
      args,
      'Zavorth plugin onboarding',
      [
        'Usage:',
        '  zavorth plugins onboarding status',
        '  zavorth plugins onboarding plan [minimal|core|recommended|full] [--optional gmail,linear]',
        '  zavorth plugins onboarding apply [profile] [--optional gmail] --yes [--force]',
        '  zavorth plugins onboarding undo --yes',
      ],
      { ok: false },
    );
  }

  if (action === 'sign') {
    const pluginPath = args[1] || readFlag(args, 'path') || readFlag(args, 'dir') || '';
    if (!pluginPath) {
      return render(
        args,
        'Zavorth plugin sign',
        [
          'Usage: zavorth plugins sign <path> [--yes]',
          'Writes SIGNATURE with sha256=... and ed25519=... when ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY is set.',
        ],
        { ok: false },
      );
    }
    const target = path.resolve(root, pluginPath);
    if (!existsSync(target)) {
      return render(args, 'Zavorth plugin sign', [`Path not found: ${target}`], { ok: false });
    }
    if (!args.includes('--yes')) {
      return render(
        args,
        'Zavorth plugin sign',
        [
          `Preview sign: ${target}`,
          'Will write SIGNATURE (sha256 + ed25519 if private key is configured).',
          'Add --yes to write the sidecar.',
        ],
        { dryRun: true, path: target },
      );
    }
    const signatureService = new PluginSignatureService();
    const signed = signatureService.signPackage(target, { yes: true });
    return render(
      args,
      'Zavorth plugin sign',
      [
        signed.ok ? `Signed: ${signed.packageDir}` : `Sign failed: ${signed.packageDir}`,
        `Checksum: ${signed.packageChecksum || 'none'}`,
        `SIGNATURE: ${signed.signaturePath}`,
        `ed25519: ${signed.ed25519 ? 'yes' : 'no (private key not set)'}`,
        ...signed.findings.map((line) => ` ? ${line}`),
      ],
      { ok: signed.ok, result: signed },
    );
  }

  if (action === 'test') {
    const pluginPath = args[1] || readFlag(args, 'path') || readFlag(args, 'dir') || '';
    if (!pluginPath) {
      return render(args, 'Zavorth plugin test', ['Usage: zavorth plugins test <path>'], { ok: false });
    }
    const harness = new PluginTestHarnessService({ stateBridge: bridge });
    const result = await harness.run({ root, pluginPath });
    const lines = [
      `Plugin test: ${result.pluginId || '<unknown>'}`,
      `Path: ${result.pluginPath}`,
      `ok=${result.ok}`,
      ...result.results.map((item) => `  ${item.ok ? 'ok' : 'fail'} ${item.name}: ${item.detail}`),
    ];
    return render(args, 'Zavorth plugin test', lines, { ok: result.ok, result });
  }

  if (action === 'new') {
    const id = idFromSpec(args[1] || readFlag(args, 'id') || '');
    if (!id) {
      return render(
        args,
        'Zavorth plugin new',
        [
          'Usage: zavorth plugins new <id> [--kind tool|bridge|…] [--enable] [--smoke] [--yes]',
          'Creates plugins/<id> (tool → main.ping; bridge → HTTP/CLI/MCP soft-fail invoke).',
          '--enable / --run: install + enable (trust=trusted local dev).',
          '--smoke: enable + run Plugin OS test harness.',
        ],
        { ok: false },
      );
    }
    const kind = String(readFlag(args, 'kind') || readFlag(args, 'module-kind') || 'tool').trim() || 'tool';
    const enable = args.includes('--enable') || args.includes('--run');
    const smoke = args.includes('--smoke');
    const yes = args.includes('--yes') || enable || smoke;
    const targetDir = path.resolve(root, readFlag(args, 'dir') || path.join('plugins', id));
    if (!isInside(root, targetDir)) {
      return render(args, 'Zavorth plugin new', ['Refusing to create plugin outside the workspace.'], { ok: false });
    }
    if (!yes) {
      return render(
        args,
        'Zavorth plugin new',
        [
          `Preview new plugin: ${id}`,
          `Target: ${targetDir}`,
          `Kind: ${kind}`,
          kind === 'bridge'
            ? 'Files: manifest.json, index.js (bridge.invoke http|cli|mcp), package.json, README.md'
            : 'Files: manifest.json, index.js (main.ping), package.json, README.md',
          smoke ? 'Mode: --smoke (scaffold + enable + harness)'
            : enable ? 'Mode: --enable/--run (scaffold + install + enable trusted)'
              : 'Mode: scaffold only (use --enable --smoke for one-shot)',
          'Add --yes, --enable, --run, or --smoke to execute.',
        ],
        {
          dryRun: true,
          id,
          targetDir,
          kind,
          enable,
          smoke,
        },
      );
    }
    const result = await new PluginNewService({ stateBridge: bridge }).run({
      root,
      id,
      kind,
      enable,
      run: enable,
      smoke,
      targetDir,
    });
    return render(args, 'Zavorth plugin new', result.formatText().split('\n'), {
      ok: result.ok,
      result,
    });
  }

  if (action === 'promote-from-skill' || action === 'promote-skill') {
    const skillRef = String(args[1] || readFlag(args, 'id') || readFlag(args, 'skill') || '').trim();
    if (!skillRef) {
      return render(
        args,
        'Zavorth plugins promote-from-skill',
        [
          'Usage: zavorth plugins promote-from-skill <draft-id|ordinal> [--user <id>] [--dry-run]',
          'Alias of: zavorth learn promote <id> --kind plugin',
          'Scaffolds plugins/promoted/… from an experience skill draft (never auto-enables).',
        ],
        { ok: false },
      );
    }
    const dryRun = args.includes('--dry-run') || args.includes('--dryRun');
    const userIdx = args.indexOf('--user');
    const userId =
      userIdx >= 0 ? String(args[userIdx + 1] || '').trim() : process.env.USER || process.env.USERNAME || 'local-user';
    try {
      const { ExperienceSkillLearningLoopService } =
        require('../../services/ExperienceSkillLearningLoopService.js') as typeof import('../../services/ExperienceSkillLearningLoopService.js');
      const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
      const result = loop.promote(userId, skillRef, { kind: 'plugin', dryRun });
      return render(args, 'Zavorth plugins promote-from-skill', result.text.split('\n'), {
        ok: result.ok,
        result,
        autoEnable: false,
      });
    } catch (error) {
      return render(
        args,
        'Zavorth plugins promote-from-skill',
        [error instanceof Error ? error.message : String(error)],
        { ok: false },
      );
    }
  }

  if (action === 'suggest') {
    const intent = String(
      args
        .slice(1)
        .filter((a) => !String(a).startsWith('--'))
        .join(' ') ||
        readFlag(args, 'intent') ||
        '',
    ).trim();
    if (!intent) {
      return render(
        args,
        'Zavorth plugin suggest',
        ['Usage: zavorth plugins suggest "<intent>"', 'Never auto-enables — shows Enable vs Recommend-only actions.'],
        { ok: false },
      );
    }
    const result = await new PluginOsSuggestService({ projectRoot: root, stateBridge: bridge }).suggest({
      root,
      intent,
      limit: Number(readFlag(args, 'limit') || 5) || 5,
    });
    return render(args, 'Zavorth plugin suggest', result.formatText().split('\n'), {
      ok: result.ok,
      suggest: result,
      autoEnable: false,
    });
  }

  if (action === 'receipts' || action === 'activity' || action === 'timeline') {
    const limit = Number(args[1] || readFlag(args, 'limit') || 30) || 30;
    const timeline = new PluginOsReceiptTimelineService({ projectRoot: root }).buildTimeline({ root, limit });
    return render(args, 'Zavorth plugin receipts', timeline.formatText().split('\n'), {
      ok: true,
      timeline,
    });
  }

  if (action === 'inject-mode' || action === 'inject') {
    const mode = String(args[1] || readFlag(args, 'mode') || '').trim();
    const injection = new PluginOsPromptInjectionService({ projectRoot: root });
    if (!mode) {
      const prefs = injection.loadPrefs(root);
      return render(
        args,
        'Zavorth plugin inject-mode',
        [
          `mode=${prefs.injectMode}`,
          `sample=${prefs.injectSamplePercent}%`,
          prefs.updatedAt ? `updated=${prefs.updatedAt}` : null,
          'Default product mode is compact. full/ab need ZAVORTH_PLUGIN_OS_PROMPT_ALLOW_FULL=1 in production.',
        ].filter(Boolean) as string[],
        { ok: true, injectPrefs: prefs },
      );
    }
    const sample = Number(readFlag(args, 'sample') || 100) || 100;
    const saved = injection.savePrefs(
      {
        injectMode: mode as any,
        injectSamplePercent: sample,
      },
      root,
    );
    return render(
      args,
      'Zavorth plugin inject-mode',
      [`saved mode=${saved.injectMode} sample=${saved.injectSamplePercent}%`],
      { ok: true, injectPrefs: saved },
    );
  }

  if (action === 'recommend') {
    const intentParts = args.slice(1).filter((part) => !part.startsWith('--'));
    const intent =
      intentParts.join(' ').trim() || String(readFlag(args, 'intent') || readFlag(args, 'query') || '').trim();
    if (!intent) {
      return render(
        args,
        'Zavorth plugin recommend',
        ['Usage: zavorth plugins recommend "<intent>" [--limit N] [--llm]'],
        { ok: false },
      );
    }
    const limitRaw = readFlag(args, 'limit');
    const limit = limitRaw ? Number(limitRaw) : 5;
    const useLlm = args.includes('--llm') || args.includes('--use-llm');
    const result = await new PluginRouterService({ stateBridge: bridge }).recommend({
      root,
      intent,
      limit: Number.isFinite(limit) ? limit : 5,
      useLlm,
    });
    return render(args, 'Zavorth plugin recommend', result.formatText().split('\n'), {
      ok: result.ok,
      result,
    });
  }

  if (action === 'forge') {
    const forge = new PluginForgeService({ projectRoot: root, stateBridge: bridge });
    const sub = String(args[1] || '')
      .trim()
      .toLowerCase();
    const isApply = sub === 'apply';
    const isPlan = sub === 'plan' || sub === '';

    if (isApply) {
      const previewRef = args[2] || readFlag(args, 'preview') || readFlag(args, 'dir') || readFlag(args, 'id') || '';
      if (!previewRef) {
        return render(
          args,
          'Zavorth plugin forge apply',
          ['Usage: zavorth plugins forge apply <previewDir|id> --yes [--enable]'],
          { ok: false },
        );
      }
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugin forge apply',
          [
            `Preview apply: ${previewRef}`,
            'Will copy forge preview into .zavorth/plugins/<id> (or plugins/ with --bundled).',
            'Does not auto-enable unless --enable.',
            'Add --yes to apply (approved).',
          ],
          { dryRun: true, previewRef },
        );
      }
      const result = await forge.apply(previewRef, {
        approved: true,
        enable: args.includes('--enable'),
        root,
        target: args.includes('--bundled') ? 'plugins' : 'zavorth',
      });
      return render(args, 'Zavorth plugin forge apply', result.formatText().split('\n'), {
        ok: result.ok,
        result,
      });
    }

    // plan (default) or forge "<intent>" [--apply --yes]
    const intentParts = (sub === 'plan' ? args.slice(2) : args.slice(1)).filter((part) => !part.startsWith('--'));
    const intent =
      intentParts.join(' ').trim() || String(readFlag(args, 'intent') || readFlag(args, 'query') || '').trim();
    if (!intent && isPlan) {
      return render(
        args,
        'Zavorth plugin forge',
        [
          'Usage: zavorth plugins forge plan "<intent>" [--id my-id]',
          '       zavorth plugins forge "<intent>" [--apply --yes] [--enable]',
          '       zavorth plugins forge apply <previewDir|id> --yes [--enable]',
        ],
        { ok: false },
      );
    }
    const plan = await forge.plan(intent, {
      id: readFlag(args, 'id') || undefined,
      root,
    });
    if (!args.includes('--apply')) {
      return render(args, 'Zavorth plugin forge plan', plan.formatText().split('\n'), {
        ok: plan.ok,
        result: plan,
      });
    }
    if (!args.includes('--yes')) {
      return render(
        args,
        'Zavorth plugin forge',
        [...plan.formatText().split('\n'), '', 'Plan ready. Add --apply --yes to materialize the package.'],
        { ok: plan.ok, dryRun: true, result: plan },
      );
    }
    if (!plan.ok) {
      return render(args, 'Zavorth plugin forge', plan.formatText().split('\n'), {
        ok: false,
        result: plan,
      });
    }
    const applied = await forge.apply(plan.previewDir, {
      approved: true,
      enable: args.includes('--enable'),
      root,
      target: args.includes('--bundled') ? 'plugins' : 'zavorth',
    });
    return render(
      args,
      'Zavorth plugin forge',
      [...plan.formatText().split('\n'), '', ...applied.formatText().split('\n')],
      { ok: plan.ok && applied.ok, plan, apply: applied },
    );
  }

  if (action === 'mcp') {
    const mcp = new PluginMcpBridgeService({ projectRoot: root });
    const sub = String(args[1] || 'list')
      .trim()
      .toLowerCase();
    if (sub === 'list' || sub === 'ls') {
      const servers = mcp.listServers({ root });
      const lines = servers.length
        ? servers.map((server) => `- ${server.id} enabled=${server.enabled} | ${server.summary}`)
        : ['No MCP servers found in config/mcp-servers.json'];
      return render(args, 'Zavorth plugin mcp list', lines, {
        ok: true,
        servers,
      });
    }
    if (sub === 'status') {
      const serverId = args[2] || readFlag(args, 'id') || readFlag(args, 'server') || '';
      const servers = mcp.listServers({ root });
      if (!serverId) {
        return render(
          args,
          'Zavorth plugin mcp status',
          [`configured=${servers.length}`, ...servers.map((server) => `- ${server.id} enabled=${server.enabled}`)],
          { ok: true, servers },
        );
      }
      const hit = servers.find((server) => server.id === serverId);
      if (!hit) {
        return render(
          args,
          'Zavorth plugin mcp status',
          [`MCP server not found: ${serverId}`, `Known: ${servers.map((s) => s.id).join(', ') || 'none'}`],
          { ok: false },
        );
      }
      return render(
        args,
        'Zavorth plugin mcp status',
        [
          `id: ${hit.id}`,
          `enabled: ${hit.enabled}`,
          `command: ${hit.command || 'n/a'}`,
          `capability: ${hit.capability || 'n/a'}`,
          hit.enabled ? 'Server is enabled in config/mcp-servers.json'
            : `Enable MCP server ${hit.id} in config/mcp-servers.json`,
        ],
        { ok: true, server: hit },
      );
    }
    if (sub === 'materialize' || sub === 'create') {
      const serverId = args[2] || readFlag(args, 'id') || readFlag(args, 'server') || '';
      if (!serverId) {
        return render(
          args,
          'Zavorth plugin mcp materialize',
          ['Usage: zavorth plugins mcp materialize <serverId> --yes [--force]'],
          { ok: false },
        );
      }
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugin mcp materialize',
          [
            `Preview materialize bridge for MCP server: ${serverId}`,
            'Writes .zavorth/plugins/mcp-<id>/ with mcp.invoke + mcp.status.',
            'Add --yes to write the package.',
          ],
          {
            dryRun: true,
            serverId,
          },
        );
      }
      const result = mcp.materializeBridgePlugin(serverId, {
        root,
        force: args.includes('--force'),
      });
      return render(args, 'Zavorth plugin mcp materialize', result.formatText().split('\n'), {
        ok: result.ok,
        result,
      });
    }
    return render(
      args,
      'Zavorth plugin mcp',
      [
        'Usage:',
        '  zavorth plugins mcp list',
        '  zavorth plugins mcp status [serverId]',
        '  zavorth plugins mcp materialize <serverId> --yes [--force]',
      ],
      { ok: false },
    );
  }

  if (action === 'dev') {
    const pluginPath = args[1] || readFlag(args, 'path') || readFlag(args, 'dir') || '';
    if (!pluginPath) {
      return render(
        args,
        'Zavorth plugin dev',
        [
          'Usage: zavorth plugins dev <path> [--trust review|trusted] [--no-enable] [--watch] [--write-manifest] [--watch-ms N] [--json]',
        ],
        { ok: false },
      );
    }
    const trustRaw = String(readFlag(args, 'trust') || 'trusted')
      .trim()
      .toLowerCase();
    const trust = trustRaw === 'review' ? ('review' as const) : ('trusted' as const);
    const enable = !args.includes('--no-enable');
    const watch = args.includes('--watch');
    const writeManifest = args.includes('--write-manifest');
    const watchMsRaw = readFlag(args, 'watch-ms');
    const watchMs = watchMsRaw ? Number(watchMsRaw) : undefined;
    const watchIntervalRaw = readFlag(args, 'watch-interval') || readFlag(args, 'interval');
    const watchIntervalMs = watchIntervalRaw ? Number(watchIntervalRaw) : undefined;

    const snapshot = await new PluginDevService({ stateBridge: bridge }).run({
      root,
      pluginPath,
      enable,
      trust,
      applyInference: !args.includes('--no-inference'),
      writeManifest,
      watch,
      watchMs: Number.isFinite(watchMs) ? watchMs : undefined,
      watchIntervalMs: Number.isFinite(watchIntervalMs) ? watchIntervalMs : undefined,
    });

    if (watch && !watchMs && snapshot.stop) {
      const onSignal = () => {
        try {
          snapshot.stop?.();
        } catch {
          /* soft-fail */
        }
        process.exit(0);
      };
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
      await new Promise<void>(() => {
        /* keep process alive until signal */
      });
    }

    const lines = formatSnapshotText(snapshot).split('\n');
    return render(args, 'Zavorth plugin dev', lines, {
      ok:
        snapshot.steps.every((step) => step.ok) ||
        snapshot.steps.some((step) => step.id === 'runtime-bootstrap' && step.ok),
      snapshot: {
        generatedAt: snapshot.generatedAt,
        pluginPath: snapshot.pluginPath,
        pluginId: snapshot.pluginId,
        steps: snapshot.steps,
        discovery: snapshot.discovery,
        load: snapshot.load,
        wire: snapshot.wire,
        inference: snapshot.inference,
        bridge: snapshot.bridge,
        nextCommands: snapshot.nextCommands,
      },
    });
  }
  if (action === 'scaffold' || action === 'create') {
    const id = idFromSpec(args[1] || readFlag(args, 'id') || 'zavorth-plugin');
    const targetDir = path.resolve(root, readFlag(args, 'dir') || path.join('plugins', id));
    const moduleKind = String(readFlag(args, 'module-kind') || readFlag(args, 'kind') || 'tool').trim() || 'tool';
    const scaffoldOptions = resolveScaffoldOptions(args);
    if (!isInside(root, targetDir)) {
      return render(args, 'Zavorth plugin scaffold', ['Refusing to scaffold outside the workspace.'], { ok: false });
    }
    const preview = [
      `Plugin id: ${id}`,
      `Target: ${targetDir}`,
      `Module kind: ${moduleKind}`,
      `Language: ${scaffoldOptions.language}`,
      `definePlugin-style package (hooks=${scaffoldOptions.withHooks} tools=${scaffoldOptions.withTools})`,
      scaffoldOptions.language === 'ts'
        ? 'Files: manifest.json, index.js, index.ts, define-plugin.example.js, README.md, package.json, zavorth.plugin.json'
        : 'Files: manifest.json, index.js, define-plugin.example.js, README.md, package.json, zavorth.plugin.json',
      'Add --yes to create this Plugin OS scaffold.',
    ];
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth plugin scaffold', preview, {
        dryRun: true,
        id,
        targetDir,
        moduleKind,
        language: scaffoldOptions.language,
        withHooks: scaffoldOptions.withHooks,
        withTools: scaffoldOptions.withTools,
      });
    }
    const created = await scaffoldPlugin(root, targetDir, id, moduleKind, scaffoldOptions);
    return render(
      args,
      'Zavorth plugin scaffold',
      [
        `Created Plugin OS scaffold: ${id}`,
        `Target: ${targetDir}`,
        `Kind: ${moduleKind}`,
        `Language: ${scaffoldOptions.language}`,
        'Next: zavorth plugins dev ./plugins/<id>',
        'Or: zavorth plugins install ./plugins/<id> --yes',
        'Then: zavorth plugins enable <id> --yes',
        'Test: zavorth plugins test ./plugins/<id>',
      ],
      { plugin: created },
    );
  }

  if (action === 'uninstall' || action === 'remove') {
    const id = args[1] || readFlag(args, 'id') || '';
    if (!id) {
      return render(args, 'Zavorth plugins', ['Usage: zavorth plugins uninstall <id> [--yes]'], { ok: false });
    }
    const selected = findPlugin(local, id);
    const bridged = bridge.resolve(id);
    const packageDir = path.join(root, '.zavorth', 'plugins', bridged.pluginId || id);
    const canDeletePackage = existsSync(packageDir) && isInside(path.join(root, '.zavorth', 'plugins'), packageDir);
    const preview = [
      `Uninstall preview: ${bridged.pluginId || id}`,
      `CLI record: ${selected ? 'yes' : 'no'}`,
      `Bridge installed: ${bridged.installed}`,
      `Package under .zavorth/plugins: ${canDeletePackage ? packageDir : 'none (bundled plugins/ never deleted)'}`,
      'Add --yes to remove bridge state, plugins.json entry, and local package dir when safe.',
    ];
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth plugins', preview, {
        dryRun: true,
        pluginId: bridged.pluginId || id,
        packageDir: canDeletePackage ? packageDir : null,
      });
    }

    const nextLocal = local.filter((item) => {
      const record = item as JsonObject;
      return (
        String(record.id) !== id &&
        String(record.name) !== id &&
        String(record.spec) !== id &&
        String(record.id) !== bridged.pluginId &&
        String(record.name) !== bridged.pluginId
      );
    });
    await writeJson(pluginFile, nextLocal);
    const after = bridge.markUninstalled(bridged.pluginId || id);
    bridge.syncRuntimeIndex();

    let deletedPackage = false;
    if (canDeletePackage) {
      try {
        await fs.rm(packageDir, { recursive: true, force: true });
        deletedPackage = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return render(
          args,
          'Zavorth plugins',
          [`Uninstalled bridge state for ${bridged.pluginId || id}`, `Package delete soft-failed: ${message}`],
          { ok: true, bridged: after, deletedPackage: false },
        );
      }
    }

    return render(
      args,
      'Zavorth plugins',
      [`Uninstalled: ${bridged.pluginId || id}`, `Package deleted: ${deletedPackage ? 'yes' : 'no'}`],
      { ok: true, bridged: after, deletedPackage },
    );
  }
  if (action === 'install') {
    const marketplaceFlag = readFlag(args, 'marketplace') || readFlag(args, 'from');
    const rawSpec = args[1] || '';
    const marketplaceId =
      marketplaceFlag || (rawSpec.startsWith('marketplace:') ? rawSpec.slice('marketplace:'.length) : '');
    if (marketplaceId) {
      const market = new PluginOsMarketplaceService({ projectRoot: root, stateBridge: bridge });
      const preview = market.preview(marketplaceId, { root });
      if (!preview.ok || !preview.entry) {
        return render(
          args,
          'Zavorth plugins',
          [
            `Marketplace plugin not found: ${marketplaceId}`,
            'Use: zavorth plugins marketplace',
            '     zavorth plugins marketplace show <id>',
          ],
          { ok: false },
        );
      }
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugins',
          [preview.formatText(), '', 'Add --yes to install. Add --enable to enable after install.'],
          { dryRun: true, preview },
        );
      }
      const installed = await market.install(preview.entry.id, {
        root,
        enable: args.includes('--enable'),
        force: args.includes('--force'),
      });
      if (!installed.ok) {
        return render(args, 'Zavorth plugins', [installed.formatText()], { ok: false, install: installed });
      }
      // refresh local plugin list for CLI state file
      const refreshedLocal = await readArray(pluginFile);
      return render(
        args,
        'Zavorth plugins',
        [
          installed.formatText(),
          args.includes('--enable') ? 'Enabled: yes' : `Next: zavorth plugins enable ${installed.pluginId} --yes`,
        ],
        {
          ok: true,
          install: installed,
          plugins: refreshedLocal.length,
        },
      );
    }

    const spec = rawSpec;
    if (!spec) {
      return render(
        args,
        'Zavorth plugins',
        [
          'Usage: zavorth plugins install <package-or-path|url> [--yes]',
          '       zavorth plugins install marketplace:<id> [--yes] [--enable]',
          '       zavorth plugins install --marketplace <id> [--yes] [--enable]',
          '       zavorth plugins install https://example.com/plugin.tgz --yes',
        ],
        { ok: false },
      );
    }

    const urlInstaller = new PluginUrlInstallService({ projectRoot: root });
    if (urlInstaller.isUrlSpec(spec)) {
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugins',
          [
            `Preview URL install: ${spec}`,
            'Downloads to .zavorth/cache/plugin-downloads/ and extracts under .zavorth/plugins/<id>.',
            'Add --yes to download, extract, and register via PluginStateBridge.',
          ],
          { dryRun: true, url: spec },
        );
      }
      const downloaded = await urlInstaller.downloadAndExtract(spec);
      if (!downloaded.ok || !downloaded.packageDir || !downloaded.pluginId) {
        return render(args, 'Zavorth plugins', [`URL install failed: ${downloaded.error || 'unknown error'}`], {
          ok: false,
          download: downloaded,
        });
      }
      const relativeDir = path.relative(root, downloaded.packageDir).replace(/\\/gu, '/');
      const localSpec = relativeDir.startsWith('.') ? relativeDir : `./${relativeDir}`;
      const manifest = await resolvePluginManifest(root, localSpec, args);
      const checksum = await calculatePluginChecksum(root, localSpec);
      const record = buildPluginRecord(localSpec, manifest, checksum, args);
      record.id = downloaded.pluginId;
      record.name = downloaded.pluginId;
      record.status = 'installed';
      record.installedAt = new Date().toISOString();
      record.sourceUrl = spec;
      const existingIndex = local.findIndex((item) => String((item as JsonObject).id) === downloaded.pluginId);
      if (existingIndex >= 0) local[existingIndex] = record;
      else local.push(record);
      await writeJson(pluginFile, local);
      try {
        bridge.markInstalled({
          pluginId: downloaded.pluginId,
          revision: String(record.version || '0.0.0'),
          sourceLocator: localSpec,
          sourceDigest: checksum || null,
          trust: 'review',
          enable: args.includes('--enable'),
        });
      } catch {
        /* soft-fail bridge */
      }
      const verify = downloaded.verify;
      return render(
        args,
        'Zavorth plugins',
        [
          `URL install applied: ${downloaded.pluginId}`,
          `Package: ${localSpec}`,
          `Bytes: ${downloaded.bytes || 0}`,
          `Checksum: ${checksum || verify?.packageChecksum || 'none'}`,
          `Verify: ${verify?.status || 'unsigned'}`,
          ...(verify?.findings || []).slice(0, 3).map((line) => ` ? ${line}`),
        ],
        {
          ok: true,
          record: sanitizePluginRecord(record),
          download: downloaded,
          verify: verify || null,
        },
      );
    }

    const manifest = await resolvePluginManifest(root, spec, args);
    const checksum = await calculatePluginChecksum(root, spec);
    const expectedChecksum = readFlag(args, 'checksum') || '';
    if (expectedChecksum && checksum && expectedChecksum !== checksum) {
      return render(args, 'Zavorth plugins', ['Checksum mismatch. Plugin was not installed.'], {
        ok: false,
        expectedChecksum,
        actualChecksum: checksum,
      });
    }

    let localVerify: { ok: boolean; status: string; findings: string[]; packageChecksum?: string } | null = null;
    if (isLocalPluginSpec(root, spec)) {
      try {
        const packageDir = path.resolve(root, spec);
        localVerify = new PluginUrlInstallService({ projectRoot: root }).verifyLocalPackage(packageDir);
        if (!localVerify.ok) {
          return render(
            args,
            'Zavorth plugins',
            [
              `local package signature verification failed (${localVerify.status}).`,
              ...(localVerify.findings || []).slice(0, 4),
            ],
            { ok: false, verify: localVerify },
          );
        }
      } catch {
        /* soft-fail local verify plumbing */
      }
    }

    const record = buildPluginRecord(spec, manifest, checksum, args);
    if (!args.includes('--yes')) {
      const permissions = (record.permissions as string[]) || [];
      return render(
        args,
        'Zavorth plugins',
        [
          `Preview install: ${spec}`,
          `Manifest: ${manifest.found ? 'found' : 'fallback'}`,
          `Permissions: ${permissions.join(', ') || 'none'}`,
          `Checksum: ${checksum || 'pending-after-install'}`,
          `Verify: ${localVerify?.status || 'n/a'}`,
          'Add --yes to install/register this plugin.',
        ],
        { record: sanitizePluginRecord(record), manifest, verify: localVerify },
      );
    }
    const install = isLocalPluginSpec(root, spec)
      ? { exitCode: 0, output: 'local plugin registered without npm install', durationMs: 0, timedOut: false }
      : await runProcess(resolveNpmCommand(), ['install', spec, '--save'], root, 120000);
    record.status = install.exitCode === 0 ? 'installed' : 'install-failed';
    record.installedAt = new Date().toISOString();
    record.exitCode = install.exitCode;
    local.push(record);
    await writeJson(pluginFile, local);
    if (record.status === 'installed') {
      try {
        bridge.markInstalled({
          pluginId: String(record.id),
          revision: String(record.version || '0.0.0'),
          sourceLocator: String(record.spec || spec),
          sourceDigest: checksum || null,
          trust: 'review',
          enable: false,
        });
      } catch {
        /* soft-fail bridge sync */
      }
    }
    return render(args, 'Zavorth plugins', [`Install ${record.status}: ${spec}`, install.output.slice(0, 800)], {
      record: sanitizePluginRecord(record),
      install,
    });
  }
  if (action === 'manifest') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(
      args,
      'Zavorth plugin manifest',
      [
        `id: ${String(selected.id)}`,
        `name: ${String(selected.name || selected.spec)}`,
        `version: ${String(selected.version || 'unknown')}`,
        `permissions: ${((selected.permissions as string[]) || []).join(', ') || 'none'}`,
        `checksum: ${String(selected.checksum || 'none')}`,
      ],
      { plugin: sanitizePluginRecord(selected) },
    );
  }
  if (action === 'doctor') {
    const id = args[1] || readFlag(args, 'id') || '';
    if (!id) {
      try {
        const discovery = new PluginDiscoveryService({
          projectRoot: root,
          stateLookup: bridge.asStateLookup(),
        });
        const snapshot = discovery.discover();
        const selectedPlugins = snapshot.plugins.filter((plugin) => plugin.selected);
        const lines = selectedPlugins.length
          ? selectedPlugins.slice(0, 30).map((plugin) => {
              const findings = plugin.validation.findings.slice(0, 2).join('; ') || 'no findings';
              return `- ${plugin.pluginId} valid=${plugin.validation.ok} eligible=${plugin.loadEligible} trust=${plugin.state.trust} :: ${findings}`;
            })
          : ['No selected discovery plugins found.'];
        return render(args, 'Zavorth plugin doctor', lines, {
          ok: selectedPlugins.every((plugin) => plugin.validation.ok),
          discovery: snapshot.summary,
          bridged: bridge.list(),
        });
      } catch {
        return render(args, 'Zavorth plugin doctor', ['Plugin OS discovery unavailable.'], { ok: false });
      }
    }
    const selected = findPlugin(local, id);
    const checks = selected ? await doctorPlugin(root, selected) : [];
    let discoveryFindings: string[] = [];
    try {
      const discovery = new PluginDiscoveryService({
        projectRoot: root,
        stateLookup: bridge.asStateLookup(),
      });
      const hit = discovery
        .discover()
        .plugins.find((plugin) => plugin.pluginId === id || plugin.pluginId === String(selected?.id || ''));
      if (hit) {
        discoveryFindings = [
          `discovery selected=${hit.selected}`,
          `discovery valid=${hit.validation.ok}`,
          `discovery eligible=${hit.loadEligible}`,
          ...hit.validation.findings.map((finding) => `validation: ${finding}`),
          ...hit.compatibility.findings.map((finding) => `compatibility: ${finding}`),
        ];
        checks.push({
          id: 'os-validation',
          ok: hit.validation.ok && hit.compatibility.ok,
          summary: hit.validation.ok ? 'Plugin OS validation passed.'
            : hit.validation.findings.join('; ') || 'Plugin OS validation failed.',
        });
      }
    } catch {
      /* soft-fail discovery doctor */
    }
    const lines = selected
      ? [...checks.map((check) => `${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.summary}`), ...discoveryFindings]
      : [`Plugin not found: ${id || '<missing>'}`];
    return render(args, 'Zavorth plugin doctor', lines, {
      ok: selected ? checks.every((check) => check.ok) : false,
      checks,
      bridged: selected ? bridge.resolve(String(selected.id)) : null,
    });
  }
  if (action === 'preview' || action === 'permissions') {
    const id = args[1] || readFlag(args, 'id') || '';
    if (!id) {
      return render(
        args,
        'Zavorth plugin preview',
        ['Usage: zavorth plugins preview <id>', 'Shows permission / risk summary. Never auto-enables.'],
        { ok: false },
      );
    }
    const previewService = new PluginOsPermissionPreviewService({
      projectRoot: root,
      stateBridge: bridge,
    });
    const preview = previewService.preview(id, root);
    return render(args, 'Zavorth plugin preview', preview.formatText().split('\n'), {
      ok: preview.ok,
      preview: {
        ...preview,
        formatText: undefined,
        text: preview.formatText(),
      },
    });
  }
  if (action === 'inspect') {
    const id = args[1] || readFlag(args, 'id') || '';
    if (!id) {
      return render(args, 'Zavorth plugin inspect', ['Usage: zavorth plugins inspect <id>'], { ok: false });
    }
    const bridged = bridge.resolve(id);
    let discovered = null as null | JsonObject;
    try {
      const discovery = new PluginDiscoveryService({
        projectRoot: root,
        stateLookup: bridge.asStateLookup(),
      });
      const hit = discovery
        .discover()
        .plugins.find((plugin) => plugin.pluginId === bridged.pluginId || plugin.pluginId === id);
      if (hit) {
        discovered = {
          pluginId: hit.pluginId,
          sourceKind: hit.sourceKind,
          packageDir: hit.packageDir,
          manifestPath: hit.manifestPath,
          validation: hit.validation,
          compatibility: hit.compatibility,
          loadEligible: hit.loadEligible,
          selected: hit.selected,
          trust: hit.state.trust,
          enabled: hit.state.enabled,
          installed: hit.state.installed,
          runtimeState: hit.state.runtimeState,
        };
      }
    } catch {
      /* soft-fail */
    }
    let permissionLines: string[] = [];
    let permissionPreview: JsonObject | null = null;
    try {
      const previewService = new PluginOsPermissionPreviewService({
        projectRoot: root,
        stateBridge: bridge,
      });
      const preview = previewService.preview(id, root);
      permissionPreview = {
        ...preview,
        formatText: undefined,
        text: preview.formatText(),
      } as JsonObject;
      permissionLines = [
        `permissions: ${preview.permissions.length}`,
        `needsCredentials: ${preview.needsCredentials}`,
        ...preview.risks.slice(0, 8).map((risk) => `  risk: ${risk}`),
        ...preview.permissions.slice(0, 8).map((entry) => {
          const bits = [entry.kind];
          if (entry.scope) bits.push(`scope=${entry.scope}`);
          if (entry.reason) bits.push(`— ${entry.reason}`);
          return `  perm: ${bits.join(' ')}`;
        }),
      ];
    } catch {
      permissionLines = [];
    }
    return render(
      args,
      'Zavorth plugin inspect',
      [
        `id: ${bridged.pluginId}`,
        `installed: ${bridged.installed}`,
        `enabled: ${bridged.enabled}`,
        `trust: ${bridged.trust}`,
        `runtimeState: ${bridged.runtimeState}`,
        `sourceLocator: ${bridged.sourceLocator || 'none'}`,
        `loadEligible: ${discovered ? String(discovered.loadEligible) : 'unknown'}`,
        `manifestPath: ${discovered ? String(discovered.manifestPath || 'none') : 'not discovered'}`,
        ...permissionLines,
      ],
      { bridged, discovery: discovered, permissionPreview },
    );
  }
  if (action === 'os' || action === 'runtime') {
    try {
      const discovery = new PluginDiscoveryService({
        projectRoot: root,
        stateLookup: bridge.asStateLookup(),
      });
      const snapshot = discovery.discover();
      const lines = [...bridge.formatSnapshotText().split('\n'), '', discovery.formatSnapshotText(snapshot)];
      return render(args, 'Zavorth plugin OS', lines, {
        bridged: bridge.list(),
        os: snapshot.summary,
        discovery: {
          total: snapshot.summary.total,
          valid: snapshot.summary.valid,
          loadEligible: snapshot.summary.loadEligible,
          selected: snapshot.summary.selected,
          plugins: snapshot.plugins
            .filter((plugin) => plugin.selected)
            .map((plugin) => ({
              pluginId: plugin.pluginId,
              loadEligible: plugin.loadEligible,
              trust: plugin.state.trust,
              enabled: plugin.state.enabled,
              runtimeState: plugin.state.runtimeState,
            })),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return render(args, 'Zavorth plugin OS', [bridge.formatSnapshotText(), `Discovery unavailable: ${message}`], {
        bridged: bridge.list(),
        ok: false,
      });
    }
  }
  if (action === 'trust') {
    const id = args[1] || readFlag(args, 'id') || '';
    const trustValue = String(args[2] || readFlag(args, 'trust') || '')
      .trim()
      .toLowerCase();
    if (!id || !['review', 'trusted', 'blocked'].includes(trustValue)) {
      return render(args, 'Zavorth plugins', ['Usage: zavorth plugins trust <id> <review|trusted|blocked> [--yes]'], {
        ok: false,
      });
    }
    if ((trustValue === 'trusted' || trustValue === 'blocked') && !args.includes('--yes')) {
      return render(
        args,
        'Zavorth plugins',
        [`Trust preview: ${id} -> ${trustValue}`, 'Add --yes to apply this trust change.'],
        { dryRun: true, pluginId: id, trust: trustValue },
      );
    }
    const bridged = bridge.setTrust(id, trustValue as 'review' | 'trusted' | 'blocked');
    return render(
      args,
      'Zavorth plugins',
      [`Trust set: ${bridged.pluginId} -> ${bridged.trust}`, `runtimeState: ${bridged.runtimeState}`],
      { bridged },
    );
  }
  if (action === 'marketplace' || action === 'search') {
    const market = new PluginOsMarketplaceService({ projectRoot: root, stateBridge: bridge });
    const sub = String(args[1] || '')
      .trim()
      .toLowerCase();
    if (sub === 'refresh-remote' || sub === 'remote-refresh') {
      const refreshed = await market.refreshRemote({ root });
      return render(
        args,
        'Zavorth plugin marketplace remote',
        [
          `ok=${refreshed.ok}`,
          refreshed.cachePath ? `cache: ${refreshed.cachePath}` : 'cache: n/a',
          `entries=${refreshed.entries.length}`,
          ...refreshed.findings.map((line) => ` ? ${line}`),
        ],
        { ok: refreshed.ok, result: refreshed },
      );
    }
    if (sub === 'show' || sub === 'preview' || sub === 'info') {
      const id = String(args[2] || readFlag(args, 'id') || '').trim();
      if (!id) {
        return render(args, 'Zavorth plugin marketplace', ['Usage: zavorth plugins marketplace show <id>'], {
          ok: false,
        });
      }
      const preview = market.preview(id, { root });
      return render(args, 'Zavorth plugin marketplace show', [preview.formatText()], { ok: preview.ok, preview });
    }
    if (sub === 'install') {
      const id = String(args[2] || readFlag(args, 'id') || '').trim();
      if (!id) {
        return render(
          args,
          'Zavorth plugin marketplace',
          ['Usage: zavorth plugins marketplace install <id> [--yes] [--enable]'],
          { ok: false },
        );
      }
      const preview = market.preview(id, { root });
      if (!args.includes('--yes')) {
        return render(
          args,
          'Zavorth plugin marketplace install',
          [preview.formatText(), '', 'Add --yes to install. Optional --enable.'],
          { dryRun: true, preview },
        );
      }
      const installed = await market.install(id, {
        root,
        enable: args.includes('--enable'),
        force: args.includes('--force'),
      });
      return render(args, 'Zavorth plugin marketplace install', [installed.formatText()], {
        ok: installed.ok,
        install: installed,
      });
    }

    const reserved = new Set(['refresh-remote', 'remote-refresh', 'show', 'preview', 'info', 'install']);
    const query = String(
      args.slice(1).find((part) => part && !part.startsWith('--') && !reserved.has(part)) ||
        readFlag(args, 'query') ||
        '',
    ).trim();
    // Default includes remote cache when present. --local skips remote merge.
    const includeRemote = !args.includes('--local');
    const listed = market.list({
      root,
      query: query || undefined,
      includeRemote,
      limit: 200,
    });
    return render(args, 'Zavorth plugin marketplace', [listed.formatText()], {
      ok: listed.ok,
      plugins: listed.entries,
      sources: listed.sources,
      findings: listed.findings,
      total: listed.total,
    });
  }

  if (action === 'create' || action === 'create-plugin') {
    const id = String(args[1] || readFlag(args, 'id') || '').trim();
    const kind = String(readFlag(args, 'kind') || 'tool').trim();
    const dir = readFlag(args, 'dir') || readFlag(args, 'out') || '';
    if (!id) {
      return render(
        args,
        'Zavorth plugins create',
        [
          'Usage: zavorth plugins create <id> --kind tool|provider|channel|memory|media|voice|search|diagnostics|bridge [--dir path] [--yes]',
          'Alias: create-zavorth-plugin (standalone CLI)',
        ],
        {
          ok: false,
        },
      );
    }
    const cliPath = path.join(root, 'bin', 'create-zavorth-plugin.js');
    const createArgs = [id, '--kind', kind];
    if (dir) createArgs.push('--dir', dir);
    if (args.includes('--dry-run')) createArgs.push('--dry-run');
    else createArgs.push('--yes');
    if (!existsSync(cliPath)) {
      // Fallback to PluginNewService monorepo scaffold
      const created = await new PluginNewService().run({
        root,
        id,
        kind,
        run: args.includes('--run') || args.includes('--enable'),
        targetDir: dir || undefined,
      });
      return render(args, 'Zavorth plugins create', [created.formatText()], { ok: created.ok, result: created });
    }
    if (!args.includes('--yes') && !args.includes('--dry-run')) {
      return render(
        args,
        'Zavorth plugins create',
        [
          `Preview create: ${id}`,
          `kind: ${kind}`,
          dir ? `dir: ${dir}` : `dir: ./${id} (default)`,
          'Add --yes to write scaffold files (or --dry-run).',
          'Standalone: node bin/create-zavorth-plugin.js <id> --kind <kind>',
        ],
        { dryRun: true, id, kind, dir: dir || null },
      );
    }
    const result = await runProcess(process.execPath, [cliPath, ...createArgs], root, 60000);
    return render(
      args,
      'Zavorth plugins create',
      [result.exitCode === 0 ? `Created plugin scaffold: ${id}` : `Create failed: ${id}`, result.output.slice(0, 1200)],
      { ok: result.exitCode === 0, result },
    );
  }
  if (action === 'permissions') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected)
      return render(args, 'Zavorth plugin permissions', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(args, 'Zavorth plugin permissions', pluginPermissionLines(selected), {
      plugin: sanitizePluginRecord(selected),
    });
  }
  if (action === 'hooks') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected)
      return render(args, 'Zavorth plugin hooks', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const hooks = (selected.hooks || {}) as JsonObject;
    return render(
      args,
      'Zavorth plugin hooks',
      Object.keys(hooks).length
        ? Object.entries(hooks).map(([name, command]) => `${name}: ${String(command)}`)
        : ['No lifecycle hooks declared.'],
      { hooks },
    );
  }
  if (action === 'run-hook') {
    const id = args[1] || readFlag(args, 'id') || '';
    const hook = args[2] || readFlag(args, 'hook') || '';
    const selected = findPlugin(local, id);
    if (!selected)
      return render(args, 'Zavorth plugin hook', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const command = String(((selected.hooks || {}) as JsonObject)[hook] || '');
    if (!command) return render(args, 'Zavorth plugin hook', [`Hook not found: ${hook || '<missing>'}`], { ok: false });
    if (!args.includes('--yes'))
      return render(
        args,
        'Zavorth plugin hook',
        [`Hook preview: ${hook}`, `Command: ${command}`, 'Add --yes to run this hook in the plugin sandbox.'],
        { dryRun: true, plugin: sanitizePluginRecord(selected), hook, command },
      );
    const result = await runPluginHook(root, selected, command);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), {
      id: idWithTime('plugin-receipt'),
      pluginId: selected.id,
      hook,
      status: result.exitCode === 0 ? 'completed' : 'failed',
      createdAt: new Date().toISOString(),
      durationMs: result.durationMs,
    });
    return render(
      args,
      'Zavorth plugin hook',
      [`Hook ${result.exitCode === 0 ? 'completed' : 'failed'}: ${hook}`, result.output.slice(0, 800)],
      { result },
    );
  }
  if (['enable', 'disable'].includes(action)) {
    const id = args[1];
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    if (action === 'enable' && !args.includes('--yes')) {
      return render(
        args,
        'Zavorth plugins',
        [
          `Enable preview: ${id}`,
          ...pluginPermissionLines(selected),
          'Add --yes to enable this plugin in runtime state.',
        ],
        { dryRun: true, plugin: sanitizePluginRecord(selected) },
      );
    }
    selected.enabled = action === 'enable';
    selected.updatedAt = new Date().toISOString();
    await writeJson(pluginFile, local);
    await writePluginRuntimeState(runtimeFile, local);
    try {
      const current = bridge.resolve(String(selected.id));
      if (action === 'enable' && !current.installed) {
        bridge.markInstalled({
          pluginId: String(selected.id),
          revision: selected.version ? String(selected.version) : null,
          sourceLocator: selected.spec ? String(selected.spec) : null,
          sourceDigest: selected.checksum ? String(selected.checksum) : null,
          trust: 'review',
          enable: true,
        });
      } else {
        bridge.setEnabled(String(selected.id), action === 'enable');
      }
      bridge.syncRuntimeIndex();
    } catch {
      /* soft-fail bridge sync */
    }
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), {
      id: idWithTime('plugin-receipt'),
      pluginId: selected.id,
      action,
      createdAt: new Date().toISOString(),
    });
    return render(args, 'Zavorth plugins', [`${action === 'enable' ? 'Enabled' : 'Disabled'}: ${id}`], {
      plugin: sanitizePluginRecord(selected),
      bridged: bridge.resolve(String(selected.id)),
    });
  }

  let discoverySummary: JsonObject | null = null;
  let discoveryLines: string[] = [];
  let bridgedList = bridge.list();
  try {
    const discovery = new PluginDiscoveryService({
      projectRoot: root,
      stateLookup: bridge.asStateLookup(),
    });
    const snapshot = discovery.discover();
    discoverySummary = snapshot.summary as unknown as JsonObject;
    discoveryLines = snapshot.plugins
      .filter((plugin) => plugin.selected)
      .slice(0, 15)
      .map((plugin) => {
        const bridged = bridge.resolve(plugin.pluginId);
        return `- os:${plugin.pluginId} valid=${plugin.validation.ok} eligible=${plugin.loadEligible} trust=${bridged.trust} enabled=${bridged.enabled} state=${bridged.runtimeState}`;
      });
  } catch {
    discoveryLines = [];
  }

  return render(
    args,
    'Zavorth plugins',
    [
      `package dependencies: ${deps.length}`,
      `local plugin records: ${local.length}`,
      ...local
        .slice(0, 10)
        .map(
          (item) =>
            `- ${String((item as JsonObject).id || (item as JsonObject).name)} | ${String((item as JsonObject).status || 'registered')} | ${Boolean((item as JsonObject).enabled) ? 'enabled' : 'disabled'}`,
        ),
      ...(discoveryLines.length ? ['', 'Plugin OS discovery:', ...discoveryLines] : []),
    ],
    {
      dependencies: deps.length,
      plugins: local.map(sanitizePluginRecord),
      os: discoverySummary,
      bridged: bridgedList,
    },
  );
}

async function resolvePluginManifest(root: string, spec: string, args: string[]): Promise<JsonObject> {
  const candidates: string[] = [];
  const explicit = readFlag(args, 'manifest');
  if (explicit) candidates.push(explicit);
  if (isLocalPluginSpec(root, spec)) {
    const base = resolvePluginPath(root, spec);
    candidates.push(
      path.join(base, 'manifest.json'),
      path.join(base, 'zavorth.plugin.json'),
      path.join(base, 'plugin.json'),
    );
  }
  for (const manifestPath of candidates) {
    if (!manifestPath || !existsSync(manifestPath)) continue;
    const raw = (await readJson(manifestPath, {})) as JsonObject;
    const permissionsRaw = Array.isArray(raw.permissions)
      ? raw.permissions.map((item) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return String((item as JsonObject).kind || '');
          }
          return String(item || '');
        })
      : raw.permissions;
    return {
      found: true,
      path: manifestPath,
      name: raw.label || raw.name || raw.id || idFromSpec(spec),
      version: raw.version || '0.0.0',
      entry:
        (raw.entrypoint && typeof raw.entrypoint === 'object' ? (raw.entrypoint as JsonObject).module : null) ||
        raw.entry ||
        raw.main ||
        null,
      permissions: normalizePermissions(permissionsRaw),
      hooks: raw.hooks && typeof raw.hooks === 'object' ? raw.hooks : {},
      sandbox:
        raw.sandbox && typeof raw.sandbox === 'object'
          ? raw.sandbox
          : pluginSandboxForPermissions(normalizePermissions(permissionsRaw)),
      signature: raw.signature || null,
      schemaVersion: raw.schemaVersion || null,
    };
  }
  return {
    found: false,
    name: idFromSpec(spec),
    version: '0.0.0',
    entry: null,
    permissions: normalizePermissions(readFlag(args, 'permissions') || ''),
    hooks: {},
    sandbox: pluginSandboxForPermissions(normalizePermissions(readFlag(args, 'permissions') || '')),
    signature: readFlag(args, 'signature') || null,
  };
}
