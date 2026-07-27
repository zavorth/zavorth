import {
  type ZavorthExternalAgentGatewayReceipt,
} from '../contracts/ZavorthExternalAgentGatewayContract.js';
import { ZavorthExternalAgentGatewayService } from './ZavorthExternalAgentGatewayService.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION,
  type ZavorthExternalAgentOnboardingAdapter,
  type ZavorthExternalAgentOnboardingCandidate,
  type ZavorthExternalAgentOnboardingHintKind,
  type ZavorthExternalAgentOnboardingProtocol,
  type ZavorthExternalAgentOnboardingSignal,
  type ZavorthExternalAgentOnboardingSnapshot,
  type ZavorthExternalAgentOnboardingStatus,
} from '../contracts/ZavorthExternalAgentOnboardingContract.js';


import { logger } from '../logger.js';

export type ZavorthExternalAgentOnboardingInput = {
  requestedBy?: string | null;
  pathHint?: string | null;
  approximatePathHint?: string | null;
  commandHint?: string | null;
  endpointHint?: string | null;
  consent?: boolean;
  maxDepth?: number | null;
  writeSnapshot?: boolean;
};

export type ZavorthExternalAgentMaterializeInput = ZavorthExternalAgentOnboardingInput & {
  candidateId?: string | null;
  approveRegistration?: boolean;
  enableLive?: boolean;
  commandOverride?: string | null;
  argsOverride?: string[] | null;
  endpointOverride?: string | null;
  isolation?: 'local-supervised' | 'wsl' | 'docker' | null;
  dockerImage?: string | null;
  wslDistro?: string | null;
  requireStrongIsolation?: boolean;
};

export type ZavorthExternalAgentMaterializeResult = {
  generatedAt: string;
  surface: 'external-agent-onboarding-materialize';
  status: 'blocked' | 'candidate-not-found' | 'approval-required' | 'registered';
  candidate: ZavorthExternalAgentOnboardingCandidate | null;
  receipt: ZavorthExternalAgentGatewayReceipt | null;
  safety: {
    readOnlyOnboardingRequired: true;
    registrationRequiresExplicitApproval: true;
    noInvocationPerformed: true;
    liveInvocationStillRequiresPerRunApproval: true;
  };
};

export type ZavorthExternalAgentOnboardingRuntime = {
  now?: () => Date;
  projectRoot?: string;
  envPath?: string | null;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type NormalizedHint = {
  kind: ZavorthExternalAgentOnboardingHintKind;
  value: string | null;
  exactOnly: boolean;
};

type FileProbe = {
  path: string;
  relativePath: string;
  name: string;
  kind: 'file' | 'directory';
};

type InspectionResult = {
  roots: string[];
  filesRead: string[];
  directoriesScanned: number;
  capped: boolean;
  candidates: ZavorthExternalAgentOnboardingCandidate[];
};

const DEFAULT_MAX_DEPTH = 2;
const MAX_SCAN_ENTRIES = 160;
const MAX_MANIFEST_BYTES = 16_384;
const SAFE_MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'readme',
  'readme.md',
  'agent.json',
  'manifest.json',
  'acp.json',
  'mcp.json',
  '.mcp.json',
]);

export class ZavorthExternalAgentOnboardingService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly envPath: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly statSyncImpl: typeof fs.statSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  public constructor(runtime: ZavorthExternalAgentOnboardingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.envPath = runtime.envPath ?? process.env.PATH ?? '';
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public get snapshotPath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'zavorth-external-agent-onboarding.json');
  }

  public buildSnapshot(input: ZavorthExternalAgentOnboardingInput = {}): ZavorthExternalAgentOnboardingSnapshot {
    const hint = normalizeHint(input);
    const maxDepth = clampDepth(input.maxDepth);
    const consent = input.consent === true;
    const inspection = consent && hint.kind !== 'none'
      ? this.inspectHint(hint, maxDepth)
      : emptyInspection();
    const status = resolveStatus(hint, consent, inspection.candidates.length);
    const snapshot: ZavorthExternalAgentOnboardingSnapshot = {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_AGENT_ONBOARDING_CONTRACT_VERSION,
      surface: 'external-agent-onboarding',
      status,
      headline: headlineFor(status, hint, consent),
      userPrompt: [
        'Quer me dizer se existe algum agente external no ambiente...',
        'If so, provide an exact folder, an approximate folder, a CLI command, or an ACP/MCP endpoint.',
        'I will only inspect the scope you approve.',
      ].join(' '),
      requestedBy: String(input.requestedBy || 'operator').trim() || 'operator',
      consent: {
        provided: consent,
        mode: consent ? 'read-only-inspection' : 'not-provided',
        requiredBeforeInspection: true,
        scope: {
          kind: hint.kind,
          value: hint.value,
          maxDepth,
          exactOnly: hint.exactOnly,
        },
      },
      inspection: {
        performed: consent && hint.kind !== 'none',
        inspectedRoots: inspection.roots,
        filesRead: inspection.filesRead,
        directoriesScanned: inspection.directoriesScanned,
        capped: inspection.capped,
      },
      candidates: inspection.candidates,
      knownDiscoveryHints: [
        {
          kind: 'exact-path',
          example: 'zavorth external-agent-onboarding --path C:/agents/my-agent --consent',
          safety: 'Inspects only this folder in read mode.',
        },
        {
          kind: 'approximate-path',
          example: 'zavorth external-agent-onboarding --approx-path <workspace-parent> --consent',
          safety: 'Searches candidates below the indicated folder with limited depth.',
        },
        {
          kind: 'cli-command',
          example: 'zavorth external-agent-onboarding --command claude --consent',
          safety: 'Searches for the executable in PATH without running the command.',
        },
        {
          kind: 'endpoint',
          example: 'zavorth external-agent-onboarding --endpoint http://127.0.0.1:8765/acp --consent',
          safety: 'Registra candidato de endpoint without fazer probe de rede.',
        },
      ],
      policy: {
        automaticDiscoveryEnabled: false,
        userDeclaredHintsFirst: true,
        // Marker for QA: onboarding grants read-only inspection, never live use.
        consentRequiredForDiskInspection: true,
        consentRequiredForPathSearch: true,
        consentRequiredForCliPathInspection: true,
        consentRequiredForEndpointProbe: true,
        discoveryDoesNotRegisterOrUseAgents: true,
        liveUseRequiresSeparateApproval: true,
      },
      safety: {
        noFilesystemScanWithoutConsent: true,
        noProcessListInspection: true,
        noPortScan: true,
        noWslScanWithoutUserPath: true,
        noDockerScan: true,
        noExternalRuntimeExecution: true,
        noCredentialSerialization: true,
        noLiveToolBinding: true,
      },
      commands: {
        ask: 'zavorth external-agent-onboarding',
        inspectPath: 'zavorth external-agent-onboarding --path <path> --consent',
        inspectApproximatePath: 'zavorth external-agent-onboarding --approx-path <path> --consent',
        inspectCli: 'zavorth external-agent-onboarding --command <cli> --consent',
        inspectEndpoint: 'zavorth external-agent-onboarding --endpoint <url> --consent',
        json: 'npm run zavorth:external-agent-onboarding:json',
        check: 'npm run zavorth:external-agent-onboarding:check --silent',
      },
    };

    if (input.writeSnapshot === true) {
      this.writeSnapshot(snapshot);
    }
    return snapshot;
  }

  public materializeGatewayProfile(input: ZavorthExternalAgentMaterializeInput): ZavorthExternalAgentMaterializeResult {
    const snapshot = this.buildSnapshot({
      ...input,
      writeSnapshot: input.writeSnapshot === true,
    });
    const candidate = selectCandidate(snapshot.candidates, input.candidateId);
    const safety = {
      readOnlyOnboardingRequired: true as const,
      registrationRequiresExplicitApproval: true as const,
      noInvocationPerformed: true as const,
      liveInvocationStillRequiresPerRunApproval: true as const,
    };

    if (!snapshot.consent.provided || !snapshot.inspection.performed) {
      return {
        generatedAt: this.now().toISOString(),
        surface: 'external-agent-onboarding-materialize',
        status: 'blocked',
        candidate: null,
        receipt: null,
        safety,
      };
    }
    if (!candidate) {
      return {
        generatedAt: this.now().toISOString(),
        surface: 'external-agent-onboarding-materialize',
        status: 'candidate-not-found',
        candidate: null,
        receipt: null,
        safety,
      };
    }

    const draft = candidate.gatewayProfileDraft;
    const command = clean(input.commandOverride) || draft.command;
    const endpoint = clean(input.endpointOverride) || draft.endpoint;
    const args = Array.isArray(input.argsOverride) ? input.argsOverride.map((arg) => String(arg)) : draft.args;
    const receipt = new ZavorthExternalAgentGatewayService({ projectRoot: this.projectRoot }).registerProfile({
      id: draft.id,
      label: draft.label,
      adapter: draft.adapter,
      root: draft.root,
      command,
      args,
      endpoint,
      promptMode: draft.promptMode,
      enableLive: input.enableLive === true,
      isolation: input.isolation || draft.isolation,
      dockerImage: input.dockerImage,
      wslDistro: input.wslDistro,
      requireStrongIsolation: input.requireStrongIsolation === true,
      approvalGranted: input.approveRegistration === true,
      requestedBy: input.requestedBy,
      onboardingCandidateId: candidate.id,
      source: 'onboarding-candidate',
    });

    return {
      generatedAt: this.now().toISOString(),
      surface: 'external-agent-onboarding-materialize',
      status: receipt.status === 'registered' ? 'registered' : 'approval-required',
      candidate,
      receipt,
      safety,
    };
  }

  public renderText(snapshot: ZavorthExternalAgentOnboardingSnapshot): string {
    const lines = [
      'External Agent Onboarding',
      snapshot.headline,
      '',
      `Status: ${snapshot.status}`,
      `Consent: ${snapshot.consent.provided ? 'read-only granted' : 'not granted'}`,
      `Escopo: ${snapshot.consent.scope.kind}${snapshot.consent.scope.value ? ` | ${snapshot.consent.scope.value}` : ''}`,
      `Inspection: ${snapshot.inspection.performed ? 'performed' : 'not performed'}`,
      '',
    ];

    if (snapshot.status === 'needs-user-hint') {
      lines.push(
        snapshot.userPrompt,
        '',
        'Exemplos',
        `- ${snapshot.commands.inspectPath}`,
        `- ${snapshot.commands.inspectApproximatePath}`,
        `- ${snapshot.commands.inspectCli}`,
        `- ${snapshot.commands.inspectEndpoint}`,
      );
      return `${lines.join('\n')}\n`;
    }

    if (!snapshot.consent.provided) {
      lines.push(
        'Nada foi inspecionado.',
        'next passo: run again com --consent after de review o escopo.',
      );
      return `${lines.join('\n')}\n`;
    }

    lines.push(
      `Raizes inspecionadas: ${snapshot.inspection.inspectedRoots.length || 0}`,
      `Manifest files read: ${snapshot.inspection.filesRead.length || 0}`,
      `Diretorios escaneados: ${snapshot.inspection.directoriesScanned}`,
      `Candidates: ${snapshot.candidates.length}`,
    );

    if (snapshot.candidates.length > 0) {
      lines.push('', 'Candidates');
      for (const candidate of snapshot.candidates) {
        lines.push(
          `- ${candidate.label} (${candidate.confidence})`,
          `  id: ${candidate.id}`,
          `  protocolos: ${candidate.protocols.join(', ')}`,
          `  adapter sugerido: ${candidate.suggestedAdapter}`,
          `  gateway profile: ${candidate.gatewayProfileDraft.canRegisterAutomatically ? 'ready to register' : `needs ${candidate.gatewayProfileDraft.missingFields.join(', ')}`}`,
          `  next: ${candidate.nextAction.command}`,
        );
      }
    } else {
      lines.push('', 'No candidato claro foi encontrado nesse escopo.');
    }

    lines.push(
      '',
      'Garantias',
      '- descoberta automatica segue desligada por default',
      '- none process external foi iniciado',
      '- none endpoint foi chamado',
      '- none agente foi registrado or usado',
      '- live use requires separate approval',
    );

    return `${lines.join('\n')}\n`;
  }

  public renderMaterializeText(result: ZavorthExternalAgentMaterializeResult): string {
    const lines = [
      'External Agent Onboarding Materialize',
      `Status: ${result.status}`,
      `Candidate: ${result.candidate?.id || 'none'}`,
      '',
    ];
    if (result.status === 'blocked') {
      lines.push('Blocked: grant read-only consent and provide scope before materializing profile.');
    } else if (result.status === 'candidate-not-found') {
      lines.push('No candidato correspondente foi encontrado nesse escopo.');
    } else if (result.receipt) {
      lines.push(
        result.receipt.output.text,
        '',
        `Next: ${result.receipt.nextAction.label}${result.receipt.nextAction.command ? ` | ${result.receipt.nextAction.command}` : ''}`,
      );
    }
    lines.push(
      '',
      'Garantias',
      '- none agente external foi invocado',
      '- registration requires explicit approval',
      '- live execution still requires per-call approval',
    );
    return `${lines.join('\n')}\n`;
  }

  private inspectHint(hint: NormalizedHint, maxDepth: number): InspectionResult {
    if (!hint.value) {
      return emptyInspection();
    }
    if (hint.kind === 'endpoint') {
      const candidate = this.candidateFromEndpoint(hint.value);
      return {
        roots: [hint.value],
        filesRead: [],
        directoriesScanned: 0,
        capped: false,
        candidates: candidate ? [candidate] : [],
      };
    }
    if (hint.kind === 'cli-command') {
      return this.inspectCommand(hint.value);
    }
    return this.inspectPathHint(hint, maxDepth);
  }

  private inspectCommand(command: string): InspectionResult {
    const commandName = sanitizeCommandName(command);
    if (!commandName) {
      return emptyInspection();
    }
    const candidates: ZavorthExternalAgentOnboardingCandidate[] = [];
    const checkedRoots: string[] = [];
    const pathDirs = this.envPath
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 80);
    const executableNames = process.platform === 'win32'
      ? [commandName, `${commandName}.cmd`, `${commandName}.ps1`, `${commandName}.exe`, `${commandName}.bat`]
      : [commandName];

    for (const dir of pathDirs) {
      checkedRoots.push(dir);
      for (const executable of executableNames) {
        const candidatePath = path.join(dir, executable);
        if (this.existsSyncImpl(candidatePath)) {
          candidates.push(this.buildCandidate({
            hintKind: 'cli-command',
            sourceValue: commandName,
            inspectedPath: candidatePath,
            probes: [{ path: candidatePath, relativePath: executable, name: executable, kind: 'file' }],
            manifestTexts: new Map(),
            extraSignals: [
              signal('cli-on-path', 'CLI executable found on PATH', 3, maskHome(candidatePath)),
            ],
          }));
          return {
            roots: checkedRoots,
            filesRead: [],
            directoriesScanned: checkedRoots.length,
            capped: false,
            candidates,
          };
        }
      }
    }

    return {
      roots: checkedRoots,
      filesRead: [],
      directoriesScanned: checkedRoots.length,
      capped: pathDirs.length >= 80,
      candidates,
    };
  }

  private inspectPathHint(hint: NormalizedHint, maxDepth: number): InspectionResult {
    const roots = resolvePossiblePathRoots(hint.value || '');
    const existingRoots = roots.filter((root) => this.existsSyncImpl(root));
    if (existingRoots.length === 0) {
      return { ...emptyInspection(), roots };
    }

    const candidates: ZavorthExternalAgentOnboardingCandidate[] = [];
    const filesRead: string[] = [];
    let directoriesScanned = 0;
    let capped = false;
    const rootsToInspect = hint.exactOnly
      ? existingRoots.slice(0, 1)
      : this.findCandidateRoots(existingRoots[0], maxDepth);

    for (const root of rootsToInspect) {
      const scan = this.scanRoot(root, hint.exactOnly ? Math.max(1, maxDepth) : 1);
      directoriesScanned += scan.directoriesScanned;
      capped = capped || scan.capped;
      const manifestTexts = this.readSafeManifests(root, scan.entries, filesRead);
      const candidate = this.buildCandidate({
        hintKind: hint.kind,
        sourceValue: hint.value || root,
        inspectedPath: root,
        probes: scan.entries,
        manifestTexts,
        extraSignals: [],
      });
      if (candidate.signals.length > 0) {
        candidates.push(candidate);
      }
      if (candidates.length >= 12) {
        capped = true;
        break;
      }
    }

    return {
      roots: existingRoots,
      filesRead,
      directoriesScanned,
      capped,
      candidates: sortCandidates(candidates),
    };
  }

  private findCandidateRoots(root: string, maxDepth: number): string[] {
    const scan = this.scanRoot(root, maxDepth);
    const roots = [root];
    for (const entry of scan.entries) {
      if (entry.kind !== 'directory') continue;
      const name = entry.name.toLowerCase();
      const rel = entry.relativePath.toLowerCase();
      if (
        name.includes('agent')
        || name.includes('claw')
        || name.includes('claude')
        || name.includes('codex')
        || name.includes('external-agent')
        || rel.includes('acp')
        || rel.includes('mcp')
      ) {
        roots.push(entry.path);
      }
      if (roots.length >= 16) break;
    }
    return unique(roots);
  }

  private scanRoot(root: string, maxDepth: number): { entries: FileProbe[]; directoriesScanned: number; capped: boolean } {
    const entries: FileProbe[] = [];
    let directoriesScanned = 0;
    let capped = false;
    const visit = (current: string, depth: number): void => {
      if (entries.length >= MAX_SCAN_ENTRIES) {
        capped = true;
        return;
      }
      directoriesScanned += 1;
      let dirents: fs.Dirent[];
      try {
        dirents = this.readdirSyncImpl(current, { withFileTypes: true }) as fs.Dirent[];
      } catch (error: unknown) {logger.warn('[Zavorth External Agent Onboarding] filesystem operation failed', error);
    return;
  }
      for (const dirent of dirents.slice(0, 80)) {
        if (entries.length >= MAX_SCAN_ENTRIES) {
          capped = true;
          return;
        }
        const name = dirent.name;
        if (shouldSkipName(name)) continue;
        const fullPath = path.join(current, name);
        const kind = dirent.isDirectory() ? 'directory' : 'file';
        entries.push({
          path: fullPath,
          relativePath: path.relative(root, fullPath) || name,
          name,
          kind,
        });
        if (kind === 'directory' && depth < maxDepth) {
          visit(fullPath, depth + 1);
        }
      }
    };
    visit(root, 0);
    return { entries, directoriesScanned, capped };
  }

  private readSafeManifests(root: string, entries: FileProbe[], filesRead: string[]): Map<string, string> {
    const manifests = new Map<string, string>();
    for (const entry of entries) {
      if (entry.kind !== 'file') continue;
      const name = entry.name.toLowerCase();
      if (!SAFE_MANIFEST_NAMES.has(name)) continue;
      try {
        const stat = this.statSyncImpl(entry.path);
        if (stat.size > MAX_MANIFEST_BYTES * 4) continue;
        const raw = this.readFileSyncImpl(entry.path, 'utf8');
        const text = String(raw).slice(0, MAX_MANIFEST_BYTES);
        manifests.set(entry.relativePath || path.relative(root, entry.path), text);
        filesRead.push(entry.path);
      } catch (error: unknown) {// best-effort read-only manifest probe
      logger.warn('[Zavorth External Agent Onboarding] filesystem operation failed', error);
    }
    }
    return manifests;
  }

  private candidateFromEndpoint(endpoint: string): ZavorthExternalAgentOnboardingCandidate | null {
    const normalized = endpoint.trim();
    if (!/^https?:\/\/|^acp:\/\//i.test(normalized)) {
      return null;
    }
    const lowered = normalized.toLowerCase();
    const protocols: ZavorthExternalAgentOnboardingProtocol[] = [];
    if (lowered.includes('acp')) protocols.push('acp');
    if (lowered.includes('mcp')) protocols.push('mcp');
    protocols.push('http');
    return this.buildCandidate({
      hintKind: 'endpoint',
      sourceValue: normalized,
      inspectedPath: null,
      probes: [],
      manifestTexts: new Map(),
      extraSignals: [
        signal('endpoint-declared', 'User-declared endpoint', 3, redactEndpoint(normalized)),
        ...protocols.map((protocol) => signal(
          `protocol-${protocol}`,
          `${protocol.toUpperCase()} endpoint marker`,
          protocol === 'http' ? 1 : 3,
          redactEndpoint(normalized),
        )),
      ],
    });
  }

  private buildCandidate(input: {
    hintKind: ZavorthExternalAgentOnboardingHintKind;
    sourceValue: string;
    inspectedPath: string | null;
    probes: FileProbe[];
    manifestTexts: Map<string, string>;
    extraSignals: ZavorthExternalAgentOnboardingSignal[];
  }): ZavorthExternalAgentOnboardingCandidate {
    const signals = [
      ...input.extraSignals,
      ...signalsFromPath(input.inspectedPath || input.sourceValue),
      ...signalsFromProbes(input.probes),
      ...signalsFromManifests(input.manifestTexts),
    ];
    const dedupedSignals = dedupeSignals(signals);
    const protocols = resolveProtocols(dedupedSignals, input.hintKind);
    const adapter = resolveAdapter(protocols, input.hintKind);
    const score = dedupedSignals.reduce((sum, entry) => sum + entry.weight, 0);
    const confidence = score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';
    const label = labelForCandidate(input.sourceValue, dedupedSignals, protocols);
    const id = `external-agent-${stableId(`${input.hintKind}:${input.sourceValue}:${input.inspectedPath || ''}`)}`;
    const gatewayProfileDraft = buildGatewayProfileDraft({
      id,
      label,
      adapter,
      sourceKind: input.hintKind,
      sourceValue: input.sourceValue,
      inspectedPath: input.inspectedPath,
      protocols,
    });
    return {
      id,
      label,
      confidence,
      source: {
        kind: input.hintKind,
        value: input.sourceValue,
        inspectedPath: input.inspectedPath,
      },
      protocols,
      suggestedAdapter: adapter,
      signals: dedupedSignals,
      nextAction: {
        label: 'Review and optionally register as an external capability candidate',
        command: gatewayProfileDraft.recommendedRegistrationCommand,
      },
      gatewayProfileDraft,
      registration: {
        status: 'candidate-only',
        requiresUserApproval: true,
        liveExecutionEnabled: false,
        dryRunAvailable: true,
      },
      safety: {
        readOnlyInspection: true,
        noProcessStarted: true,
        noNetworkProbe: true,
        noCredentialRead: true,
        noToolExposure: true,
        noDefaultRuntimeBinding: true,
      },
    };
  }

  private writeSnapshot(snapshot: ZavorthExternalAgentOnboardingSnapshot): void {
    this.mkdirSyncImpl(path.dirname(this.snapshotPath), { recursive: true });
    this.writeFileSyncImpl(this.snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}

function normalizeHint(input: ZavorthExternalAgentOnboardingInput): NormalizedHint {
  const exactPath = clean(input.pathHint);
  if (exactPath) return { kind: 'exact-path', value: exactPath, exactOnly: true };
  const approximatePath = clean(input.approximatePathHint);
  if (approximatePath) return { kind: 'approximate-path', value: approximatePath, exactOnly: false };
  const command = clean(input.commandHint);
  if (command) return { kind: 'cli-command', value: command, exactOnly: true };
  const endpoint = clean(input.endpointHint);
  if (endpoint) return { kind: 'endpoint', value: endpoint, exactOnly: true };
  return { kind: 'none', value: null, exactOnly: true };
}

function emptyInspection(): InspectionResult {
  return {
    roots: [],
    filesRead: [],
    directoriesScanned: 0,
    capped: false,
    candidates: [],
  };
}

function resolveStatus(
  hint: NormalizedHint,
  consent: boolean,
  candidateCount: number,
): ZavorthExternalAgentOnboardingStatus {
  if (hint.kind === 'none') return 'needs-user-hint';
  if (!consent) return 'blocked';
  return candidateCount > 0 ? 'ready-for-review' : 'no-candidate-found';
}

function headlineFor(
  status: ZavorthExternalAgentOnboardingStatus,
  hint: NormalizedHint,
  consent: boolean,
): string {
  if (status === 'needs-user-hint') {
    return 'Provide a hint before any external discovery.';
  }
  if (!consent) {
    return `Consent is required before inspecting ${hint.kind}.`;
  }
  if (status === 'ready-for-review') {
    return 'External candidates found for review; nothing was registered or used.';
  }
  if (status === 'no-candidate-found') {
    return 'No clear external agent was found in the approved scope.';
  }
  return 'Onboarding blocked by consent policy.';
}

function resolvePossiblePathRoots(raw: string): string[] {
  const value = raw.trim().replace(/^['"]|['"]$/g, '');
  const roots = [value];
  if (process.platform === 'win32' && value.startsWith('/')) {
    const wslPath = value.replace(/\//g, '\\');
    roots.push(`\\\\wsl.localhost\\Ubuntu-24.04${wslPath}`);
    roots.push(`\\\\wsl$\\Ubuntu-24.04${wslPath}`);
  }
  return unique(roots);
}

function signalsFromPath(target: string): ZavorthExternalAgentOnboardingSignal[] {
  const lowered = target.toLowerCase();
  const signals: ZavorthExternalAgentOnboardingSignal[] = [];
  if (lowered.includes('claw')) {
    signals.push(signal('known-family-agent-family', 'Generic local agent family marker', 3, maskHome(target)));
  }
  if (lowered.includes('claude')) {
    signals.push(signal('known-family-claude', 'Known CLI agent marker', 3, maskHome(target)));
  }
  if (lowered.includes('external-agent')) {
    signals.push(signal('known-family-agent', 'Generic agent runtime marker', 3, maskHome(target)));
  }
  if (lowered.includes('codex')) {
    signals.push(signal('known-family-codex', 'Codex-style agent runtime marker', 2, maskHome(target)));
  }
  if (lowered.includes('acp')) {
    signals.push(signal('protocol-acp-path', 'ACP path marker', 3, maskHome(target)));
  }
  if (lowered.includes('mcp')) {
    signals.push(signal('protocol-mcp-path', 'MCP path marker', 3, maskHome(target)));
  }
  return signals;
}

function signalsFromProbes(entries: FileProbe[]): ZavorthExternalAgentOnboardingSignal[] {
  const lowered = new Set(entries.map((entry) => entry.relativePath.replace(/\\/g, '/').toLowerCase()));
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
  const signals: ZavorthExternalAgentOnboardingSignal[] = [];
  if (names.has('package.json')) signals.push(signal('manifest-package-json', 'Node package manifest present', 2, 'package.json'));
  if (names.has('pyproject.toml')) signals.push(signal('manifest-pyproject', 'Python project manifest present', 2, 'pyproject.toml'));
  if (names.has('.mcp.json') || names.has('mcp.json')) signals.push(signal('protocol-mcp-manifest', 'MCP manifest present', 4, 'mcp manifest'));
  if (names.has('acp.json')) signals.push(signal('protocol-acp-manifest', 'ACP manifest present', 4, 'acp.json'));
  if ([...lowered].some((entry) => entry === 'agent' || entry.startsWith('agent/') || entry === 'agents' || entry.startsWith('agents/'))) {
    signals.push(signal('agent-directory', 'Agent directory present', 3, 'agent/ or agents/'));
  }
  if ([...lowered].some((entry) => entry === 'skills' || entry.startsWith('skills/') || entry === 'extensions' || entry.startsWith('extensions/'))) {
    signals.push(signal('capability-directory', 'Skills/extensions directory present', 2, 'skills/ or extensions/'));
  }
  if (lowered.has('agent/curator.py') || lowered.has('curator.py')) {
    signals.push(signal('skill-curator-marker', 'Skill curator file marker present', 3, 'curator.py'));
  }
  if (lowered.has('run_agent.py') || lowered.has('agent/run_agent.py')) {
    signals.push(signal('agent-runner-marker', 'Agent runner file marker present', 3, 'run_agent.py'));
  }
  if ([...lowered].some((entry) => entry.includes('/acp/') || entry.startsWith('acp/') || entry.includes('acp'))) {
    signals.push(signal('protocol-acp-files', 'ACP file or directory marker present', 3, 'acp'));
  }
  if ([...lowered].some((entry) => entry.includes('/mcp/') || entry.startsWith('mcp/') || entry.includes('mcp'))) {
    signals.push(signal('protocol-mcp-files', 'MCP file or directory marker present', 3, 'mcp'));
  }
  return signals;
}

function signalsFromManifests(manifests: Map<string, string>): ZavorthExternalAgentOnboardingSignal[] {
  const signals: ZavorthExternalAgentOnboardingSignal[] = [];
  for (const [file, text] of manifests) {
    const lowered = text.toLowerCase();
    if (lowered.includes('"name"') && lowered.includes('agent')) {
      signals.push(signal('manifest-agent-name', 'Manifest names an agent package', 3, file));
    }
    if (lowered.includes('acp')) {
      signals.push(signal('protocol-acp-manifest-text', 'Manifest references ACP', 4, file));
    }
    if (lowered.includes('mcp')) {
      signals.push(signal('protocol-mcp-manifest-text', 'Manifest references MCP', 4, file));
    }
    if (lowered.includes('claude')) {
      signals.push(signal('known-family-claude-manifest', 'Manifest references known CLI agent tooling', 3, file));
    }
    if (lowered.includes('claw')) {
      signals.push(signal('known-family-agent-family-manifest', 'Manifest references Generic local agent tooling', 3, file));
    }
    if (lowered.includes('external-agent')) {
      signals.push(signal('known-family-agent-manifest', 'Manifest references Generic agent tooling', 3, file));
    }
  }
  return signals;
}

function resolveProtocols(
  signals: ZavorthExternalAgentOnboardingSignal[],
  hintKind: ZavorthExternalAgentOnboardingHintKind,
): ZavorthExternalAgentOnboardingProtocol[] {
  const ids = signals.map((entry) => entry.id).join('|');
  const protocols: ZavorthExternalAgentOnboardingProtocol[] = [];
  if (ids.includes('protocol-acp')) protocols.push('acp');
  if (ids.includes('protocol-mcp')) protocols.push('mcp');
  if (hintKind === 'cli-command' || ids.includes('cli-on-path')) protocols.push('cli');
  if (hintKind === 'endpoint') protocols.push('http');
  if (protocols.length === 0) protocols.push('unknown');
  return unique(protocols);
}

function resolveAdapter(
  protocols: ZavorthExternalAgentOnboardingProtocol[],
  hintKind: ZavorthExternalAgentOnboardingHintKind,
): ZavorthExternalAgentOnboardingAdapter {
  if (protocols.includes('acp')) return 'acp';
  if (protocols.includes('mcp')) return 'mcp';
  if (protocols.includes('cli') || hintKind === 'cli-command') return 'cli';
  if (protocols.includes('http')) return 'http';
  return 'manual-profile';
}

function buildGatewayProfileDraft(input: {
  id: string;
  label: string;
  adapter: ZavorthExternalAgentOnboardingAdapter;
  sourceKind: ZavorthExternalAgentOnboardingHintKind;
  sourceValue: string;
  inspectedPath: string | null;
  protocols: ZavorthExternalAgentOnboardingProtocol[];
}): ZavorthExternalAgentOnboardingCandidate['gatewayProfileDraft'] {
  const gatewayAdapter = toGatewayAdapter(input.adapter, input.protocols);
  const root = input.sourceKind === 'exact-path' || input.sourceKind === 'approximate-path'
    ? input.inspectedPath || input.sourceValue
    : null;
  const command = input.sourceKind === 'cli-command' ? sanitizeCommandName(input.sourceValue) : null;
  const endpoint = input.sourceKind === 'endpoint' ? input.sourceValue : null;
  const missingFields: string[] = [];
  if (gatewayAdapter === 'cli' && !command) missingFields.push('command');
  if ((gatewayAdapter === 'http' || gatewayAdapter === 'mcp') && !endpoint) missingFields.push('endpoint');
  const recommended = [
    'zavorth external-agent-onboarding',
    flagForSource(input.sourceKind, input.sourceValue),
    '--consent',
    `--materialize-candidate ${input.id}`,
    '--approve-registration',
    gatewayAdapter === 'cli' && command ? '--enable-live' : '',
  ].filter(Boolean).join(' ');
  return {
    id: input.id.replace(/^external-agent-/, 'agent-'),
    label: input.label,
    adapter: gatewayAdapter,
    root,
    command,
    args: [],
    endpoint,
    promptMode: 'stdin',
    isolation: 'local-supervised',
    missingFields,
    canRegisterAutomatically: missingFields.length === 0 || Boolean(root),
    requiresCommandConfirmation: gatewayAdapter === 'cli' && !command,
    recommendedRegistrationCommand: recommended,
  };
}

function toGatewayAdapter(
  adapter: ZavorthExternalAgentOnboardingAdapter,
  protocols: ZavorthExternalAgentOnboardingProtocol[],
): 'cli' | 'http' | 'acp' | 'mcp' {
  if (adapter === 'cli') return 'cli';
  if (adapter === 'mcp') return 'mcp';
  if (adapter === 'acp') return 'acp';
  if (adapter === 'http') return 'http';
  if (protocols.includes('mcp')) return 'mcp';
  if (protocols.includes('acp')) return 'acp';
  return 'cli';
}

function flagForSource(kind: ZavorthExternalAgentOnboardingHintKind, value: string): string {
  const quoted = quoteArg(value);
  if (kind === 'exact-path') return `--path ${quoted}`;
  if (kind === 'approximate-path') return `--approx-path ${quoted}`;
  if (kind === 'cli-command') return `--command ${quoted}`;
  if (kind === 'endpoint') return `--endpoint ${quoted}`;
  return '';
}

function quoteArg(value: string): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function selectCandidate(
  candidates: ZavorthExternalAgentOnboardingCandidate[],
  candidateId?: string | null,
): ZavorthExternalAgentOnboardingCandidate | null {
  if (candidateId) {
    return candidates.find((candidate) => candidate.id === candidateId || candidate.gatewayProfileDraft.id === candidateId) || null;
  }
  return candidates[0] || null;
}

function labelForCandidate(
  sourceValue: string,
  signals: ZavorthExternalAgentOnboardingSignal[],
  protocols: ZavorthExternalAgentOnboardingProtocol[],
): string {
  const ids = signals.map((entry) => entry.id).join('|');
  if (ids.includes('known-family-claude')) return 'External agent candidate: known CLI';
  if (ids.includes('known-family-agent-family')) return 'External agent candidate: local agent runtime';
  if (ids.includes('known-family-agent')) return 'External agent candidate: generic agent runtime';
  if (protocols.includes('acp')) return 'External agent candidate: ACP-compatible runtime';
  if (protocols.includes('mcp')) return 'External agent candidate: MCP-compatible runtime';
  const base = path.basename(sourceValue.replace(/\\/g, '/')) || 'declared source';
  return `External agent candidate: ${base}`;
}

function sortCandidates(
  candidates: ZavorthExternalAgentOnboardingCandidate[],
): ZavorthExternalAgentOnboardingCandidate[] {
  const rank = { high: 3, medium: 2, low: 1 };
  return [...candidates].sort((a, b) => rank[b.confidence] - rank[a.confidence] || a.label.localeCompare(b.label));
}

function signal(id: string, label: string, weight: number, evidence: string): ZavorthExternalAgentOnboardingSignal {
  return { id, label, weight, evidence: String(evidence || '').slice(0, 240) };
}

function dedupeSignals(signals: ZavorthExternalAgentOnboardingSignal[]): ZavorthExternalAgentOnboardingSignal[] {
  const map = new Map<string, ZavorthExternalAgentOnboardingSignal>();
  for (const entry of signals) {
    if (!map.has(entry.id)) map.set(entry.id, entry);
  }
  return [...map.values()];
}

function stableId(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? text.slice(0, 500) : null;
}

function clampDepth(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_MAX_DEPTH;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_DEPTH;
  return Math.max(0, Math.min(4, Math.floor(parsed)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function shouldSkipName(name: string): boolean {
  const lowered = name.toLowerCase();
  return lowered === 'node_modules'
    || lowered === '.git'
    || lowered === 'dist'
    || lowered === 'build'
    || lowered === '.next'
    || lowered === '__pycache__'
    || lowered === '.venv'
    || lowered === 'venv'
    || lowered.includes('secret')
    || lowered.includes('token')
    || lowered.includes('credential')
    || lowered === '.env';
}

function sanitizeCommandName(command: string): string {
  const cleaned = command.trim().replace(/^['"]|['"]$/g, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(cleaned)) return '';
  return cleaned;
}

function maskHome(value: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return home && value.toLowerCase().startsWith(home.toLowerCase()) ? `~${value.slice(home.length)}`
    : value;
}

function redactEndpoint(value: string): string {
  return value.replace(/:\/\/([^/@]+)@/g, '://***@').replace(/([...&](?:token|key|secret)=)[^&]+/gi, '$1***');
}
