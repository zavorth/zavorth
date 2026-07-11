import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AgentSmartnessService, type AgentSmartnessReport } from './AgentSmartnessService.js';

export type LiveSmartnessMissionResult = {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'blocked';
  notes: string;
  evidence: Record<string, unknown>;
};

export type LiveSmartnessReport = {
  generatedAt: string;
  version: 'agent-smartness-live/v1';
  hermetic: AgentSmartnessReport;
  liveRequested: boolean;
  live: LiveSmartnessMissionResult[];
  ok: boolean;
  blockedOnly: boolean;
};

export class AgentSmartnessLiveService {
  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      now?: () => Date;
    } = {},
  ) {}

  public async run(input: { live?: boolean } = {}): Promise<LiveSmartnessReport> {
    const env = this.options.env || process.env;
    const root = this.options.projectRoot || process.cwd();
    const now = this.options.now || (() => new Date());
    const liveRequested = Boolean(input.live || env.ZAVORTH_LIVE_SMARTNESS === '1' || env.ZAVORTH_LIVE_SMARTNESS === 'true');

    const hermetic = await new AgentSmartnessService({
      profileDir: path.join(root, 'config', 'profile-manifests'),
    }).run();

    const live: LiveSmartnessMissionResult[] = [];
    if (!liveRequested) {
      live.push({
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: 'blocked',
        notes: 'Live not requested. Re-run with --live or ZAVORTH_LIVE_SMARTNESS=1 and a provider key.',
        evidence: { liveRequested: false },
      });
      live.push({
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'blocked',
        notes: 'Blocked until live LLM is enabled.',
        evidence: { liveRequested: false },
      });
    } else {
      live.push(this.runLiveLlmProbe(root, env));
      live.push(this.runLiveMultiStepCheck(root, env, live[0]));
    }

    const liveFailed = live.some((entry) => entry.status === 'fail');
    const blockedOnly = live.every((entry) => entry.status === 'blocked') && hermetic.ok;
    return {
      generatedAt: now().toISOString(),
      version: 'agent-smartness-live/v1',
      hermetic,
      liveRequested,
      live,
      ok: hermetic.ok && !liveFailed,
      blockedOnly,
    };
  }

  public renderText(report: LiveSmartnessReport): string {
    return [
      'Zavorth Agent Smartness (hermetic + live)',
      `hermetic: ${report.hermetic.passed}/${report.hermetic.total} (simulated=${report.hermetic.simulated})`,
      `live requested: ${report.liveRequested ? 'yes' : 'no'}`,
      `ok: ${report.ok ? 'yes' : 'no'}`,
      '',
      '[live]',
      ...report.live.map((entry) => `- [${entry.status}] ${entry.id}: ${entry.notes}`),
    ].join('\n');
  }

  private runLiveLlmProbe(root: string, env: NodeJS.ProcessEnv): LiveSmartnessMissionResult {
    const hasGemini = String(env.GEMINI_API_KEY || '').trim().length >= 12;
    const hasOpenAi = String(env.OPENAI_API_KEY || '').trim().length >= 12;
    const hasAnthropic = String(env.ANTHROPIC_API_KEY || '').trim().length >= 12;
    if (!hasGemini && !hasOpenAi && !hasAnthropic) {
      return {
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: 'blocked',
        notes: 'No provider key found (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY).',
        evidence: { hasGemini, hasOpenAi, hasAnthropic },
      };
    }

    if (hasGemini) {
      const probe = path.join(root, 'scripts', 'probe-live-llm.mjs');
      if (!fs.existsSync(probe)) {
        return {
          id: 'live.llm.probe',
          name: 'Live LLM probe',
          status: 'fail',
          notes: 'probe-live-llm.mjs missing.',
          evidence: { probe },
        };
      }
      const result = spawnSync(process.execPath, [probe], {
        cwd: root,
        encoding: 'utf8',
        env: { ...env },
        timeout: 60000,
        windowsHide: true,
      });
      const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
      const pass = result.status === 0 && /ZAVORTH_LIVE_OK|pass|ok/i.test(output);
      return {
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: pass ? 'pass' : (result.status === 1 && /no gemini key/i.test(output) ? 'blocked' : 'fail'),
        notes: pass ? 'Live Gemini probe returned success token.' : (output.slice(0, 240) || `exit=${result.status}`),
        evidence: { exitCode: result.status, outputPreview: output.slice(0, 400) },
      };
    }

    return {
      id: 'live.llm.probe',
      name: 'Live LLM probe',
      status: 'blocked',
      notes: 'Non-Gemini keys present; automated live probe currently uses Gemini via dogfood:live:llm. Configure GEMINI_API_KEY or run a manual chat first-win.',
      evidence: { hasOpenAi, hasAnthropic },
    };
  }

  private runLiveMultiStepCheck(
    root: string,
    env: NodeJS.ProcessEnv,
    probe: LiveSmartnessMissionResult,
  ): LiveSmartnessMissionResult {
    if (probe.status !== 'pass') {
      return {
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: probe.status === 'blocked' ? 'blocked' : 'fail',
        notes: 'Requires a passing live LLM probe first.',
        evidence: { dependsOn: probe.id, probeStatus: probe.status },
      };
    }

    const demo = path.join(root, 'assets', 'zavorth-demo', 'index.html');
    const killer = path.join(root, 'docs', 'product', 'demo-scripts.md');
    const hasAssets = fs.existsSync(demo) && fs.existsSync(killer);
    return {
      id: 'live.multi-step.tool-plan',
      name: 'Live multi-step tool plan',
      status: hasAssets ? 'pass' : 'fail',
      notes: hasAssets
        ? 'Live probe OK. Use killer missions / desktop first-ask for full multi-step operator verification.'
        : 'Live probe OK but demo assets missing.',
      evidence: {
        demoExists: fs.existsSync(demo),
        demoScriptsExist: fs.existsSync(killer),
        next: 'npm run value:killer -- --audience developer',
      },
    };
  }
}
