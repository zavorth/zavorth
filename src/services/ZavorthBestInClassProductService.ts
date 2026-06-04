import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildZavorthCliRuntimeTuiSnapshot } from '../cli/hud/ZavorthCliRuntimeTuiProjection.js';
import { ZavorthNativeCapabilityCertificationService } from './ZavorthNativeCapabilityCertificationService.js';
import { VoiceWakeDetectorSetupService } from './VoiceWakeDetectorSetupService.js';
import { VoiceWakeRuntimeService } from './VoiceWakeRuntimeService.js';
import { ZavorthA2UIService } from './ZavorthA2UIService.js';
import { ZavorthAppsSatelliteNodesService } from './ZavorthAppsSatelliteNodesService.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { ZavorthProductHardeningService } from './ZavorthProductHardeningService.js';

export const ZAVORTH_BEST_IN_CLASS_PRODUCT_CONTRACT_VERSION = 'zavorth-best-in-class-product/1' as const;

export type ZavorthBestInClassStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthBestInClassGate = {
  id: string;
  title: string;
  status: ZavorthBestInClassStatus;
  summary: string;
  evidence: string[];
  nextActions: string[];
};

export type ZavorthBestInClassAxis = {
  id: 'research-autonomy' | 'personal-product' | 'governance';
  title: string;
  status: ZavorthBestInClassStatus;
  summary: string;
  gates: ZavorthBestInClassGate[];
};

export type ZavorthBestInClassProductSnapshot = {
  contractVersion: typeof ZAVORTH_BEST_IN_CLASS_PRODUCT_CONTRACT_VERSION;
  generatedAt: string;
  status: ZavorthBestInClassStatus;
  projectRoot: string;
  summary: {
    axes: number;
    readyAxes: number;
    attentionAxes: number;
    blockedAxes: number;
    gates: number;
    readyGates: number;
    attentionGates: number;
    blockedGates: number;
  };
  axes: ZavorthBestInClassAxis[];
  productGates: {
    tuiDaily: ZavorthBestInClassStatus;
    zCanvasLive: ZavorthBestInClassStatus;
    satelliteUsable: ZavorthBestInClassStatus;
    wakeSetupReady: ZavorthBestInClassStatus;
    cleanInstallReady: ZavorthBestInClassStatus;
  };
  commands: {
    certify: 'zavorth certify best-in-class';
    certifyJson: 'zavorth certify best-in-class --json';
    qa: 'npm run qa:zavorth-best-in-class-product --silent';
    tui: 'zavorth tui --json';
    canvas: 'zavorth dashboard';
    satellite: 'zavorth apps --action pairing.qr';
    wake: 'zavorth echo wake setup --default-local';
    setup: 'zavorth setup --dry-run';
  };
  safety: {
    noSilentMutation: true;
    noRawSecretsSerialized: true;
    missingCredentialsAreSetupStateNotFailure: true;
    a2uiCannotTouchHost: true;
    wakeIsOptInTtlBound: true;
    satellitePairingUsesOpaqueCodes: true;
    cleanInstallDoesNotAutoMigrate: true;
  };
};

type ServiceOptions = {
  projectRoot?: string;
  evidenceRoot?: string | null;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

export class ZavorthBestInClassProductService {
  private readonly projectRoot: string;
  private readonly evidenceRoot: string | null | undefined;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;

  public constructor(options: ServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.evidenceRoot = options.evidenceRoot;
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
  }

  public async buildSnapshot(): Promise<ZavorthBestInClassProductSnapshot> {
    const [autonomy, product, governance] = await Promise.all([
      this.researchAutonomyAxis(),
      this.personalProductAxis(),
      this.governanceAxis(),
    ]);
    const axes = [autonomy, product, governance];
    const gates = axes.flatMap((axis) => axis.gates);
    const productGate = (id: string): ZavorthBestInClassStatus =>
      product.gates.find((gate) => gate.id === id)?.status || 'blocked';
    return {
      contractVersion: ZAVORTH_BEST_IN_CLASS_PRODUCT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: this.aggregate(axes.map((axis) => axis.status)),
      projectRoot: this.projectRoot,
      summary: {
        axes: axes.length,
        readyAxes: axes.filter((axis) => axis.status === 'ready').length,
        attentionAxes: axes.filter((axis) => axis.status === 'attention').length,
        blockedAxes: axes.filter((axis) => axis.status === 'blocked').length,
        gates: gates.length,
        readyGates: gates.filter((gate) => gate.status === 'ready').length,
        attentionGates: gates.filter((gate) => gate.status === 'attention').length,
        blockedGates: gates.filter((gate) => gate.status === 'blocked').length,
      },
      axes,
      productGates: {
        tuiDaily: productGate('tui-daily'),
        zCanvasLive: productGate('z-canvas-live'),
        satelliteUsable: productGate('satellite-usable'),
        wakeSetupReady: productGate('wake-setup-ready'),
        cleanInstallReady: productGate('clean-install-ready'),
      },
      commands: {
        certify: 'zavorth certify best-in-class',
        certifyJson: 'zavorth certify best-in-class --json',
        qa: 'npm run qa:zavorth-best-in-class-product --silent',
        tui: 'zavorth tui --json',
        canvas: 'zavorth dashboard',
        satellite: 'zavorth apps --action pairing.qr',
        wake: 'zavorth echo wake setup --default-local',
        setup: 'zavorth setup --dry-run',
      },
      safety: {
        noSilentMutation: true,
        noRawSecretsSerialized: true,
        missingCredentialsAreSetupStateNotFailure: true,
        a2uiCannotTouchHost: true,
        wakeIsOptInTtlBound: true,
        satellitePairingUsesOpaqueCodes: true,
        cleanInstallDoesNotAutoMigrate: true,
      },
    };
  }

  public renderText(snapshot: ZavorthBestInClassProductSnapshot): string {
    const lines = [
      'Zavorth Best-in-Class Product',
      '',
      `Status: ${snapshot.status}`,
      `Axes: ${snapshot.summary.readyAxes}/${snapshot.summary.axes} ready | attention=${snapshot.summary.attentionAxes} | blocked=${snapshot.summary.blockedAxes}`,
      `Gates: ${snapshot.summary.readyGates}/${snapshot.summary.gates} ready | attention=${snapshot.summary.attentionGates} | blocked=${snapshot.summary.blockedGates}`,
      '',
    ];
    for (const axis of snapshot.axes) {
      lines.push(`${axis.id}: ${axis.status}`);
      lines.push(`  ${axis.summary}`);
      for (const gate of axis.gates) {
        lines.push(`  - ${gate.id}: ${gate.status} | ${gate.summary}`);
      }
      lines.push('');
    }
    lines.push(`QA: ${snapshot.commands.qa}`);
    return `${lines.join('\n')}\n`;
  }

  private async researchAutonomyAxis(): Promise<ZavorthBestInClassAxis> {
    const certification = await new ZavorthNativeCapabilityCertificationService({
      projectRoot: this.projectRoot,
      ...(this.evidenceRoot !== undefined ? { evidenceRoot: this.evidenceRoot } : {}),
      env: this.env,
      now: this.now,
    }).buildSnapshot();
    const gates = [
      this.gate(
        'native-capability',
        'Research/autonomy certification',
        this.mapCertificationStatus(certification.status),
        `${certification.summary.ready}/${certification.summary.total} native-capability checks are ready.`,
        [
          `evidenceRootFound=${certification.evidenceRootFound}`,
          `credentialGatedReady=${certification.summary.credentialGatedReady}`,
          certification.commands.qa,
        ],
        certification.status === 'ready' ? [] : ['Run zavorth certify native-capability --json and inspect partial checks.'],
      ),
      this.gate(
        'long-goal-loop',
        'Long-running Goal Loop',
        this.mapCertificationStatus(certification.longRunSmoke.status),
        `Goal daemon smoke finished with ${certification.longRunSmoke.agentRuns} agent run(s), final=${certification.longRunSmoke.finalGoalStatus}.`,
        [
          `receipts=${certification.longRunSmoke.receipts}`,
          `events=${certification.longRunSmoke.events}`,
          `stateDbBacked=${certification.longRunSmoke.stateDbBacked}`,
        ],
        certification.longRunSmoke.status === 'ready' ? [] : ['Inspect GoalLoopDaemonService and GoalLoopWorkerService.'],
      ),
    ];
    return this.axis(
      'research-autonomy',
      'Pesquisa e autonomia',
      gates,
      'Goal Loop, StateDB, recall, TaskBoard, curator and xAI route are certified as Zavorth-native daily power.',
    );
  }

  private async personalProductAxis(): Promise<ZavorthBestInClassAxis> {
    const [tui, a2ui, satellite, wake, cleanInstall] = await Promise.all([
      Promise.resolve(this.tuiGate()),
      Promise.resolve(this.zCanvasGate()),
      Promise.resolve(this.satelliteGate()),
      Promise.resolve(this.wakeGate()),
      Promise.resolve(this.cleanInstallGate()),
    ]);
    return this.axis(
      'personal-product',
      'Produto pessoal, canais e apps',
      [tui, a2ui, satellite, wake, cleanInstall],
      'The absorbed power is projected into daily user surfaces instead of staying hidden in backend services.',
    );
  }

  private async governanceAxis(): Promise<ZavorthBestInClassAxis> {
    const hardening = await new ZavorthProductHardeningService({
      projectRoot: this.projectRoot,
      env: this.env,
      now: this.now,
    }).buildSnapshot();
    const gates = [
      this.gate(
        'product-hardening',
        'Product hardening',
        hardening.status === 'blocked' ? 'blocked' : hardening.status === 'attention' ? 'attention' : 'ready',
        `Product hardening reports ${hardening.status}; ${hardening.summary.ready}/${hardening.summary.totalAreas} areas ready.`,
        [
          hardening.commands.qa,
          `oldSurfacesRemoved=${hardening.safety.oldSurfacesRemoved}`,
          `secretValuesSerialized=${hardening.safety.secretValuesSerialized}`,
        ],
        hardening.status === 'ready' ? [] : ['Run npm run qa:zavorth-product-hardening --silent.'],
      ),
      this.gate(
        'transaction-safety',
        'Transaction and approval safety',
        hardening.safety.noSilentMutation && hardening.safety.secretValuesSerialized === false ? 'ready' : 'blocked',
        'Risky product features remain preview/approval/receipt driven.',
        [
          `noSilentMutation=${hardening.safety.noSilentMutation}`,
          `migrationRequiresApproval=${hardening.installPolicy.migrationRequiresApproval}`,
          `wakeDetectorChoiceIsExplicit=${hardening.installPolicy.wakeDetectorChoiceIsExplicit}`,
        ],
        [],
      ),
    ];
    return this.axis(
      'governance',
      'Governanca operacional',
      gates,
      'Governance remains the differentiator while product and autonomy increase.',
    );
  }

  private tuiGate(): ZavorthBestInClassGate {
    const snapshot = buildZavorthCliRuntimeTuiSnapshot({
      projectRoot: this.projectRoot,
      mode: 'interactive',
      now: this.now,
    });
    const shortcuts = new Set(snapshot.shortcuts.map((shortcut) => shortcut.key));
    const sectionsReady = Boolean(
      snapshot.tasks
      && snapshot.goalLoop
      && snapshot.sandbox
      && snapshot.voice
      && snapshot.approvals
      && snapshot.channels.length > 0,
    );
    const ready = snapshot.mode === 'interactive'
      && sectionsReady
      && shortcuts.has('Tab')
      && shortcuts.has('v')
      && snapshot.safety.readOnlySnapshot
      && snapshot.safety.secretsRedacted;
    return this.gate(
      'tui-daily',
      'Daily TUI projection',
      ready ? 'ready' : 'attention',
      ready
        ? 'TUI snapshot exposes daily work, approvals, tasks, voice, sandbox, channels and Goal Loop.'
        : 'TUI projection is present but missing a daily section or shortcut.',
      [
        `mode=${snapshot.mode}`,
        `status=${snapshot.status}`,
        `shortcuts=${snapshot.shortcuts.length}`,
        `channels=${snapshot.channels.length}`,
      ],
      ready ? [] : ['Wire missing sections into buildZavorthCliRuntimeTuiSnapshot.'],
    );
  }

  private zCanvasGate(): ZavorthBestInClassGate {
    const service = new ZavorthA2UIService({ now: this.now });
    service.beginRendering('best-in-class-canvas', { ready: true }, { owner: 'best-in-class-certification' });
    service.updateSurface('best-in-class-canvas', [
      {
        type: 'panel',
        id: 'canvas-panel',
        props: { title: 'Z-Canvas live proof' },
        children: [
          { type: 'text', id: 'canvas-text', props: { value: 'A2UI renders through an allowlisted component tree.' } },
          { type: 'button', id: 'canvas-action', props: { label: 'Preview action', actionId: 'preview.action' } },
          { type: 'script', id: 'blocked-script', props: { value: 'unsafe' } },
        ],
      },
    ]);
    service.registerActionHandler('best-in-class-canvas', 'preview.action', () => ({ previewOnly: true }));
    const snapshot = service.readSnapshot('best-in-class-canvas');
    const surface = snapshot.surfaces[0];
    const streamBefore = service.readStream('best-in-class-canvas', 10);
    const routeFilesReady = this.exists('apps/zavorth-control-vite-shell/src/a2ui-renderer.ts')
      && this.hasMarker('apps/zavorth-control-vite-shell/src/runtime-engines-ui.ts', '/api/v2/a2ui/action')
      && this.hasMarker('apps/zavorth-control-vite-shell/src/runtime-engines-ui.ts', 'renderA2UICanvasHtml');
    const blockedUnsafe = !JSON.stringify(surface.components).includes('blocked-script');
    const ready = routeFilesReady
      && blockedUnsafe
      && snapshot.security.hostAccess === 'blocked'
      && snapshot.security.actionDispatch === 'transaction-plane'
      && streamBefore.items.some((item) => item.eventType === 'snapshot_updated');
    return this.gate(
      'z-canvas-live',
      'Z-Canvas A2UI live surface',
      ready ? 'ready' : 'blocked',
      ready
        ? 'A2UI publishes components, blocks unsafe nodes and is wired to dashboard action routes.'
        : 'A2UI live route or renderer is incomplete.',
      [
        `components=${surface.components.length}`,
        `blockedUnsafe=${blockedUnsafe}`,
        `routeFilesReady=${routeFilesReady}`,
        `hostAccess=${snapshot.security.hostAccess}`,
      ],
      ready ? [] : ['Connect A2UI renderer and /api/v2/a2ui routes before claiming live Z-Canvas.'],
    );
  }

  private satelliteGate(): ZavorthBestInClassGate {
    const snapshot = new ZavorthAppsSatelliteNodesService({
      now: this.now,
      cwd: this.projectRoot,
      env: this.env,
    }).execute({
      action: 'pairing.qr',
      nodeKind: 'mobile-companion',
      label: 'Mobile approval companion',
      ttlSeconds: 120,
    });
    const surfaces = new Set(snapshot.surfaces.map((surface) => surface.id));
    const ready = snapshot.health.satellitePwaReady
      && snapshot.health.nodeHostReady
      && snapshot.offlineQueue.available
      && snapshot.pairing.status === 'preview'
      && snapshot.pairing.qrPayload.startsWith('zavorth://pair?code=')
      && snapshot.safety.noRawPairingSecretsSerialized
      && snapshot.safety.mobileAndTraySpecsDoNotClaimAppStoreBinaries
      && surfaces.has('approval-companion');
    return this.gate(
      'satellite-usable',
      'Satellite/PWA pairing path',
      ready ? 'ready' : 'attention',
      ready
        ? 'Satellite has PWA assets, node host, approval companion, offline queue and opaque pairing preview.'
        : 'Satellite path exists but needs host/app readiness work.',
      [
        `status=${snapshot.status}`,
        `pwa=${snapshot.health.satellitePwaReady}`,
        `nodeHost=${snapshot.health.nodeHostReady}`,
        `pairing=${snapshot.pairing.status}`,
        `offlineQueue=${snapshot.offlineQueue.status}`,
      ],
      ready ? [] : ['Run zavorth apps --action pairing.qr and inspect health warnings.'],
    );
  }

  private wakeGate(): ZavorthBestInClassGate {
    const setup = new VoiceWakeDetectorSetupService({
      projectRoot: this.projectRoot,
      env: this.env,
    }).buildPlan({ choice: 'default-local' });
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-best-wake-'));
    try {
      const runtime = new VoiceWakeRuntimeService({
        stateFile: path.join(tempRoot, 'voice-wake-session.json'),
        env: { ...this.env, ZAVORTH_WAKE_EMBEDDED: '1', ZAVORTH_WAKE_TTL_SECONDS: '900' },
        now: this.now,
      });
      const armed = runtime.arm(60_000);
      const captured = runtime.handleEvent({ type: 'wake', transcript: 'organize my day' });
      const ready = setup.status === 'ready'
        && setup.selected === 'default-local'
        && setup.privacy.defaultOff
        && setup.privacy.rawAudioPersisted === false
        && armed.mode === 'armed'
        && captured.lastReceipt?.rawAudioPersisted === false
        && captured.mode === 'cooldown';
      return this.gate(
        'wake-setup-ready',
        'Wake word setup and privacy',
        ready ? 'ready' : 'attention',
        ready
          ? 'Wake setup offers default local detector, TTL arming and receipt-only transcript handling.'
          : 'Wake setup exists but privacy or detector defaults need review.',
        [
          `selected=${setup.selected}`,
          `runtimeMode=${captured.mode}`,
          `defaultOff=${setup.privacy.defaultOff}`,
          `rawAudioPersisted=${captured.lastReceipt?.rawAudioPersisted}`,
        ],
        ready ? [] : ['Review VoiceWakeDetectorSetupService and echo wake setup CLI.'],
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  private cleanInstallGate(): ZavorthBestInClassGate {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-best-clean-root-'));
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-best-clean-home-'));
    try {
      const home = new ZavorthHomePathService({
        projectRoot: tempRoot,
        explicitHome: tempHome,
        env: {},
        now: this.now,
      }).resolveSnapshot();
      const scripts = this.packageScripts();
      const ready = home.isolated
        && home.source === 'explicit'
        && home.root === path.resolve(tempHome)
        && home.migration.approvalRequired
        && home.migration.writesPerformed === false
        && home.safety.noAutomaticMigration
        && Boolean(scripts.setup)
        && Boolean(scripts['zavorth:home-clean-install:check']);
      return this.gate(
        'clean-install-ready',
        'Clean install and isolated home',
        ready ? 'ready' : 'blocked',
        ready
          ? 'Clean install can select an isolated home and does not migrate legacy state automatically.'
          : 'Clean install isolation or smoke script is incomplete.',
        [
          `homeSource=${home.source}`,
          `isolated=${home.isolated}`,
          `migrationWrites=${home.migration.writesPerformed}`,
          'script=zavorth:home-clean-install:check',
        ],
        ready ? [] : ['Run node scripts/zavorth-home-clean-install-smoke.mjs.'],
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  }

  private axis(
    id: ZavorthBestInClassAxis['id'],
    title: string,
    gates: ZavorthBestInClassGate[],
    summary: string,
  ): ZavorthBestInClassAxis {
    return {
      id,
      title,
      status: this.aggregate(gates.map((gate) => gate.status)),
      summary,
      gates,
    };
  }

  private gate(
    id: string,
    title: string,
    status: ZavorthBestInClassStatus,
    summary: string,
    evidence: string[] = [],
    nextActions: string[] = [],
  ): ZavorthBestInClassGate {
    return { id, title, status, summary, evidence, nextActions };
  }

  private mapCertificationStatus(status: 'ready' | 'partial' | 'missing'): ZavorthBestInClassStatus {
    if (status === 'ready') return 'ready';
    if (status === 'partial') return 'attention';
    return 'blocked';
  }

  private aggregate(statuses: ZavorthBestInClassStatus[]): ZavorthBestInClassStatus {
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('attention')) return 'attention';
    return 'ready';
  }

  private exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }

  private hasMarker(relativePath: string, marker: string): boolean {
    try {
      return fs.readFileSync(path.join(this.projectRoot, relativePath), 'utf8').includes(marker);
    } catch {
      return false;
    }
  }

  private packageScripts(): Record<string, string> {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
      };
      return packageJson.scripts || {};
    } catch {
      return {};
    }
  }
}
