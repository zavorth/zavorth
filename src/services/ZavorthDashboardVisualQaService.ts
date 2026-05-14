import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthDashboardVisualQaArtifact,
  ZavorthDashboardVisualQaScenario,
  ZavorthDashboardVisualQaSnapshot,
  ZavorthDashboardVisualQaViewport,
} from '../contracts/ZavorthDashboardVisualQaContract.js';
import { ZAVORTH_DASHBOARD_VISUAL_QA_VERSION } from '../contracts/ZavorthDashboardVisualQaContract.js';

type ZavorthDashboardVisualQaRuntime = {
  now?: () => Date;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
};

const VIEWPORTS: ZavorthDashboardVisualQaViewport[] = [
  { id: 'desktop', width: 1440, height: 1000 },
  { id: 'mobile', width: 390, height: 844 },
];

const SCENARIOS: ZavorthDashboardVisualQaScenario[] = [
  {
    id: 'channel-status-and-actions',
    label: 'Channel status/actions',
    route: '/control/review?fixture=all',
    fixture: 'all',
    requiredEvidence: ['channel cards', 'actions', 'status rows', 'empty/error states'],
  },
  {
    id: 'qr-and-auth-states',
    label: 'QR/login and protected states',
    route: '/control/review?fixture=awaiting-approval',
    fixture: 'awaiting-approval',
    requiredEvidence: ['QR/login placeholder', 'auth unlock', 'operator actions'],
  },
  {
    id: 'runtime-live-shell',
    label: 'Live shell without false claims',
    route: '/control/review?fixture=live',
    fixture: 'live',
    requiredEvidence: ['token prompt', 'runtime bridge', 'no fake metrics'],
  },
  {
    id: 'auto-subagent-telemetry',
    label: 'Automatic subagent telemetry',
    route: '/control/review?fixture=auto-subagents',
    fixture: 'auto-subagents',
    requiredEvidence: ['Auto Subagents card', 'roles', 'triggers', 'policy row', 'next safe action'],
  },
];

export class ZavorthDashboardVisualQaService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;

  public constructor(runtime: ZavorthDashboardVisualQaRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  }

  public buildSnapshot(): ZavorthDashboardVisualQaSnapshot {
    const artifacts = this.buildArtifacts();
    const artifactsPresent = artifacts.filter((artifact) => artifact.exists).length;
    const previewExists = artifacts.some((artifact) => artifact.id === 'preview-html' && artifact.exists);
    const evidenceReady = artifacts.every((artifact) => artifact.exists);
    const status = evidenceReady ? 'evidence-ready' : previewExists ? 'plan-ready' : 'blocked';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_DASHBOARD_VISUAL_QA_VERSION,
      status,
      summary: {
        scenarios: SCENARIOS.length,
        viewports: VIEWPORTS.length,
        artifactsPresent,
        artifactsExpected: artifacts.length,
        evidenceReady,
      },
      viewports: VIEWPORTS.slice(),
      scenarios: SCENARIOS.slice(),
      artifacts,
      commands: {
        report: 'npm run zavorth:dashboard-visual-qa',
        json: 'npm run zavorth:dashboard-visual-qa:json',
        check: 'npm run zavorth:dashboard-visual-qa:check',
        preview: 'npm run qa:command-center-browser-preview',
        capture: 'npm run zavorth:dashboard-visual-qa -- --capture',
        nextStep: evidenceReady
          ? 'Attach screenshots to the review cycle before approving a new visual change.'
          : 'Generate preview and screenshots with npm run zavorth:dashboard-visual-qa -- --capture.',
      },
      narrative: {
        headline: 'Verifiable visual QA for the Zavorth dashboard',
        operatorSummary:
          `${artifactsPresent}/${artifacts.length} artifact(s) present for `
          + `${SCENARIOS.length} scenario(s) across ${VIEWPORTS.length} viewport(s).`,
      },
    };
  }

  public renderReport(snapshot: ZavorthDashboardVisualQaSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Dashboard Visual QA',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      '',
      'Scenarios:',
      ...snapshot.scenarios.map((scenario) => `- ${scenario.label}: ${scenario.route}`),
      '',
      'Artifacts:',
      ...snapshot.artifacts.map((artifact) =>
        `- ${artifact.exists ? 'OK' : 'MISS'} ${artifact.id}: ${artifact.path}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private buildArtifacts(): ZavorthDashboardVisualQaArtifact[] {
    const artifacts = [
      this.artifact('preview-html', '.tmp/command-center-browser-preview/index.html', 'html'),
      this.artifact('manifest', '.tmp/zavorth-dashboard-visual-qa/manifest.json', 'json'),
      this.artifact('desktop-screenshot', '.tmp/zavorth-dashboard-visual-qa/desktop.png', 'png'),
      this.artifact('mobile-screenshot', '.tmp/zavorth-dashboard-visual-qa/mobile.png', 'png'),
      this.artifact('auto-subagents-screenshot', '.tmp/zavorth-dashboard-visual-qa/auto-subagents.png', 'png'),
    ];
    return artifacts;
  }

  private artifact(
    id: string,
    relativePath: string,
    type: ZavorthDashboardVisualQaArtifact['type'],
  ): ZavorthDashboardVisualQaArtifact {
    const absolute = path.resolve(this.projectRoot, relativePath);
    return {
      id,
      path: relativePath.replace(/\\/g, '/'),
      type,
      exists: this.existsSync(absolute),
    };
  }
}

export {
  SCENARIOS as ZAVORTH_DASHBOARD_VISUAL_QA_SCENARIOS,
  VIEWPORTS as ZAVORTH_DASHBOARD_VISUAL_QA_VIEWPORTS,
};
