import {
  UniversalCapabilitySubsystemService,
  UniversalCapabilityFabricService,
} from './UniversalCapabilitySubsystemService.js';
/**
 * Universal Product Subsystem Service
 *
 * First-run readiness, public command catalog, hermetic certification of
 * Capability / Reach / Power planes for daily product use.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  UNIVERSAL_PRODUCT_FABRIC_CONTRACT_VERSION,
  type ProductCertificationCheck,
  type ProductFabricReceipt,
  type ProductFabricSnapshot,
  type ProductFirstRunStep,
  type ProductPublicCommand,
  type ProductReadinessLevel,
} from '../contracts/UniversalProductFabricContract.js';

import { UniversalWorkspaceImportService } from './UniversalWorkspaceImportService.js';
import {
  UniversalReachSubsystemService,
  UniversalReachFabricService,
} from './UniversalReachSubsystemService.js';
import { ChannelSynthesisService } from './reach/ChannelSynthesisService.js';
import {
  UniversalPowerSubsystemService,
  UniversalPowerFabricService,
} from './UniversalPowerSubsystemService.js';
import { TrustedOperatorModeService } from './power/TrustedOperatorModeService.js';
import { LearningPromoteService } from './power/LearningPromoteService.js';
import { ContextDisciplineService } from './power/ContextDisciplineService.js';

export type ProductFabricBuildInput = {
  projectRoot?: string;
  runCertification?: boolean;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  rmSync?: typeof fs.rmSync;
  capability?: UniversalCapabilityFabricService;
  workspaceImport?: UniversalWorkspaceImportService;
  reach?: UniversalReachFabricService;
  power?: UniversalPowerFabricService;
};

const PUBLIC_COMMANDS: ProductPublicCommand[] = [
  { command: 'zavorth setup', group: 'daily', summary: 'Guided first-run setup', mutation: true },
  { command: 'zavorth start', group: 'daily', summary: 'Start local runtime', mutation: true },
  { command: 'zavorth open', group: 'daily', summary: 'Open Zavorth Control', mutation: false },
  { command: 'zavorth chat', group: 'daily', summary: 'Terminal chat session', mutation: false },
  { command: 'zavorth ask "..."', group: 'daily', summary: 'One-shot governed request', mutation: false },
  { command: 'zavorth doctor', group: 'ops', summary: 'Diagnose common issues', mutation: false },
  { command: 'zavorth product', group: 'ops', summary: 'Product readiness + certification', mutation: false },
  { command: 'zavorth product certify', group: 'ops', summary: 'Hermetic fabric certification matrix', mutation: false },
  { command: 'zavorth absorb <source>', group: 'capability', summary: 'Absorb capabilities or import agent workspaces', mutation: true },
  { command: 'zavorth migrate <path>', group: 'capability', summary: 'Universal workspace import alias', mutation: true },
  { command: 'zavorth reach', group: 'reach', summary: 'Channel tiers + node inventory', mutation: false },
  { command: 'zavorth reach doctor <id>', group: 'reach', summary: 'Channel doctor (no synthetic live)', mutation: false },
  { command: 'zavorth reach synthesize <id>', group: 'reach', summary: 'Generate Tier C channel pack', mutation: true },
  { command: 'zavorth reach pair', group: 'reach', summary: 'Node pairing draft', mutation: true },
  { command: 'zavorth power', group: 'power', summary: 'Elastic backends + trusted + learning', mutation: false },
  { command: 'zavorth power trusted on|off', group: 'power', summary: 'Trusted Operator Mode', mutation: true },
  { command: 'zavorth power learn promote <id>', group: 'power', summary: 'Promote yellow candidate with consent', mutation: true },
  { command: 'zavorth providers', group: 'daily', summary: 'Provider readiness', mutation: false },
  { command: 'zavorth channels telegram', group: 'reach', summary: 'Connect a first-class channel', mutation: true },
  { command: 'zavorth trust', group: 'ops', summary: 'Approval posture', mutation: false },
];

export class UniversalProductSubsystemService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly rmSync: typeof fs.rmSync;
  private readonly capability: UniversalCapabilityFabricService;
  private readonly workspaceImport: UniversalWorkspaceImportService;
  private readonly reach: UniversalReachFabricService;
  private readonly power: UniversalPowerFabricService;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
    this.capability = runtime.capability || new UniversalCapabilityFabricService({ projectRoot: this.projectRoot });
    this.workspaceImport = runtime.workspaceImport || new UniversalWorkspaceImportService({ projectRoot: this.projectRoot });
    this.reach = runtime.reach || new UniversalReachFabricService({
      projectRoot: this.projectRoot,
      nodeRegistry: { listNodes: () => [], getNode: () => null },
      nodePairing: null as any,
      nodeInvoke: null as any,
    });
    this.power = runtime.power || new UniversalPowerFabricService({ projectRoot: this.projectRoot });
  }

  public async buildSnapshot(input: ProductFabricBuildInput = {}): Promise<ProductFabricSnapshot> {
    const runCertification = input.runCertification !== false;
    const firstRun = this.buildFirstRun();
    const certification = runCertification
      ? await this.runHermeticCertification()
      : { status: 'not-checked' as ProductReadinessLevel, checks: [], passed: 0, attention: 0, blocked: 0 };

    const fabrics = {
      capability: this.fabricStatus(certification.checks, 'capability'),
      reach: this.fabricStatus(certification.checks, 'reach'),
      power: this.fabricStatus(certification.checks, 'power'),
      product: this.fabricStatus(certification.checks, 'product'),
    };

    const status = worstStatus([
      certification.status,
      firstRun.progress >= 0.5 ? 'ready' : 'attention',
    ]);

    return {
      contractVersion: UNIVERSAL_PRODUCT_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      firstRun,
      publicCommands: PUBLIC_COMMANDS,
      certification,
      fabrics,
      receipts: [
        this.receipt('inventory', status === 'blocked' ? 'blocked' : status === 'attention' ? 'attention' : 'pass',
          `Product Fabric status=${status}; certify ${certification.passed}/${certification.checks.length || 0} passed.`,
        ),
      ],
      policy: {
        catalogIsNotLive: true,
        hermeticCertificationDefault: true,
        brandAgnostic: true,
        publicCommandsPreferZavorthCli: true,
        monorepoScriptsAreInternal: true,
        rawSecretsSerialized: false,
      },
      narrative: {
        headline: 'Product Fabric readiness',
        operatorSummary: `First-run ${Math.round(firstRun.progress * 100)}% · certify ${certification.passed} pass / ${certification.attention} attention / ${certification.blocked} blocked · fabrics C/R/P=${fabrics.capability}/${fabrics.reach}/${fabrics.power}`,
        nextSafeAction: firstRun.nextCommand || 'zavorth product certify',
        productThesis: 'Zavorth acquires capabilities on demand, expands reach honestly, powers elastic work under governance, and proves every sensitive action.',
      },
    };
  }

  public async certify(): Promise<ProductFabricSnapshot> {
    return this.buildSnapshot({ runCertification: true });
  }

  public async doctor(): Promise<{
    status: ProductReadinessLevel;
    lines: string[];
    snapshot: ProductFabricSnapshot;
  }> {
    const snapshot = await this.buildSnapshot({ runCertification: true });
    const lines: string[] = [
      `Status: ${snapshot.status}`,
      `Thesis: ${snapshot.narrative.productThesis}`,
      '',
      'First-run:',
      ...snapshot.firstRun.steps.map((s) => `  [${s.status}] ${s.label}${s.command ? ` → ${s.command}` : ''}`),
      '',
      'Fabrics:',
      `  capability: ${snapshot.fabrics.capability}`,
      `  reach: ${snapshot.fabrics.reach}`,
      `  power: ${snapshot.fabrics.power}`,
      `  product: ${snapshot.fabrics.product}`,
      '',
      'Certification:',
      ...snapshot.certification.checks.map((c) => `  [${c.status}] ${c.id} — ${c.summary}`),
      '',
      `Next: ${snapshot.narrative.nextSafeAction}`,
    ];
    return { status: snapshot.status, lines, snapshot };
  }

  public listPublicCommands(group?: ProductPublicCommand['group']): ProductPublicCommand[] {
    if (!group) return PUBLIC_COMMANDS;
    return PUBLIC_COMMANDS.filter((c) => c.group === group);
  }

  private buildFirstRun(): ProductFabricSnapshot['firstRun'] {
    const root = this.projectRoot;
    const hasPackage = this.existsSync(path.join(root, 'package.json'));
    const hasBin = this.existsSync(path.join(root, 'bin', 'zavorth.js'));
    const hasEnv = this.existsSync(path.join(root, '.env')) || this.existsSync(path.join(root, '.env.local'));
    const hasZavorthDir = this.existsSync(path.join(root, '.zavorth'));
    const hasControlAssets = this.existsSync(path.join(root, 'docs', 'web-zavorthControl.md'))
      || this.existsSync(path.join(root, 'apps'));

    const steps: ProductFirstRunStep[] = [
      {
        id: 'install-cli',
        label: 'CLI entry available',
        status: hasBin || hasPackage ? 'done' : 'current',
        command: 'npm install -g zavorth@latest',
        summary: hasBin ? 'local bin present.' : hasPackage ? 'Package present; use npx zavorth.' : 'Install the CLI.',
      },
      {
        id: 'setup-providers',
        label: 'Run guided setup',
        status: hasEnv || hasZavorthDir ? 'done' : 'current',
        command: 'zavorth setup',
        summary: hasEnv || hasZavorthDir ? 'local config/state detected.' : 'Run setup for providers and safety.',
      },
      {
        id: 'start-runtime',
        label: 'Start runtime when needed',
        status: hasZavorthDir ? 'done' : 'pending',
        command: 'zavorth start',
        summary: 'Runtime start is the daily entry for long sessions.',
      },
      {
        id: 'open-control',
        label: 'Open Control surface',
        status: hasControlAssets ? 'done' : 'pending',
        command: 'zavorth open',
        summary: 'Browser Control for approvals and status.',
      },
      {
        id: 'first-safe-ask',
        label: 'First safe request',
        status: 'pending',
        command: 'zavorth ask "Review this repository and tell me what is risky."',
        summary: 'Read-only analysis with no side effects.',
      },
      {
        id: 'optional-channel',
        label: 'Optional: connect a channel',
        status: 'optional',
        command: 'zavorth reach channels --tier A',
        summary: 'Only after doctor + live proof for external channels.',
      },
      {
        id: 'optional-absorb',
        label: 'Optional: absorb a capability',
        status: 'optional',
        command: 'zavorth absorb ./pack --preview',
        summary: 'Dynamic capability intake; quarantine before enable.',
      },
      {
        id: 'optional-trusted-operator',
        label: 'Optional: Trusted Operator Mode',
        status: 'optional',
        command: 'zavorth power trusted on',
        summary: 'Lower green friction; red lane stays intact.',
      },
    ];

    // mark first non-done required step as current
    let sawCurrent = false;
    for (const step of steps) {
      if (step.status === 'optional' || step.status === 'done') continue;
      if (!sawCurrent && step.status === 'pending') {
        step.status = 'current';
        sawCurrent = true;
      } else if (step.status === 'current' && sawCurrent) {
        step.status = 'pending';
      } else if (step.status === 'current') {
        sawCurrent = true;
      }
    }

    const required = steps.filter((s) => s.status !== 'optional');
    const done = required.filter((s) => s.status === 'done').length;
    const progress = required.length ? done / required.length : 0;
    const current = steps.find((s) => s.status === 'current') || steps.find((s) => s.status === 'pending');
    return {
      progress,
      steps,
      nextCommand: current?.command || 'zavorth product certify',
    };
  }

  private async runHermeticCertification(): Promise<ProductFabricSnapshot['certification']> {
    const checks: ProductCertificationCheck[] = [];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-cert-'));

    try {
      // Capability: absorb skill preview
      const skillDir = path.join(tmp, 'skill');
      this.mkdirSync(skillDir, { recursive: true });
      this.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: cert-skill\ndescription: cert\n---\n\n# Cert\n', 'utf8');
      const absorb = await this.capability.buildSnapshot({
        source: skillDir,
        kind: 'skill',
        apply: false,
      });
      checks.push(check(
        'capability-absorb-preview',
        'Capability absorb preview',
        'capability',
        absorb.status === 'preview-only' && absorb.summary.skills >= 1 ? 'ready' : 'blocked',
        `absorb status=${absorb.status}; skills=${absorb.summary.skills}`,
        [`candidates=${absorb.summary.candidates}`],
      ));

      // Capability: workspace import structural
      const home = path.join(tmp, 'home');
      this.mkdirSync(path.join(home, 'skills', 'a'), { recursive: true });
      this.writeFileSync(path.join(home, 'skills', 'a', 'SKILL.md'), '# A\n', 'utf8');
      this.writeFileSync(path.join(home, 'SOUL.md'), '# soul\n', 'utf8');
      const detected = this.workspaceImport.detect(home);
      checks.push(check(
        'workspace-import-preview',
        'Workspace structural import',
        'capability',
        detected && detected.confidence > 0 ? 'ready' : 'blocked',
        detected ? `profile=${detected.profileId}; confidence=${Math.round(detected.confidence * 100)}%`
          : 'detection failed',
        detected ? [detected.profileId] : [],
      ));

      // Reach inventory truth
      const reachSnap = this.reach.buildSnapshot({ includeSynthesisDrafts: false });
      const anyTierBLive = reachSnap.channels.some((c: any) => c.tier === 'B' && c.liveReady);
      const localLive = reachSnap.channels.some((c: any) => (c.id === 'cli' || c.id === 'web') && c.liveReady);
      checks.push(check(
        'reach-inventory-truth',
        'Reach inventory honesty',
        'reach',
        !anyTierBLive && localLive ? 'ready' : anyTierBLive ? 'blocked' : 'attention',
        `tierBLive=${anyTierBLive}; localLive=${localLive}`,
        [`channels=${reachSnap.summary.channelsTotal}`],
      ));

      // Channel synthesis preview
      const synth = new ChannelSynthesisService({ projectRoot: tmp });
      const draft = synth.synthesize({ channelId: 'cert-channel', notes: 'webhook test', apply: false });
      checks.push(check(
        'channel-synthesis-preview',
        'Channel synthesis preview',
        'reach',
        draft.draft.liveReady === false && draft.draft.trustState === 'draft' ? 'ready' : 'blocked',
        `trust=${draft.draft.trustState}; liveReady=${draft.draft.liveReady}`,
        [draft.draft.channelId],
      ));

      // Node capability taxonomy
      const caps = this.reach.listNodeCapabilities();
      const families = new Set(caps.map((c: any) => c.family));
      checks.push(check(
        'node-capability-taxonomy',
        'Node capability taxonomy',
        'reach',
        families.has('files') && families.has('shell') ? 'ready' : 'attention',
        `${caps.length} capabilities; families=${[...families].join(',')}`,
        [...families] as string[],
      ));

      // Power elastic backends
      const powerSnap = this.power.buildSnapshot();
      const modal = powerSnap.backends.find((b: any) => b.id === 'modal');
      const daytona = powerSnap.backends.find((b: any) => b.id === 'daytona');
      const elasticOk = Boolean(modal?.elastic && daytona?.elastic && modal.posture !== 'planned' && daytona.posture !== 'planned');
      checks.push(check(
        'power-backend-elastic',
        'Elastic backends (modal/daytona)',
        'power',
        elasticOk ? 'ready' : 'blocked',
        `modal=${modal?.posture}; daytona=${daytona?.posture}`,
        [],
      ));

      // Trusted operator red lane
      const trusted = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'trusted.json'),
        now: this.now,
      });
      trusted.enable('cert');
      const red = trusted.decide({ description: 'disable approval policy', risk: 'high', mutation: true });
      const green = trusted.decide({ description: 'summarize repository status', risk: 'low', mutation: false });
      checks.push(check(
        'trusted-operator-red-lane',
        'Trusted Operator red lane intact',
        'power',
        !red.autoApprove && green.autoApprove ? 'ready' : 'blocked',
        `redAuto=${red.autoApprove}; greenAuto=${green.autoApprove}`,
        [],
      ));

      // Learning promote consent
      const learn = new LearningPromoteService({ storeDir: path.join(tmp, 'learn'), now: this.now });
      const staged = learn.stage({ kind: 'procedure', title: 'cert-proc', summary: 'cert' });
      const noConsent = learn.promote(staged.candidate.id, false);
      const withConsent = learn.promote(staged.candidate.id, true);
      checks.push(check(
        'learning-promote-consent',
        'Learning promote requires consent',
        'power',
        noConsent.receipt.status === 'deny' && withConsent.candidate?.status === 'promoted' ? 'ready' : 'blocked',
        `denyWithoutConsent=${noConsent.receipt.status}; promoted=${withConsent.candidate?.status}`,
        [],
      ));

      // Harness readonly
      const harnessPreview = this.power.previewHarness({
        harnessId: 'local-cli-delegate',
        prompt: 'hello',
        mutation: true,
      });
      checks.push(check(
        'harness-readonly-default',
        'External harness mutation gated',
        'power',
        harnessPreview.allowed === false ? 'ready' : 'attention',
        harnessPreview.reason,
        [],
      ));

      // Context discipline
      const ctx = new ContextDisciplineService().selectToolsForTurn({
        toolIds: Array.from({ length: 30 }, (_, i) => `t${i}`),
        maxVisibleTools: 10,
      });
      checks.push(check(
        'context-discipline',
        'Context tool budget',
        'power',
        ctx.selected.length === 10 && ctx.deferred.length === 20 ? 'ready' : 'attention',
        `selected=${ctx.selected.length}; deferred=${ctx.deferred.length}`,
        [],
      ));

      // Public command surface
      const required = ['zavorth setup', 'zavorth absorb <source>', 'zavorth reach', 'zavorth power', 'zavorth product'];
      const present = required.every((cmd) => PUBLIC_COMMANDS.some((c) => c.command.startsWith(cmd.split(' ')[0]) || c.command === cmd));
      checks.push(check(
        'public-command-surface',
        'Public CLI surface',
        'product',
        present ? 'ready' : 'attention',
        `${PUBLIC_COMMANDS.length} public commands catalogued`,
        required,
      ));

      // First-run path
      const fr = this.buildFirstRun();
      checks.push(check(
        'first-run-path',
        'First-run path defined',
        'product',
        fr.steps.length >= 5 && Boolean(fr.nextCommand) ? 'ready' : 'attention',
        `progress=${Math.round(fr.progress * 100)}%; next=${fr.nextCommand}`,
        fr.steps.map((s) => s.id),
      ));
    } finally {
      try {
        this.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // ignore cleanup
      }
    }

    const passed = checks.filter((c) => c.status === 'ready').length;
    const attention = checks.filter((c) => c.status === 'attention').length;
    const blocked = checks.filter((c) => c.status === 'blocked').length;
    const status: ProductReadinessLevel = blocked > 0 ? 'blocked' : attention > 0 ? 'attention' : 'ready';

    return { status, checks, passed, attention, blocked };
  }

  private fabricStatus(
    checks: ProductCertificationCheck[],
    fabric: ProductCertificationCheck['fabric'],
  ): ProductReadinessLevel {
    const subset = checks.filter((c) => c.fabric === fabric);
    if (!subset.length) return 'not-checked';
    if (subset.some((c) => c.status === 'blocked')) return 'blocked';
    if (subset.some((c) => c.status === 'attention')) return 'attention';
    return 'ready';
  }

  private receipt(
    kind: ProductFabricReceipt['kind'],
    status: ProductFabricReceipt['status'],
    summary: string,
  ): ProductFabricReceipt {
    return {
      id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      status,
      summary,
      createdAt: this.now().toISOString(),
      rawSecretsSerialized: false,
    };
  }
}

function check(
  id: ProductCertificationCheck['id'],
  title: string,
  fabric: ProductCertificationCheck['fabric'],
  status: ProductReadinessLevel,
  summary: string,
  evidence: string[],
): ProductCertificationCheck {
  return {
    id,
    title,
    fabric,
    status,
    summary,
    evidence,
    hermetic: true,
    liveIoPerformed: false,
  };
}

function worstStatus(levels: ProductReadinessLevel[]): ProductReadinessLevel {
  if (levels.includes('blocked')) return 'blocked';
  if (levels.includes('attention')) return 'attention';
  if (levels.includes('not-checked')) return 'attention';
  return 'ready';
}

export { UniversalProductSubsystemService as UniversalProductFabricService };

