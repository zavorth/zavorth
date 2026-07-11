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
  hermeticOk: boolean;
  liveOk: boolean;
  ok: boolean;
  blockedOnly: boolean;
  claimsLiveIntelligence: false;
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
    const liveRequested = Boolean(
      input.live
      || env.ZAVORTH_LIVE_SMARTNESS === '1'
      || env.ZAVORTH_LIVE_SMARTNESS === 'true',
    );

    const hermetic = await new AgentSmartnessService({
      profileDir: path.join(root, 'config', 'profile-manifests'),
    }).run();

    const live: LiveSmartnessMissionResult[] = [];
    if (!liveRequested) {
      live.push({
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: 'blocked',
        notes: 'Live not requested. Re-run with --live or ZAVORTH_LIVE_SMARTNESS=1 and a configured provider key.',
        evidence: { liveRequested: false },
      });
      live.push({
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'blocked',
        notes: 'Blocked until a live multi-step harness is run with an LLM and tools.',
        evidence: { liveRequested: false },
      });
    } else {
      live.push(this.runLiveLlmProbe(root, env));
      live.push(this.runLiveMultiStepCheck(live[0]));
    }

    const liveFailed = live.some((entry) => entry.status === 'fail');
    const blockedOnly = live.every((entry) => entry.status === 'blocked') && hermetic.ok;
    const hermeticOk = hermetic.ok;
    const liveOkStrict = liveRequested
      && !liveFailed
      && live.some((entry) => entry.id === 'live.llm.probe' && entry.status === 'pass');

    return {
      generatedAt: now().toISOString(),
      version: 'agent-smartness-live/v1',
      hermetic,
      liveRequested,
      live,
      hermeticOk,
      liveOk: liveOkStrict,
      ok: hermeticOk && !liveFailed && (!liveRequested || liveOkStrict),
      blockedOnly,
      claimsLiveIntelligence: false,
    };
  }

  public renderText(report: LiveSmartnessReport): string {
    return [
      'Zavorth Agent Smartness (hermetic unit + optional live probe)',
      `hermetic: ${report.hermetic.passed}/${report.hermetic.total} mode=${report.hermetic.mode}`,
      `claimsLiveIntelligence: ${report.claimsLiveIntelligence}`,
      `live requested: ${report.liveRequested ? 'yes' : 'no'}`,
      `hermeticOk: ${report.hermeticOk ? 'yes' : 'no'} | liveOk: ${report.liveOk ? 'yes' : 'no'} | ok: ${report.ok ? 'yes' : 'no'}`,
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

    if (!hasGemini) {
      return {
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: 'blocked',
        notes: 'Automated live probe requires GEMINI_API_KEY. Other keys need a manual chat first-win.',
        evidence: { hasOpenAi, hasAnthropic },
      };
    }

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
    const exact = /ZAVORTH_LIVE_OK/.test(output);
    const pass = result.status === 0 && exact;
    return {
      id: 'live.llm.probe',
      name: 'Live LLM probe',
      status: pass
        ? 'pass'
        : (result.status === 1 && /no gemini key/i.test(output) ? 'blocked' : 'fail'),
      notes: pass
        ? 'Live Gemini probe returned exact token ZAVORTH_LIVE_OK.'
        : (output.slice(0, 240) || `exit=${result.status}`),
      evidence: {
        exitCode: result.status,
        exactToken: exact,
        outputPreview: output.slice(0, 400).replace(/key=[^&\s]+/gi, 'key=REDACTED'),
      },
    };
  }

  private runLiveMultiStepCheck(probe: LiveSmartnessMissionResult): LiveSmartnessMissionResult {
    if (probe.status === 'blocked') {
      return {
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'blocked',
        notes: 'Blocked until live LLM probe passes and a multi-step tool harness exists.',
        evidence: { dependsOn: probe.id, probeStatus: probe.status },
      };
    }
    if (probe.status === 'fail') {
      return {
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'fail',
        notes: 'Live probe failed; multi-step tool plan not attempted.',
        evidence: { dependsOn: probe.id, probeStatus: probe.status },
      };
    }
    return {
      id: 'live.multi-step.tool-plan',
      name: 'Live multi-step tool plan',
      status: 'blocked',
      notes: 'Live probe passed. Multi-step tool-use is not auto-certified yet — run killer missions / desktop first-ask manually.',
      evidence: {
        autoCertified: false,
        next: [
          'npm run value:killer -- --audience=developer',
          'Paste mission prompt in Desktop chat after provider setup',
        ],
      },
    };
  }
}
