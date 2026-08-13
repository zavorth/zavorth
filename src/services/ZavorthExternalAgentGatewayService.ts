import { AcpLiveSessionService } from './AcpLiveSessionService.js';

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { config } from '../config/index.js';
import {
  ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
  type ZavorthExternalAgentAdapterKind,
  type ZavorthExternalAgentGatewayZavorthControlSnapshot,
  type ZavorthExternalAgentGatewayReceipt,
  type ZavorthExternalAgentGatewayRegistrySnapshot,
  type ZavorthExternalAgentIsolationKind,
  type ZavorthExternalAgentNetworkMode,
  type ZavorthExternalAgentProfile,
} from '../contracts/ZavorthExternalAgentGatewayContract.js';

import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import { ExternalAgentCapabilityImportService } from './ExternalAgentCapabilityImportService.js';
import type {
  ExternalAgentCapabilityImportResult,
  ExternalAgentListCapabilitiesResult,
} from '../contracts/external/ZavorthExternalAgentCapabilityImportContract.js';

export type ZavorthExternalAgentRegisterInput = {
  id?: string | null;
  label?: string | null;
  adapter?: ZavorthExternalAgentAdapterKind | null;
  root?: string | null;
  command?: string | null;
  args?: string[];
  endpoint?: string | null;
  acpServerId?: string | null;
  acpTransport?: 'local-jsonrpc' | 'stdio-jsonrpc' | 'acp-sdk-stdio' | null;
  promptMode?: 'stdin' | 'arg' | 'json' | null;
  allowedCapabilities?: string[];
  enableLive?: boolean;
  allowRemoteNetwork?: boolean;
  isolation?: ZavorthExternalAgentIsolationKind | 'local' | null;
  sandboxImage?: string | null;
  dockerImage?: string | null;
  wslDistro?: string | null;
  workspaceMount?: string | null;
  sandboxWorkdir?: string | null;
  workingDirectory?: string | null;
  network?: ZavorthExternalAgentNetworkMode | null;
  readOnlyRoot?: boolean;
  requireStrongIsolation?: boolean;
  requestedBy?: string | null;
  approvalGranted?: boolean;
  onboardingCandidateId?: string | null;
  source?: 'manual' | 'onboarding-candidate' | 'api' | 'telegram';
};

export type ZavorthExternalAgentInvokeInput = {
  profileId: string;
  prompt: string;
  requestedBy?: string | null;
  approvalGranted?: boolean;
  dryRun?: boolean;
  timeoutMs?: number | null;
  receiptPath?: string | null;
};

export type ZavorthExternalAgentGatewayRuntime = {
  now?: () => Date;
  projectRoot?: string;
  registryFile?: string;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  spawnSync?: typeof spawnSync;
  fetch?: typeof globalThis.fetch;
  acpSessionService?: Pick<AcpLiveSessionService, 'run' | 'renderText'>;
};

type CliExecutionPlan = {
  command: string;
  args: string[];
  cwd: string;
  inputText: string | undefined;
  isolationKind: ZavorthExternalAgentIsolationKind;
  isolationStrongBoundary: boolean;
  sandboxCommand: string | null;
  liveNetworkPerformed: boolean;
  blockedReason: string | null;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 24_000;

export class ZavorthExternalAgentGatewayService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly registryFileValue: string;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly spawnSyncImpl: typeof spawnSync;
  private readonly fetchImpl?: typeof globalThis.fetch;
  private readonly acpSessionService: Pick<AcpLiveSessionService, 'run' | 'renderText'>;

  public constructor(runtime: ZavorthExternalAgentGatewayRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.registryFileValue =
      runtime.registryFile ||
      process.env.ZAVORTH_EXTERNAL_AGENT_GATEWAY_REGISTRY ||
      path.join(this.projectRoot, 'data', 'runtime', 'external-agent-profiles.json');
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.spawnSyncImpl = runtime.spawnSync || spawnSync;
    this.fetchImpl = runtime.fetch || globalThis.fetch?.bind(globalThis);
    this.acpSessionService = runtime.acpSessionService || new AcpLiveSessionService({ now: this.now });
  }

  public get registryFile(): string {
    return this.registryFileValue;
  }

  /**
   * list declared capabilities for a registered profile (offline; no process spawn).
   */
  public listCapabilities(input: {
    profileId: string;
    capabilitiesFile?: string | null;
  }): ExternalAgentListCapabilitiesResult {
    return new ExternalAgentCapabilityImportService({
      projectRoot: this.projectRoot,
      gateway: this,
      now: this.now,
    }).listCapabilities(input);
  }

  /**
   * import declared capabilities into a SkillIR pack (consent required).
   */
  public importCapabilities(input: {
    profileId: string;
    consent?: boolean;
    capabilitiesFile?: string | null;
    skillId?: string | null;
  }): ExternalAgentCapabilityImportResult {
    return new ExternalAgentCapabilityImportService({
      projectRoot: this.projectRoot,
      gateway: this,
      now: this.now,
    }).importCapabilities(input);
  }

  public buildRegistrySnapshot(): ZavorthExternalAgentGatewayRegistrySnapshot {
    const profiles = this.readProfiles();
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
      surface: 'external-agent-gateway',
      status: profiles.length > 0 ? 'ready' : 'empty',
      registryFile: this.registryFile,
      profiles,
      summary: {
        total: profiles.length,
        enabled: profiles.filter((profile) => profile.status === 'enabled').length,
        liveEnabled: profiles.filter((profile) => profile.liveExecutionEnabled).length,
        cli: profiles.filter((profile) => profile.adapter === 'cli').length,
        http: profiles.filter((profile) => profile.adapter === 'http').length,
        acp: profiles.filter((profile) => profile.adapter === 'acp').length,
        mcp: profiles.filter((profile) => profile.adapter === 'mcp').length,
        stronglyIsolated: profiles.filter((profile) => profile.isolation.strongBoundary).length,
      },
      safety: {
        noAgentUsedDuringRegistryRead: true,
        noToolExposure: true,
        noCredentialSerialization: true,
        liveUseRequiresApproval: true,
        strongIsolationAvailable: true,
        localCliDeclaredNonSandboxed: true,
      },
    };
  }

  public buildZavorthControlSnapshot(): ZavorthExternalAgentGatewayZavorthControlSnapshot {
    const registry = this.buildRegistrySnapshot();
    const latestReceipt = this.readLatestReceipt();
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
      surface: 'external-agent-zavorthControl',
      registry,
      latestReceipt,
      summary: {
        profiles: registry.summary.total,
        liveEnabled: registry.summary.liveEnabled,
        stronglyIsolated: registry.summary.stronglyIsolated,
        latestReceiptStatus: latestReceipt?.status || 'none',
      },
      safety: {
        noAgentUsedDuringZavorthControlRead: true,
        liveUseRequiresApproval: true,
        localCliDeclaredNonSandboxed: true,
        rawSecretsSerialized: false,
      },
    };
  }

  /** Compatibility alias for older dashboard-era callers/tests. */
  public buildDashboardSnapshot(): ZavorthExternalAgentGatewayZavorthControlSnapshot {
    return this.buildZavorthControlSnapshot();
  }

  public readLatestReceipt(): ZavorthExternalAgentGatewayReceipt | null {
    const target = this.resolveReceiptPath(null);
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(target, 'utf8') as string) as ZavorthExternalAgentGatewayReceipt;
      return sanitizeReceipt(parsed);
    } catch (error: unknown) {
      logger.warn('[Zavorth External Agent way] JSON parse failed', error);
      return null;
    }
  }

  public registerProfile(input: ZavorthExternalAgentRegisterInput): ZavorthExternalAgentGatewayReceipt {
    const profile = this.normalizeProfile(input);
    if (!input.approvalGranted) {
      return this.buildReceipt({
        kind: 'profile-registration',
        status: 'approval-required',
        profile,
        requestedBy: input.requestedBy,
        prompt: null,
        approvalProvided: false,
        dryRun: true,
        outputText: 'Profile registration preview built. No external agent was registered or used.',
        nextLabel: 'Approve registration explicitly',
        nextCommand: `zavorth external-agent register --id ${profile.id} --adapter ${profile.adapter} --approve-registration`,
      });
    }
    const profiles = this.readProfiles().filter((entry) => entry.id !== profile.id);
    profiles.push(profile);
    this.writeProfiles(sortProfiles(profiles));
    return this.buildReceipt({
      kind: 'profile-registration',
      status: 'registered',
      profile,
      requestedBy: input.requestedBy,
      prompt: null,
      approvalProvided: true,
      dryRun: false,
      outputText: `External agent profile ${profile.id} registered. Live invocation still requires approval per run.`,
      nextLabel: 'Invoke with approval when needed',
      nextCommand: `zavorth external-agent run --id ${profile.id} --prompt "<task>" --approve-external-execution`,
    });
  }

  public async invoke(input: ZavorthExternalAgentInvokeInput): Promise<ZavorthExternalAgentGatewayReceipt> {
    const profile = this.readProfiles().find((entry) => entry.id === input.profileId) || null;
    const prompt = String(input.prompt || '').trim();
    const started = Date.now();
    if (!profile) {
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: 'blocked',
        profile: null,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: Boolean(input.approvalGranted),
        dryRun: input.dryRun !== false,
        outputText: `External agent profile not found: ${input.profileId}`,
        nextLabel: 'Register a profile first',
        nextCommand: 'zavorth external-agent list',
      });
    }
    if (!prompt) {
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: 'blocked',
        profile,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: Boolean(input.approvalGranted),
        dryRun: true,
        outputText: 'Prompt is required before invoking an external agent.',
        nextLabel: 'Provide a prompt',
        nextCommand: `zavorth external-agent run --id ${profile.id} --prompt "<task>"`,
      });
    }
    if (profile.status !== 'enabled' || !profile.liveExecutionEnabled) {
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: 'blocked',
        profile,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: Boolean(input.approvalGranted),
        dryRun: true,
        outputText: `Profile ${profile.id} is not enabled for live external execution.`,
        nextLabel: 'Re-register with live enabled if intended',
        nextCommand: `zavorth external-agent register --id ${profile.id} --adapter ${profile.adapter} --enable-live --approve-registration`,
      });
    }
    if (!input.approvalGranted || input.dryRun === true) {
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: 'approval-required',
        profile,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: Boolean(input.approvalGranted),
        dryRun: true,
        outputText: `Invocation plan ready for ${profile.label}. No external process or network call was performed.`,
        nextLabel: 'Approve this invocation',
        nextCommand: `zavorth external-agent run --id ${profile.id} --prompt "<task>" --approve-external-execution`,
      });
    }
    if (profile.isolation.required && !profile.isolation.strongBoundary) {
      return this.blockedInvocation(
        profile,
        input,
        prompt,
        'Strong isolation is required for this profile. Re-register it with --isolation docker or --isolation wsl before live use.',
      );
    }

    let receipt: ZavorthExternalAgentGatewayReceipt;
    if (profile.adapter === 'cli') {
      receipt = this.invokeCli(profile, prompt, input, started);
    } else if (profile.adapter === 'http' || profile.adapter === 'mcp') {
      receipt = await this.invokeHttp(profile, prompt, input, started);
    } else {
      receipt = await this.invokeAcp(profile, prompt, input, started);
    }
    this.writeReceipt(receipt, input.receiptPath);
    return receipt;
  }

  public renderRegistryText(snapshot: ZavorthExternalAgentGatewayRegistrySnapshot): string {
    const lines = [
      'External Agent Gateway',
      `Status: ${snapshot.status}`,
      `Profiles: ${snapshot.summary.total} | enabled ${snapshot.summary.enabled} | live ${snapshot.summary.liveEnabled}`,
      '',
    ];
    if (snapshot.profiles.length === 0) {
      lines.push(
        'No external agent profile registered yet.',
        'Next: use External Agent Onboarding, then register a candidate explicitly.',
      );
    } else {
      lines.push('Profiles');
      for (const profile of snapshot.profiles) {
        lines.push(
          `- ${profile.id}: ${profile.label}`,
          `  adapter=${profile.adapter} status=${profile.status} live=${profile.liveExecutionEnabled ? 'enabled' : 'disabled'}`,
          `  isolation=${profile.isolation.kind}${profile.isolation.strongBoundary ? ' (strong)' : ' (supervised only)'}`,
          `  sees=${profile.root || profile.endpoint || profile.command || 'declared profile only'}`,
        );
      }
    }
    lines.push('', 'Safety: no profile is invoked without per-run approval.');
    return `${lines.join('\n')}\n`;
  }

  public renderReceiptText(receipt: ZavorthExternalAgentGatewayReceipt): string {
    return [
      'External Agent Gateway Receipt',
      `Status: ${receipt.status}`,
      `Kind: ${receipt.kind}`,
      `Profile: ${receipt.profile?.id || 'none'}`,
      `Adapter invoked: ${receipt.execution.adapterInvoked ? 'yes' : 'no'}`,
      `Live execution: ${receipt.execution.liveExecutionPerformed ? 'yes' : 'no'}`,
      `Live network: ${receipt.execution.liveNetworkPerformed ? 'yes' : 'no'}`,
      `Isolation: ${receipt.execution.isolationKind || 'none'}${receipt.execution.isolationStrongBoundary ? ' (strong)' : ''}`,
      '',
      receipt.output.text,
      '',
      `Next: ${receipt.nextAction.label}${receipt.nextAction.command ? ` | ${receipt.nextAction.command}` : ''}`,
    ].join('\n');
  }

  private invokeCli(
    profile: ZavorthExternalAgentProfile,
    prompt: string,
    input: ZavorthExternalAgentInvokeInput,
    started: number,
  ): ZavorthExternalAgentGatewayReceipt {
    if (!profile.command) {
      return this.blockedInvocation(profile, input, prompt, 'CLI profile has no command configured.');
    }
    if (profile.isolation.required && !profile.isolation.strongBoundary) {
      return this.blockedInvocation(
        profile,
        input,
        prompt,
        'Strong isolation is required for this profile. Re-register it with --isolation docker or --isolation wsl before live use.',
      );
    }
    const plan = this.buildCliExecutionPlan(profile, prompt);
    if (plan.blockedReason) {
      return this.blockedInvocation(profile, input, prompt, plan.blockedReason);
    }
    const result = this.spawnSyncImpl(plan.command, plan.args, {
      cwd: plan.cwd,
      input: plan.inputText,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      windowsHide: true,
      timeout: positiveInt(input.timeoutMs) || DEFAULT_TIMEOUT_MS,
      env: buildSafeEnv(),
      maxBuffer: 1024 * 1024 * 5,
    }) as SpawnSyncReturns<string>;
    const stdout = truncate(String(result.stdout || ''));
    const stderr = truncate(String(result.stderr || result.error?.message || ''));
    return this.buildReceipt({
      kind: 'agent-invocation',
      status:
        result.status === 0 && !result.error ? 'completed'
          : result.error?.message?.includes('timed out') ? 'failed'
            : 'failed',
      profile,
      requestedBy: input.requestedBy,
      prompt,
      approvalProvided: true,
      dryRun: false,
      outputText: stdout || stderr || 'External CLI completed without text output.',
      stdout,
      stderr,
      adapterInvoked: true,
      command: plan.command,
      args: plan.args,
      cwd: plan.cwd,
      exitCode: result.status ?? null,
      timedOut: Boolean(result.signal === 'SIGTERM' || result.error?.message?.includes('timed out')),
      durationMs: Date.now() - started,
      isolationKind: plan.isolationKind,
      isolationStrongBoundary: plan.isolationStrongBoundary,
      sandboxCommand: plan.sandboxCommand,
      liveExecutionPerformed: true,
      liveNetworkPerformed: plan.liveNetworkPerformed,
      nextLabel: result.status === 0 ? 'Review external agent output' : 'Inspect stderr before retrying',
      nextCommand: null,
    });
  }

  private buildCliExecutionPlan(profile: ZavorthExternalAgentProfile, prompt: string): CliExecutionPlan {
    const promptArgs = profile.promptMode === 'arg' ? [...profile.args, prompt] : profile.args;
    const inputText =
      profile.promptMode === 'stdin' || profile.promptMode === 'json'
        ? profile.promptMode === 'json'
          ? `${JSON.stringify({ prompt, source: 'zavorth-external-agent-gateway' })}\n`
          : `${prompt}\n`
        : undefined;
    const hostCwd = profile.root || this.projectRoot;

    if (profile.isolation.kind === 'docker') {
      const image = profile.isolation.image;
      if (!image) {
        return emptyCliPlan(
          profile,
          inputText,
          'Docker isolation requires a sandbox image. Re-register with --docker-image <image>.',
        );
      }
      const mount = profile.isolation.workspaceMount || hostCwd;
      if (!this.existsSyncImpl(mount)) {
        return emptyCliPlan(profile, inputText, `Docker workspace mount does not exist: ${mount}`);
      }
      const containerWorkdir = profile.isolation.workingDirectory || '/workspace';
      const dockerArgs = [
        'run',
        '--rm',
        '-i',
        '--network',
        profile.isolation.network === 'profile' && profile.allowRemoteNetwork ? 'bridge' : 'none',
      ];
      if (profile.isolation.readOnlyRoot) dockerArgs.push('--read-only');
      dockerArgs.push(
        '-v',
        `${mount}:/workspace${profile.isolation.readOnlyRoot ? ':ro' : ':rw'}`,
        '-w',
        containerWorkdir,
        image,
        profile.command || '',
        ...promptArgs,
      );
      return {
        command: 'docker',
        args: dockerArgs,
        cwd: this.projectRoot,
        inputText,
        isolationKind: 'docker',
        isolationStrongBoundary: true,
        sandboxCommand: 'docker run',
        liveNetworkPerformed: profile.isolation.network === 'profile' && profile.allowRemoteNetwork,
        blockedReason: null,
      };
    }

    if (profile.isolation.kind === 'wsl') {
      const distro = profile.isolation.distro || 'Ubuntu';
      const linuxCwd = profile.isolation.workingDirectory || toWslPath(hostCwd);
      return {
        command: 'wsl.exe',
        args: ['-d', distro, '--cd', linuxCwd, '--', profile.command || '', ...promptArgs],
        cwd: this.projectRoot,
        inputText,
        isolationKind: 'wsl',
        isolationStrongBoundary: true,
        sandboxCommand: 'wsl.exe',
        liveNetworkPerformed: profile.isolation.network === 'profile' && profile.allowRemoteNetwork,
        blockedReason: null,
      };
    }

    if (!this.existsSyncImpl(hostCwd)) {
      return emptyCliPlan(profile, inputText, `CLI cwd does not exist: ${hostCwd}`);
    }
    return {
      command: profile.command || '',
      args: promptArgs,
      cwd: hostCwd,
      inputText,
      isolationKind: 'local-supervised',
      isolationStrongBoundary: false,
      sandboxCommand: null,
      liveNetworkPerformed: false,
      blockedReason: null,
    };
  }

  private async invokeHttp(
    profile: ZavorthExternalAgentProfile,
    prompt: string,
    input: ZavorthExternalAgentInvokeInput,
    started: number,
  ): Promise<ZavorthExternalAgentGatewayReceipt> {
    if (!profile.endpoint) {
      return this.blockedInvocation(
        profile,
        input,
        prompt,
        `${profile.adapter.toUpperCase()} profile has no endpoint configured.`,
      );
    }
    if (!profile.allowRemoteNetwork && !isLocalEndpoint(profile.endpoint)) {
      return this.blockedInvocation(
        profile,
        input,
        prompt,
        'Remote network endpoint is blocked unless allowRemoteNetwork is enabled on the profile.',
      );
    }
    if (!this.fetchImpl) {
      return this.blockedInvocation(profile, input, prompt, 'fetch is not available in this runtime.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), positiveInt(input.timeoutMs) || DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(profile.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: profile.adapter === 'mcp' ? '2.0' : undefined,
          id: profile.adapter === 'mcp' ? `zavorth-${Date.now()}` : undefined,
          method: profile.adapter === 'mcp' ? 'zavorth.externalAgent.invoke' : undefined,
          prompt,
          params: profile.adapter === 'mcp' ? { prompt } : undefined,
          source: 'zavorth-external-agent-gateway',
        }),
        signal: controller.signal,
      });
      const text = truncate(await response.text());
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: response.ok ? 'completed' : 'failed',
        profile,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: true,
        dryRun: false,
        outputText: text || `HTTP ${response.status}`,
        stdout: text,
        stderr: response.ok ? null : `HTTP ${response.status}`,
        adapterInvoked: true,
        endpoint: profile.endpoint,
        durationMs: Date.now() - started,
        liveExecutionPerformed: true,
        liveNetworkPerformed: true,
        nextLabel: response.ok ? 'Review external agent output' : 'Inspect HTTP response before retrying',
        nextCommand: null,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth External Agent way] network request failed', error);
      return this.buildReceipt({
        kind: 'agent-invocation',
        status: 'failed',
        profile,
        requestedBy: input.requestedBy,
        prompt,
        approvalProvided: true,
        dryRun: false,
        outputText: error instanceof Error ? err.message : String(error),
        stderr: error instanceof Error ? err.message : String(error),
        adapterInvoked: true,
        endpoint: profile.endpoint,
        durationMs: Date.now() - started,
        timedOut: error instanceof Error && err.name === 'AbortError',
        liveExecutionPerformed: true,
        liveNetworkPerformed: true,
        nextLabel: 'Inspect network/endpoint configuration',
        nextCommand: null,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async invokeAcp(
    profile: ZavorthExternalAgentProfile,
    prompt: string,
    input: ZavorthExternalAgentInvokeInput,
    started: number,
  ): Promise<ZavorthExternalAgentGatewayReceipt> {
    const receipt = await this.acpSessionService.run({
      prompt,
      serverId: profile.acp.serverId || profile.id,
      transport: profile.acp.transport || 'local-jsonrpc',
      stdioCommand: profile.command || undefined,
      stdioArgs: profile.args,
      timeoutMs: positiveInt(input.timeoutMs) || DEFAULT_TIMEOUT_MS,
    });
    const rendered =
      typeof this.acpSessionService.renderText === 'function'
        ? this.acpSessionService.renderText(receipt)
        : receipt.output.text;
    return this.buildReceipt({
      kind: 'agent-invocation',
      status:
        receipt.status === 'completed'
          ? 'completed'
          : receipt.status === 'approval_required'
            ? 'approval-required'
            : receipt.status,
      profile,
      requestedBy: input.requestedBy,
      prompt,
      approvalProvided: true,
      dryRun: false,
      outputText: rendered,
      stdout: receipt.output.text,
      adapterInvoked: true,
      command: profile.command,
      args: profile.args,
      cwd: profile.root,
      endpoint: profile.endpoint,
      durationMs: Date.now() - started,
      liveExecutionPerformed: receipt.session.liveExecutionPerformed,
      liveNetworkPerformed: false,
      nextLabel: receipt.status === 'completed' ? 'Review ACP output' : 'Review ACP governance status',
      nextCommand: null,
    });
  }

  private blockedInvocation(
    profile: ZavorthExternalAgentProfile,
    input: ZavorthExternalAgentInvokeInput,
    prompt: string,
    message: string,
  ): ZavorthExternalAgentGatewayReceipt {
    return this.buildReceipt({
      kind: 'agent-invocation',
      status: 'blocked',
      profile,
      requestedBy: input.requestedBy,
      prompt,
      approvalProvided: Boolean(input.approvalGranted),
      dryRun: true,
      outputText: message,
      nextLabel: 'Fix profile configuration',
      nextCommand: `zavorth external-agent list --json`,
    });
  }

  private normalizeProfile(input: ZavorthExternalAgentRegisterInput): ZavorthExternalAgentProfile {
    const now = this.now().toISOString();
    const adapter = input.adapter || inferAdapter(input);
    const id = normalizeId(input.id || input.label || input.command || input.endpoint || 'external-agent');
    const root = input.root ? resolveHostWorkspaceMount(String(input.root)) : null;
    const isolation = normalizeIsolation(input, adapter, root, this.projectRoot);
    return {
      id,
      label: String(input.label || id).trim(),
      adapter,
      status: 'enabled',
      root,
      command: cleanCommand(input.command),
      args: Array.isArray(input.args) ? input.args.map((entry) => String(entry)) : [],
      endpoint: clean(input.endpoint),
      acp: {
        serverId: clean(input.acpServerId),
        transport: input.acpTransport || (adapter === 'acp' ? 'local-jsonrpc' : null),
      },
      promptMode: input.promptMode || 'stdin',
      allowedCapabilities: (input.allowedCapabilities || ['chat', 'analyze', 'review'])
        .map((entry) => String(entry).trim())
        .filter(Boolean),
      liveExecutionEnabled: input.enableLive === true && input.approvalGranted === true,
      allowRemoteNetwork: input.allowRemoteNetwork === true,
      isolation,
      createdAt: now,
      updatedAt: now,
      provenance: {
        source: input.source || (input.onboardingCandidateId ? 'onboarding-candidate' : 'manual'),
        onboardingCandidateId: clean(input.onboardingCandidateId),
      },
      safety: {
        requiresApprovalPerInvocation: true,
        noDefaultRuntimeBinding: true,
        secretsPassedThroughEnv: false,
        toolExposureByDefault: false,
        strongIsolationAvailable: true,
        localCliIsNotOsSandbox: adapter === 'cli' && isolation.kind === 'local-supervised',
      },
    };
  }

  private readProfiles(): ZavorthExternalAgentProfile[] {
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(this.registryFile, 'utf8') as string) as { profiles?: unknown };
      return Array.isArray(parsed.profiles)
        ? (parsed.profiles.map((entry) => sanitizeProfile(entry)).filter(Boolean) as ZavorthExternalAgentProfile[])
        : [];
    } catch (error: unknown) {
      if (!isMissingFileError(error)) {
        logger.warn('[Zavorth External Agent way] JSON parse failed', error);
      }
      return [];
    }
  }

  private writeProfiles(profiles: ZavorthExternalAgentProfile[]): void {
    this.mkdirSyncImpl(path.dirname(this.registryFile), { recursive: true });
    this.writeFileSyncImpl(
      this.registryFile,
      `${JSON.stringify(
        {
          contractVersion: ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
          updatedAt: this.now().toISOString(),
          profiles,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  private writeReceipt(receipt: ZavorthExternalAgentGatewayReceipt, receiptPath?: string | null): void {
    const target = this.resolveReceiptPath(receiptPath);
    this.mkdirSyncImpl(path.dirname(target), { recursive: true });
    this.writeFileSyncImpl(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  }

  private resolveReceiptPath(receiptPath?: string | null): string {
    const runtimeDir = path.resolve(this.projectRoot, 'data', 'runtime');
    const fallback = path.join(runtimeDir, 'external-agent-last-receipt.json');
    if (!receiptPath) {
      return fallback;
    }
    const resolved = path.resolve(String(receiptPath));
    const relative = path.relative(runtimeDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return fallback;
    }
    return resolved;
  }

  private buildReceipt(input: {
    kind: 'profile-registration' | 'agent-invocation';
    status: ZavorthExternalAgentGatewayReceipt['status'];
    profile: ZavorthExternalAgentProfile | null;
    requestedBy?: string | null;
    prompt?: string | null;
    approvalProvided: boolean;
    dryRun: boolean;
    outputText: string;
    stdout?: string | null;
    stderr?: string | null;
    adapterInvoked?: boolean;
    command?: string | null;
    args?: string[];
    cwd?: string | null;
    endpoint?: string | null;
    exitCode?: number | null;
    durationMs?: number;
    timedOut?: boolean;
    isolationKind?: ZavorthExternalAgentIsolationKind | null;
    isolationStrongBoundary?: boolean;
    sandboxCommand?: string | null;
    liveExecutionPerformed?: boolean;
    liveNetworkPerformed?: boolean;
    nextLabel?: string;
    nextCommand?: string | null;
  }): ZavorthExternalAgentGatewayReceipt {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
      surface: 'external-agent-gateway',
      kind: input.kind,
      status: input.status,
      profile: sanitizeProfileForReceipt(input.profile),
      request: {
        requestedBy: String(input.requestedBy || 'operator').trim() || 'operator',
        promptHash: input.prompt ? hashPrompt(input.prompt) : null,
        promptPreview: input.prompt ? truncate(redactSensitiveText(input.prompt), 240) : null,
        approvalProvided: input.approvalProvided,
        dryRun: input.dryRun,
      },
      execution: {
        adapterInvoked: input.adapterInvoked === true,
        adapter: input.profile?.adapter || null,
        command: input.command || null,
        args: (input.args || []).map((arg) => redactSensitiveText(arg)),
        cwd: input.cwd || null,
        endpoint: input.endpoint ? redactSensitiveText(input.endpoint) : null,
        exitCode: input.exitCode ?? null,
        durationMs: input.durationMs || 0,
        timedOut: input.timedOut === true,
        isolationKind: input.isolationKind || input.profile?.isolation.kind || null,
        isolationStrongBoundary: input.isolationStrongBoundary ?? input.profile?.isolation.strongBoundary ?? false,
        sandboxCommand: input.sandboxCommand === undefined ? null : input.sandboxCommand,
        liveExecutionPerformed: input.liveExecutionPerformed === true,
        liveNetworkPerformed: input.liveNetworkPerformed === true,
      },
      output: {
        text: truncate(redactSensitiveText(input.outputText || '')),
        stdout: input.stdout === undefined ? null : truncate(redactSensitiveText(String(input.stdout || ''))),
        stderr: input.stderr === undefined ? null : truncate(redactSensitiveText(String(input.stderr || ''))),
      },
      nextAction: {
        label: input.nextLabel || 'Review receipt',
        command: input.nextCommand === undefined ? null : input.nextCommand,
      },
      safety: {
        approvalRequired: true,
        approvalBypassAllowed: false,
        noShellInterpolation: true,
        rawSecretsSerialized: false,
        profileOnlyNoDefaultBinding: true,
        filesystemSandboxClaimed: input.isolationStrongBoundary ?? input.profile?.isolation.strongBoundary ?? false,
        localCliIsNotOsSandbox:
          input.profile?.adapter === 'cli' &&
          (input.isolationKind || input.profile.isolation.kind) === 'local-supervised',
        strongIsolationRequiredForUntrustedCli: true,
      },
    };
  }
}

function sanitizeProfile(value: unknown): ZavorthExternalAgentProfile | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as ZavorthExternalAgentProfile;
  const adapter = ['cli', 'http', 'acp', 'mcp'].includes(entry.adapter) ? entry.adapter : null;
  const id = normalizeId(entry.id || '');
  if (!adapter || !id) return null;
  const isolation = sanitizeIsolation(entry.isolation, adapter, entry.root || null);
  return {
    ...entry,
    id,
    adapter,
    status: entry.status === 'disabled' ? 'disabled' : 'enabled',
    args: Array.isArray(entry.args) ? entry.args.map((arg) => String(arg)) : [],
    allowedCapabilities: Array.isArray(entry.allowedCapabilities)
      ? entry.allowedCapabilities.map((cap) => String(cap))
      : [],
    liveExecutionEnabled: entry.liveExecutionEnabled === true,
    allowRemoteNetwork: entry.allowRemoteNetwork === true,
    isolation,
    safety: {
      requiresApprovalPerInvocation: true,
      noDefaultRuntimeBinding: true,
      secretsPassedThroughEnv: false,
      toolExposureByDefault: false,
      strongIsolationAvailable: true,
      localCliIsNotOsSandbox: adapter === 'cli' && isolation.kind === 'local-supervised',
    },
  };
}

function sanitizeReceipt(value: unknown): ZavorthExternalAgentGatewayReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const receipt = value as ZavorthExternalAgentGatewayReceipt;
  if (receipt.surface !== 'external-agent-gateway') return null;
  return {
    ...receipt,
    profile: sanitizeProfileForReceipt(sanitizeProfile(receipt.profile)),
    request: {
      ...receipt.request,
      promptPreview: receipt.request?.promptPreview ? redactSensitiveText(receipt.request.promptPreview) : null,
    },
    execution: {
      ...receipt.execution,
      args: Array.isArray(receipt.execution?.args) ? receipt.execution.args.map((arg) => redactSensitiveText(arg)) : [],
      endpoint: receipt.execution?.endpoint ? redactSensitiveText(receipt.execution.endpoint) : null,
    },
    output: {
      text: truncate(redactSensitiveText(receipt.output?.text || '')),
      stdout:
        receipt.output?.stdout === null || receipt.output?.stdout === undefined
          ? null
          : truncate(redactSensitiveText(receipt.output.stdout)),
      stderr:
        receipt.output?.stderr === null || receipt.output?.stderr === undefined
          ? null
          : truncate(redactSensitiveText(receipt.output.stderr)),
    },
  };
}

function normalizeIsolation(
  input: ZavorthExternalAgentRegisterInput,
  adapter: ZavorthExternalAgentAdapterKind,
  root: string | null,
  projectRoot: string,
): ZavorthExternalAgentProfile['isolation'] {
  const kind = adapter === 'cli' ? normalizeIsolationKind(input.isolation) : 'local-supervised';
  const network = normalizeNetworkMode(input.network);
  const required = input.requireStrongIsolation === true;
  const image = clean(input.sandboxImage || input.dockerImage);
  const distro = clean(input.wslDistro);
  const workspaceMount = input.workspaceMount
    ? resolveHostWorkspaceMount(String(input.workspaceMount))
    : kind === 'docker'
      ? root || projectRoot
      : null;
  const workingDirectory =
    clean(input.sandboxWorkdir || input.workingDirectory) || (kind === 'docker' ? '/workspace' : null);
  const notes = buildIsolationNotes(adapter, kind, required);
  return {
    kind,
    required,
    strongBoundary: kind === 'docker' || kind === 'wsl',
    image: kind === 'docker' ? image : null,
    distro: kind === 'wsl' ? distro || 'Ubuntu' : null,
    workspaceMount,
    workingDirectory,
    network,
    readOnlyRoot: kind === 'docker' ? input.readOnlyRoot !== false : input.readOnlyRoot === true,
    notes,
  };
}

function sanitizeIsolation(
  value: unknown,
  adapter: ZavorthExternalAgentAdapterKind,
  root: string | null,
): ZavorthExternalAgentProfile['isolation'] {
  const entry = value && typeof value === 'object' ? (value as Partial<ZavorthExternalAgentProfile['isolation']>) : {};
  const kind = adapter === 'cli' ? normalizeIsolationKind(entry.kind) : 'local-supervised';
  const required = entry.required === true;
  return {
    kind,
    required,
    strongBoundary: kind === 'docker' || kind === 'wsl',
    image: kind === 'docker' ? clean(entry.image) : null,
    distro: kind === 'wsl' ? clean(entry.distro) || 'Ubuntu' : null,
    workspaceMount: clean(entry.workspaceMount) || (kind === 'docker' ? root : null),
    workingDirectory: clean(entry.workingDirectory) || (kind === 'docker' ? '/workspace' : null),
    network: normalizeNetworkMode(entry.network),
    readOnlyRoot: kind === 'docker' ? entry.readOnlyRoot !== false : entry.readOnlyRoot === true,
    notes: Array.isArray(entry.notes)
      ? entry.notes.map((note) => String(note)).filter(Boolean)
      : buildIsolationNotes(adapter, kind, required),
  };
}

function normalizeIsolationKind(value: unknown): ZavorthExternalAgentIsolationKind {
  if (value === 'docker') return 'docker';
  if (value === 'wsl') return 'wsl';
  return 'local-supervised';
}

function normalizeNetworkMode(value: unknown): ZavorthExternalAgentNetworkMode {
  if (value === 'profile') return 'profile';
  if (value === 'local-only') return 'local-only';
  return 'disabled';
}

function buildIsolationNotes(
  adapter: ZavorthExternalAgentAdapterKind,
  kind: ZavorthExternalAgentIsolationKind,
  required: boolean,
): string[] {
  const notes: string[] = [];
  if (adapter !== 'cli') notes.push('isolation currently applies to CLI adapter execution');
  if (kind === 'local-supervised') notes.push('local supervised CLI is not an operating-system sandbox');
  if (kind === 'docker') notes.push('Docker run provides the process boundary for this profile');
  if (kind === 'wsl') notes.push('WSL provides the process boundary for this profile');
  if (required) notes.push('strong isolation is required before live invocation');
  return notes;
}

function emptyCliPlan(
  profile: ZavorthExternalAgentProfile,
  inputText: string | undefined,
  blockedReason: string,
): CliExecutionPlan {
  return {
    command: profile.command || '',
    args: profile.args,
    cwd: profile.root || process.cwd(),
    inputText,
    isolationKind: profile.isolation.kind,
    isolationStrongBoundary: profile.isolation.strongBoundary,
    sandboxCommand: null,
    liveNetworkPerformed: false,
    blockedReason,
  };
}

function resolveHostWorkspaceMount(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  // Keep absolute Windows drive paths intact on non-Windows CI hosts so WSL
  // translation can recover C:\... without path.resolve() treating it as relative.
  if (/^[a-zA-Z]:[\\/]/.test(raw) || /(?:^|[\\/])[a-zA-Z]:[\\/]/.test(raw)) {
    return raw;
  }
  return path.resolve(raw);
}

function toWslPath(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '~';

  // Linux path.resolve() may prefix a Windows path with the POSIX cwd
  // (e.g. "/home/runner/?/C:\\Users\\me\\work"). Recover the drive path first.
  const embeddedDrive = raw.match(/(?:^|[\\/])([a-zA-Z]):[\\/](.*)$/);
  if (embeddedDrive) {
    const rest = embeddedDrive[2].replace(/\\/g, '/').replace(/^\/+/g, '');
    return `/mnt/${embeddedDrive[1].toLowerCase()}/${rest}`;
  }

  if (raw.startsWith('/')) return raw;
  const uncMatch = raw.match(/^\\\\(?:wsl(?:\.localhost)?\$?)\\[^\\]+\\(.+)$/i);
  if (uncMatch) return `/${uncMatch[1].replace(/\\/g, '/')}`;
  const driveMatch = raw.match(/^([a-zA-Z]):[\\/](.+)$/);
  if (driveMatch) return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2].replace(/\\/g, '/')}`;
  return raw.replace(/\\/g, '/');
}

function inferAdapter(input: ZavorthExternalAgentRegisterInput): ZavorthExternalAgentAdapterKind {
  if (input.adapter) return input.adapter;
  if (input.endpoint && String(input.endpoint).toLowerCase().includes('mcp')) return 'mcp';
  if (input.endpoint) return 'http';
  if (input.acpServerId || input.acpTransport) return 'acp';
  return 'cli';
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1000) : null;
}

function cleanCommand(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  return /[|;&<>`]/.test(text) ? null : text;
}

function normalizeId(value: unknown): string {
  const base = String(value || 'external-agent')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `external-agent-${Date.now()}`;
}

function sortProfiles(profiles: ZavorthExternalAgentProfile[]): ZavorthExternalAgentProfile[] {
  return [...profiles].sort((a, b) => a.id.localeCompare(b.id));
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 24);
}

function truncate(value: string, max = MAX_OUTPUT_CHARS): string {
  return String(value || '').length > max ? `${String(value).slice(0, max)}\n[truncated]` : String(value || '');
}

function redactSensitiveText(value: unknown): string {
  return String(value || '')
    .replace(/\b(sk-[A-Za-z0-9_-]{12})\b/g, 'sk-[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{12})\b/g, 'xox-[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{12})\b/g, 'gh_[redacted]')
    .replace(/\b([A-Za-z0-9+/]{40}={0,2})\b/g, '[redacted-secret-like-token]')
    .replace(
      /\b([A-Z0-9_]*(?:api[_-]?key|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi,
      '$1=[redacted]',
    );
}

function sanitizeProfileForReceipt(profile: ZavorthExternalAgentProfile | null): ZavorthExternalAgentProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    args: profile.args.map((arg) => redactSensitiveText(arg)),
    endpoint: profile.endpoint ? redactSensitiveText(profile.endpoint) : null,
    acp: {
      ...profile.acp,
      serverId: profile.acp.serverId ? redactSensitiveText(profile.acp.serverId) : null,
    },
  };
}

function isLocalEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch (error: unknown) {
    logger.warn('[Zavorth External Agent way] operation failed', error);
    return false;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function buildSafeEnv(): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'Path',
    'SystemRoot',
    'COMSPEC',
    'PATHEXT',
    'HOME',
    'USERPROFILE',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.ZAVORTH_EXTERNAL_AGENT_GATEWAY = '1';
  return env;
}
