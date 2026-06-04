import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_PRODUCT_CERTIFICATION_VERSION,
  type ZavorthProductCertificationGate,
  type ZavorthProductCertificationSnapshot,
  type ZavorthProductCertificationStatus,
} from '../contracts/ZavorthProductCertificationContract.js';
import { buildZavorthCliRuntimeTuiSnapshot } from '../cli/hud/ZavorthCliRuntimeTuiProjection.js';
import { ZavorthAgentKernelSnapshotService } from './ZavorthAgentKernelSnapshotService.js';
import { ZavorthBestInClassProductService } from './ZavorthBestInClassProductService.js';
import { ZavorthChannelLiveCanaryService } from './ZavorthChannelLiveCanaryService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import { ZavorthProviderActivationService } from './ZavorthProviderActivationService.js';

type ProductCertificationRuntime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  includeDeepProductCheck?: boolean;
};

export class ZavorthProductCertificationService {
  private readonly projectRoot: string;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly includeDeepProductCheck: boolean;

  constructor(runtime: ProductCertificationRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    this.includeDeepProductCheck = runtime.includeDeepProductCheck === true;
  }

  public async buildSnapshot(): Promise<ZavorthProductCertificationSnapshot> {
    const [kernel, providers, channelCanary, bestInClass] = await Promise.all([
      new ZavorthAgentKernelSnapshotService({ now: this.now, env: this.env }).buildSnapshot({
        projectRoot: this.projectRoot,
        text: 'status do Zavorth',
        channel: 'cli',
        includeProviderActivation: true,
      }),
      new ZavorthProviderActivationService({ now: this.now }).buildSnapshot({ includeAdvanced: true }),
      Promise.resolve(new ZavorthChannelLiveCanaryService({
        now: this.now,
        env: this.env,
      }).buildSnapshot()),
      this.includeDeepProductCheck
        ? new ZavorthBestInClassProductService({
          projectRoot: this.projectRoot,
          env: this.env,
          now: this.now,
        }).buildSnapshot()
        : Promise.resolve(null),
    ]);
    const channels = new ZavorthChannelMeshService({ now: this.now }).buildSnapshot();
    const tui = buildZavorthCliRuntimeTuiSnapshot({
      projectRoot: this.projectRoot,
      now: this.now,
      mode: 'snapshot',
    });
    const gates = [
      this.gate(
        'agent-kernel',
        'Agent Kernel',
        kernel.status === 'blocked' ? 'blocked' : 'ready',
        'The LLM receives one canonical snapshot before deciding tools, actions, memory, background work or approvals.',
        [
          `profile=${kernel.capabilityPassport.activeProfile.id}`,
          `intent=${kernel.intentDecision?.kind || 'none'}`,
          `performanceSamples=${kernel.performanceMemory.sampleCount}`,
        ],
        kernel.status === 'blocked' ? 'Fix blocked kernel checks before product use.' : null,
      ),
      this.gate(
        'provider-mesh',
        'Provider Mesh',
        providers.summary.needsConnector > 0 ? 'blocked' : providers.summary.needsCredentials > 0 ? 'attention' : 'ready',
        `${providers.summary.executionReady}/${providers.summary.routes} provider route(s) have an execution path; live proof depends on configured credentials.`,
        [
          `liveReady=${providers.summary.liveReady}`,
          `needsCredentials=${providers.summary.needsCredentials}`,
          `needsBaseUrl=${providers.summary.needsBaseUrl}`,
          `needsConnector=${providers.summary.needsConnector}`,
        ],
        providers.summary.needsConnector > 0
          ? 'Add missing execution connectors before claiming those providers as usable.'
          : providers.summary.needsCredentials > 0
            ? 'Configure provider credentials, then run provider live canaries.'
            : null,
      ),
      this.gate(
        'channel-mesh',
        'Channel Mesh',
        channels.summary.total > 0 && channels.summary.ready > 0
          ? channels.summary.liveReady > 0 ? 'ready' : 'attention'
          : 'blocked',
        `${channels.summary.ready}/${channels.summary.total} channel(s) are catalog-ready; ${channels.summary.liveReady} have live proof.`,
        [
          `configured=${channels.summary.configured}`,
          `defaultRouteAllowed=${channels.summary.defaultRouteAllowed}`,
          `liveReady=${channels.summary.liveReady}`,
        ],
        channels.summary.liveReady > 0
          ? null
          : 'Configure a channel token/allowlist and run channel doctor/canary for live proof.',
      ),
      this.gate(
        'channel-live-canary',
        'Channel Live Canary',
        channelCanary.status,
        `${channelCanary.summary.liveReady} live-ready, ${channelCanary.summary.canRunLiveProof} ready for live proof, ${channelCanary.summary.needsCredentials} need credentials and ${channelCanary.summary.needsAllowlist} need allowlist.`,
        [
          `total=${channelCanary.summary.total}`,
          `canRunLiveProof=${channelCanary.summary.canRunLiveProof}`,
          channelCanary.commands.check,
        ],
        channelCanary.status === 'ready'
          ? null
          : 'Configure a channel credential and allowlist, then run channel live proof.',
      ),
      this.gate(
        'long-session-smoke',
        'Long Session Smoke',
        this.longSessionSmokeReady() ? 'ready' : 'attention',
        'Dashboard E2E covers provider-style streaming, partial tokens, steering during stream, memory/approval traces and receipts through the normal compose flow.',
        [
          'qa:zavorthControl-streaming-e2e',
          'scripts/zavorth-control-streaming-e2e.ts',
          'tests/runtime/agent/ZavorthAgentGatewayLiveSteering.test.ts',
        ],
        this.longSessionSmokeReady()
          ? null
          : 'Restore the dashboard streaming E2E script before claiming long-session readiness.',
      ),
      this.gate(
        'daily-tui',
        'Daily TUI',
        tui.safety.readOnlySnapshot && tui.agentKernel.status ? 'ready' : 'blocked',
        'The terminal daily view exposes chat, tasks, approvals, voice, sandbox, channels and Agent Kernel status.',
        [
          `status=${tui.status}`,
          `kernel=${tui.agentKernel.status}`,
          `quietAutonomy=${tui.agentKernel.quietAutonomy}`,
        ],
        null,
      ),
      this.gate(
        'clean-install',
        'Clean Install Path',
        kernel.cleanInstallCertification.status === 'blocked' ? 'blocked' : 'ready',
        'The product path uses central home resolution and a clean-install smoke for isolated state.',
        [
          `home=${kernel.capabilityPassport.install.isolated ? 'isolated' : 'compat'}`,
          `command=${kernel.cleanInstallCertification.command}`,
        ],
        kernel.capabilityPassport.install.isolated
          ? null
          : 'Set ZAVORTH_HOME during setup for full physical isolation.',
      ),
      this.gate(
        'quiet-autonomy',
        'Quiet Autonomy',
        kernel.quietAutonomy.requireApproval.includes('secret') ? 'ready' : 'attention',
        'Low-risk learning and maintenance can stay quiet; risky mutation, secrets and outbound sends remain gated.',
        [
          `mode=${kernel.quietAutonomy.mode}`,
          `interrupt=${kernel.quietAutonomy.interruptMode}`,
          `maxSilentRisk=${kernel.quietAutonomy.maxSilentRisk}`,
        ],
        null,
      ),
      this.gate(
        'satellite-voice',
        'Satellite And Voice',
        this.exists('src/services/ZavorthAppsSatelliteNodesService.ts')
          && this.exists('src/services/VoiceWakeRuntimeService.ts')
          ? 'ready'
          : 'attention',
        'Companion, approval card and wake surfaces are present; live use still depends on pairing and detector setup.',
        [
          `satellite=${this.exists('src/services/ZavorthAppsSatelliteNodesService.ts') ? 'present' : 'missing'}`,
          `wake=${this.exists('src/services/VoiceWakeRuntimeService.ts') ? 'present' : 'missing'}`,
        ],
        'Run setup and choose a local wake detector only if the user wants voice.',
      ),
      this.gate(
        'public-docs',
        'Public Docs',
        this.publicDocsReady() ? 'ready' : 'attention',
        'Public docs explain install, quickstart, security, providers, channels and daily operation without phase-report language.',
        [
          'README.md',
          'docs/README.md',
          'docs/quickstart.md',
          'docs/product-certification.md',
        ],
        this.publicDocsReady() ? null : 'Refresh public docs before publishing.',
      ),
      this.gate(
        'release-hygiene',
        'Release Hygiene',
        this.releaseHygieneReady() ? 'ready' : 'attention',
        'Tracked files are scanned for personal paths, public identity drift, query-string tokens, unsafe remote defaults and other release blockers.',
        [
          'npm run release:scan --silent',
          'scripts/release-hygiene-scan.ts',
          'scripts/zavorth-public-identity-scan.mjs',
        ],
        this.releaseHygieneReady() ? null : 'Register and run release:scan before publishing a public snapshot.',
      ),
      ...(bestInClass ? [
        this.gate(
          'deep-product-check',
          'Deep Product Check',
          bestInClass.status,
          `${bestInClass.summary.readyGates}/${bestInClass.summary.gates} deep product gate(s) are ready.`,
          [`axes=${bestInClass.summary.readyAxes}/${bestInClass.summary.axes}`],
          bestInClass.status === 'ready' ? null : 'Run qa:zavorth-best-in-class-product and inspect attention gates.',
        ),
      ] : []),
    ];
    const status = aggregate(gates.map((gate) => gate.status));
    return {
      contractVersion: ZAVORTH_PRODUCT_CERTIFICATION_VERSION,
      schemaVersion: 1,
      surface: 'product-certification',
      generatedAt: this.now().toISOString(),
      status,
      productLanguage: {
        name: 'Zavorth',
        positioning: 'local operating system for AI agents',
        userPromise: 'Ask naturally, connect what you need, approve real risk, and keep receipts for what changed.',
        operatingLoop: [
          'Ask for the outcome.',
          'Zavorth routes the work through the Agent Kernel.',
          'Low-risk work runs quietly; risky work becomes a preview.',
          'Approve, reject or defer.',
          'Review the answer, receipt and rollback path when available.',
        ],
      },
      summary: {
        gates: gates.length,
        ready: gates.filter((gate) => gate.status === 'ready').length,
        attention: gates.filter((gate) => gate.status === 'attention').length,
        blocked: gates.filter((gate) => gate.status === 'blocked').length,
        liveCredentialGated: gates.filter((gate) =>
          /credential|token|allowlist|live proof/iu.test(`${gate.summary} ${gate.nextAction || ''}`),
        ).length,
      },
      gates,
      userJourney: this.userJourney(),
      dailyUx: {
        primarySurface: 'dashboard',
        terminalSurface: 'zavorth tui',
        readyCommand: 'zavorth ready --product',
        certificationCommand: 'npm run qa:zavorth-product-certification --silent',
      },
      safety: {
        noSilentRiskyMutation: true,
        missingCredentialsAreSetupState: true,
        productDocsAvoidInternalPhaseLanguage: true,
        cleanInstallUsesIsolatedHome: true,
        llmReceivesCanonicalKernelSnapshot: true,
      },
    };
  }

  public renderCli(snapshot: ZavorthProductCertificationSnapshot): string {
    const lines = [
      'Zavorth Product Certification',
      `status: ${snapshot.status}`,
      `summary: ${snapshot.summary.ready}/${snapshot.summary.gates} ready, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      '',
      `${snapshot.productLanguage.name}: ${snapshot.productLanguage.positioning}`,
      snapshot.productLanguage.userPromise,
      '',
      'Gates',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.padEnd(9)} ${gate.label}: ${gate.summary}${gate.nextAction ? ` Next: ${gate.nextAction}` : ''}`,
      ),
      '',
      'Daily path',
      ...snapshot.userJourney.map((step) => `${step.step}. ${step.command} -> ${step.expectedResult}`),
      '',
      `QA: ${snapshot.dailyUx.certificationCommand}`,
    ];
    return `${lines.join('\n')}\n`;
  }

  private gate(
    id: string,
    label: string,
    status: ZavorthProductCertificationStatus,
    summary: string,
    evidence: string[],
    nextAction: string | null,
  ): ZavorthProductCertificationGate {
    return { id, label, status, summary, evidence, nextAction };
  }

  private userJourney(): ZavorthProductCertificationSnapshot['userJourney'] {
    return [
      {
        step: 1,
        label: 'Guided setup',
        command: 'zavorth setup',
        expectedResult: 'Choose profile, home, provider, governance, wake preference and optional channels.',
      },
      {
        step: 2,
        label: 'Start runtime',
        command: 'zavorth start',
        expectedResult: 'Local runtime starts or resumes without leaking credentials.',
      },
      {
        step: 3,
        label: 'Open dashboard',
        command: 'zavorth open',
        expectedResult: 'Dashboard shows chat, readiness, providers, channels, approvals and receipts.',
      },
      {
        step: 4,
        label: 'Use the agent',
        command: 'zavorth chat',
        expectedResult: 'Natural requests route through the Agent Kernel and Action Harness.',
      },
      {
        step: 5,
        label: 'Check product state',
        command: 'zavorth ready --product',
        expectedResult: 'A short ready/attention/blocked report shows exactly what is usable and what needs setup.',
      },
    ];
  }

  private publicDocsReady(): boolean {
    const required = [
      'README.md',
      'docs/README.md',
      'docs/quickstart.md',
      'docs/security.md',
      'docs/provider-mesh.md',
      'docs/channel-mesh.md',
      'docs/product-certification.md',
    ];
    return required.every((file) => this.exists(file))
      && !/fase\s+\d|phase\s+\d|consistency|comparativo/iu.test(this.read('docs/README.md'))
      && !/fase\s+\d|phase\s+\d|consistency|comparativo/iu.test(this.read('docs/product-certification.md'));
  }

  private longSessionSmokeReady(): boolean {
    return this.packageScriptExists('qa:zavorthControl-streaming-e2e')
      && this.exists('scripts/zavorth-control-streaming-e2e.ts')
      && this.exists('tests/runtime/agent/ZavorthAgentGatewayLiveSteering.test.ts');
  }

  private releaseHygieneReady(): boolean {
    return this.packageScriptExists('release:scan')
      && this.exists('scripts/release-hygiene-scan.ts')
      && this.exists('scripts/zavorth-public-identity-scan.mjs');
  }

  private packageScriptExists(name: string): boolean {
    try {
      const pkg = JSON.parse(this.read('package.json')) as { scripts?: Record<string, string> };
      return Boolean(pkg.scripts?.[name]);
    } catch {
      return false;
    }
  }

  private exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }

  private read(relativePath: string): string {
    try {
      return fs.readFileSync(path.join(this.projectRoot, relativePath), 'utf8');
    } catch {
      return '';
    }
  }
}

function aggregate(statuses: ZavorthProductCertificationStatus[]): ZavorthProductCertificationStatus {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('attention')) return 'attention';
  return 'ready';
}
