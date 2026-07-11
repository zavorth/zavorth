import { AgentSmartnessService, type AgentSmartnessReport } from './AgentSmartnessService.js';
import { LiveUserProviderHarness } from './LiveUserProviderHarness.js';
import path from 'node:path';

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
  multiStepOk: boolean;
  ok: boolean;
  blockedOnly: boolean;
  /** True only when live multi-step tool plan actually passed with user provider credentials. */
  claimsLiveIntelligence: boolean;
};

export class AgentSmartnessLiveService {
  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      now?: () => Date;
      harness?: LiveUserProviderHarness;
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
        notes: 'Blocked until a live multi-step harness is run with the user-selected provider and tools.',
        evidence: { liveRequested: false },
      });
    } else {
      const harness = this.options.harness || new LiveUserProviderHarness({
        projectRoot: root,
        env,
      });
      const probe = await harness.runProbe();
      live.push({
        id: 'live.llm.probe',
        name: 'Live LLM probe',
        status: probe.status,
        notes: probe.notes,
        evidence: probe.evidence,
      });
      const multi = await this.runLiveMultiStepCheck(probe, harness);
      live.push(multi);
    }

    const liveFailed = live.some((entry) => entry.status === 'fail');
    const blockedOnly = !liveFailed
      && live.some((entry) => entry.status === 'blocked')
      && hermetic.ok;
    const hermeticOk = hermetic.ok;
    const multiStepOk = live.some(
      (entry) => entry.id === 'live.multi-step.tool-plan' && entry.status === 'pass',
    );
    const liveOkStrict = liveRequested
      && !liveFailed
      && live.some((entry) => entry.id === 'live.llm.probe' && entry.status === 'pass')
      && multiStepOk;

    return {
      generatedAt: now().toISOString(),
      version: 'agent-smartness-live/v1',
      hermetic,
      liveRequested,
      live,
      hermeticOk,
      liveOk: liveOkStrict,
      multiStepOk,
      ok: hermeticOk && !liveFailed && (!liveRequested || liveOkStrict),
      blockedOnly,
      claimsLiveIntelligence: multiStepOk,
    };
  }

  public renderText(report: LiveSmartnessReport): string {
    return [
      'Zavorth Agent Smartness (hermetic unit + optional live user-provider harness)',
      `hermetic: ${report.hermetic.passed}/${report.hermetic.total} mode=${report.hermetic.mode}`,
      `claimsLiveIntelligence: ${report.claimsLiveIntelligence}`,
      `live requested: ${report.liveRequested ? 'yes' : 'no'}`,
      `hermeticOk: ${report.hermeticOk ? 'yes' : 'no'} | liveOk: ${report.liveOk ? 'yes' : 'no'} | multiStepOk: ${report.multiStepOk ? 'yes' : 'no'} | ok: ${report.ok ? 'yes' : 'no'}`,
      '',
      '[live]',
      ...report.live.map((entry) => `- [${entry.status}] ${entry.id}: ${entry.notes}`),
    ].join('\n');
  }

  private async runLiveMultiStepCheck(
    probe: LiveHarnessProbeLike,
    harness: LiveUserProviderHarness,
  ): Promise<LiveSmartnessMissionResult> {
    if (probe.status === 'blocked') {
      return {
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'blocked',
        notes: 'Blocked until live LLM probe can run with a selected/inferred provider and matching key.',
        evidence: { dependsOn: 'live.llm.probe', probeStatus: probe.status },
      };
    }
    if (probe.status === 'fail') {
      return {
        id: 'live.multi-step.tool-plan',
        name: 'Live multi-step tool plan',
        status: 'fail',
        notes: 'Live probe failed; multi-step tool plan not attempted.',
        evidence: { dependsOn: 'live.llm.probe', probeStatus: probe.status },
      };
    }

    const multi = await harness.runMultiStepToolPlan();
    return {
      id: 'live.multi-step.tool-plan',
      name: 'Live multi-step tool plan',
      status: multi.status,
      notes: multi.notes,
      evidence: {
        dependsOn: 'live.llm.probe',
        probeStatus: probe.status,
        ...multi.evidence,
      },
    };
  }
}

type LiveHarnessProbeLike = {
  status: 'pass' | 'fail' | 'blocked';
};
