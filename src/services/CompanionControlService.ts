import { asErrorLike } from '../utils/errorLike';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { config } from '../config/index.js';
import type {
  CompanionActionId,
  CompanionActionResult,
  CompanionControlSnapshot,
  CompanionControlState,
  CompanionDescriptor,
  CompanionId,
  CompanionStateRecord,
} from '../contracts/CompanionControlContract.js';
import type { DesktopResourceSnapshot } from '../contracts/DesktopResourceContract.js';
import { ZavorthBridgeControlService } from './ZavorthBridgeControlService.js';
import { CompanionApprovalPlanner } from './CompanionApprovalPlanner.js';
import { CompanionLifecyclePolicy } from './CompanionLifecyclePolicy.js';
import { DesktopResourcePlaneService } from './DesktopResourcePlaneService.js';
import { TaskResourcePlannerService } from './TaskResourcePlannerService.js';
import { WslControlService } from './WslControlService.js';
import { logger } from '../logger.js';

type CompanionActionPayload = Record<string, unknown>;

type ExecLike = (
  file: string,
  args: string[],
  options?: {
    timeoutMs?: number;
  },
) => Promise<string>;

type CompanionControlServiceRuntime = {
  now?: () => Date;
  stateFilePath?: string;
  desktopResources?: Pick<DesktopResourcePlaneService, 'inspectLive' | 'readLatest'>;
  lifecyclePolicy?: Pick<CompanionLifecyclePolicy, 'buildSnapshot' | 'buildDescriptor'>;
  approvalPlanner?: Pick<CompanionApprovalPlanner, 'plan'>;
  impactPlanner?: Pick<TaskResourcePlannerService, 'planCompanionAction' | 'renderImpactSummary'>;
  wslControl?: Pick<WslControlService, 'status' | 'start' | 'shutdown'>;
  zavorthBridgeControl?: Pick<ZavorthBridgeControlService, 'status' | 'restart'>;
  exec?: ExecLike;
};

export class CompanionControlService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly desktopResources: Pick<DesktopResourcePlaneService, 'inspectLive' | 'readLatest'>;
  private readonly lifecyclePolicy: Pick<CompanionLifecyclePolicy, 'buildSnapshot' | 'buildDescriptor'>;
  private readonly approvalPlanner: Pick<CompanionApprovalPlanner, 'plan'>;
  private readonly impactPlanner: Pick<TaskResourcePlannerService, 'planCompanionAction' | 'renderImpactSummary'>;
  private readonly wslControl: Pick<WslControlService, 'status' | 'start' | 'shutdown'>;
  private readonly zavorthBridgeControl: Pick<ZavorthBridgeControlService, 'status' | 'restart'>;
  private readonly exec: ExecLike;

  constructor(runtime: CompanionControlServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath = runtime.stateFilePath || config.companionsStateFile;
    this.desktopResources = runtime.desktopResources || new DesktopResourcePlaneService();
    this.lifecyclePolicy = runtime.lifecyclePolicy || new CompanionLifecyclePolicy();
    this.approvalPlanner = runtime.approvalPlanner || new CompanionApprovalPlanner();
    this.impactPlanner = runtime.impactPlanner || new TaskResourcePlannerService({
      desktopResources: this.desktopResources as Pick<DesktopResourcePlaneService, 'readLatest' | 'inspectLive'>,
    });
    this.wslControl = runtime.wslControl || new WslControlService();
    this.zavorthBridgeControl = runtime.zavorthBridgeControl || new ZavorthBridgeControlService();
    this.exec = runtime.exec || this.execFileAsync.bind(this);
  }

  public async buildSnapshot(
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<CompanionControlSnapshot> {
    const desktop = await this.readDesktopSnapshot(options.preferCachedWithinMs);
    return this.lifecyclePolicy.buildSnapshot(desktop, this.readState().lastActions);
  }

  public async listCompanions(
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<CompanionControlSnapshot> {
    return this.buildSnapshot(options);
  }

  public async inspectCompanion(
    companionId: CompanionId,
    options: {
      preferCachedWithinMs?: number;
    } = {},
  ): Promise<CompanionDescriptor> {
    const desktop = await this.readDesktopSnapshot(options.preferCachedWithinMs);
    const descriptor = this.lifecyclePolicy.buildDescriptor(
      companionId,
      desktop,
      this.readState().lastActions[companionId],
    );

    if (companionId === 'zavorthBridge') {
      try {
        const status = await this.zavorthBridgeControl.status();
        descriptor.details = [
          ...descriptor.details,
          status.message || 'Status nactive do ZavorthBridge lido with success.',
        ].slice(0, 6);
      } catch (error: unknown) {// Keep the desktop-plane view even when the native status fails.
      logger.warn('[Companion Control] operation failed', error);
    }
    }

    return descriptor;
  }

  public async executeAction(input: {
    companionId: CompanionId;
    actionId: CompanionActionId;
    requestedBy?: string | null;
    dryRun?: boolean;
    force?: boolean;
  }): Promise<CompanionActionResult> {
    const desktop = await this.readDesktopSnapshot(5_000);
    const companion = this.lifecyclePolicy.buildDescriptor(
      input.companionId,
      desktop,
      this.readState().lastActions[input.companionId],
    );
    const plan = this.approvalPlanner.plan({
      companionId: input.companionId,
      actionId: input.actionId,
      companion,
      dryRun: input.dryRun === true,
    });
    const resourceImpact = await this.impactPlanner.planCompanionAction(
      input.companionId,
      input.actionId,
      {
        intent: `${input.actionId} ${input.companionId}`,
      },
    );

    if (!plan.allowed) {
      return {
        ...plan,
        resourceImpact,
        result: null,
        snapshot: await this.buildSnapshot({ preferCachedWithinMs: 5_000 }),
      };
    }

    if (plan.requiresApproval && input.force !== true) {
      return {
        ...plan,
        ok: false,
        resourceImpact,
        result: {
          status: 'approval_required',
          requestedBy: String(input.requestedBy || '').trim() || null,
        },
        snapshot: await this.buildSnapshot({ preferCachedWithinMs: 5_000 }),
      };
    }

    if (input.dryRun === true || input.actionId === 'inspect') {
      return {
        ...plan,
        ok: true,
        resourceImpact,
        result: {
          status: input.actionId === 'inspect' ? 'inspected' : 'preview',
        },
        snapshot: await this.buildSnapshot({ preferCachedWithinMs: 5_000 }),
      };
    }

    const result = await this.runAction({
      ...input,
      desktop,
      companion,
    });
    const actionRecord = this.recordActionState({
      companionId: input.companionId,
      actionId: input.actionId,
      ok: result.ok,
      summary: result.summary,
    });
    const settledDesktop = await this.settleDesktopAfterAction({
      companionId: input.companionId,
      actionId: input.actionId,
      ok: result.ok,
    });
    const nextSnapshot = this.buildSnapshotFromDesktop(settledDesktop, {
      ...this.readState().lastActions,
      [input.companionId]: actionRecord,
    });
    const finalResult: CompanionActionResult = {
      ...plan,
      ok: result.ok,
      executed: true,
      summary: result.summary,
      reason: result.reason,
      resourceImpact,
      result: result.payload,
      snapshot: nextSnapshot,
    };
    return finalResult;
  }

  public renderSnapshot(snapshot: CompanionControlSnapshot): string {
    const lines = [
      'Companion Control Plane',
      '',
    ];

    for (const companion of snapshot.companions) {
      lines.push(
        `- ${companion.label}: ${companion.status} | ${companion.workingSetMb} MB | ${companion.summary}`,
      );
    }

    if (snapshot.recommendations.length > 0) {
      lines.push('', 'Recomendactions:');
      for (const recommendation of snapshot.recommendations.slice(0, 6)) {
        lines.push(`- ${recommendation}`);
      }
    }

    if (snapshot.warnings.length > 0) {
      lines.push('', 'Alertas:');
      for (const warning of snapshot.warnings.slice(0, 6)) {
        lines.push(`- ${warning}`);
      }
    }

    return lines.join('\n');
  }

  public renderCompanion(companion: CompanionDescriptor): string {
    const lines = [
      `${companion.label}`,
      '',
      `Status: ${companion.status}.`,
      `Observed RAM: ${companion.workingSetMb} MB em ${companion.processCount} process(s).`,
      companion.summary,
    ];

    if (companion.details.length > 0) {
      lines.push('', 'Detalhes:');
      for (const detail of companion.details.slice(0, 6)) {
        lines.push(`- ${detail}`);
      }
    }

    if (companion.actions.length > 0) {
      lines.push('', 'Actions:');
      for (const action of companion.actions) {
        lines.push(
          `- ${action.actionId}: ${action.label} | ${action.available ? 'available' : 'unavailable'} | ${action.requiresApproval ? 'approval' : 'without approval'}`,
        );
      }
    }

    return lines.join('\n');
  }

  public renderActionResult(result: CompanionActionResult): string {
    const lines = [
      `${result.companion.label} -> ${result.actionId}`,
      '',
      result.summary,
      `Reason: ${result.reason}`,
      `Safety: ${result.safety}${result.requiresApproval ? ' | approval required' : ''}.`,
      result.resourceImpact ? `Estimated impact: ${this.impactPlanner.renderImpactSummary(result.resourceImpact)}` : null,
    ];

    if (result.result?.message) {
      lines.push(`Result: ${result.result.message}`);
    }

    if (result.snapshot?.warnings?.length) {
      lines.push('', 'Current alerts:');
      for (const warning of result.snapshot.warnings.slice(0, 4)) {
        lines.push(`- ${warning}`);
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  private async runAction(input: {
    companionId: CompanionId;
    actionId: CompanionActionId;
    requestedBy?: string | null;
    desktop: DesktopResourceSnapshot;
    companion: CompanionDescriptor;
  }): Promise<{
    ok: boolean;
    summary: string;
    reason: string;
    payload: CompanionActionPayload | null;
  }> {
    switch (input.companionId) {
      case 'wsl':
        return this.runWslAction(input);
      case 'docker-desktop':
        return this.runDockerAction(input);
      case 'zavorthBridge':
        return this.runZavorthBridgeAction(input);
      case 'codex-companion':
        return this.runCodexAction(input);
      default:
        return {
          ok: false,
          summary: 'Companion not supported.',
          reason: 'Unknown ID.',
          payload: null,
        };
    }
  }

  private async runWslAction(input: {
    actionId: CompanionActionId;
    companion: CompanionDescriptor;
    desktop: DesktopResourceSnapshot;
  }): Promise<{
    ok: boolean;
    summary: string;
    reason: string;
    payload: CompanionActionPayload | null;
  }> {
    if (input.actionId === 'resume') {
      const defaultDistro = input.desktop.signals.wsl.distros.find((entry) => entry.isDefault)?.name || undefined;
      const result = await this.wslControl.start(defaultDistro);
      return {
        ok: result.ok,
        summary: result.message,
        reason: defaultDistro ? `Tentei resume a distro default ${defaultDistro}.`
          : 'Tried to resume WSL through the default route.',
        payload: result as unknown as CompanionActionPayload,
      };
    }

    if (input.actionId === 'hibernate') {
      const result = await this.wslControl.shutdown();
      return {
        ok: result.ok,
        summary: result.message,
        reason: 'Supervised WSL shutdown.',
        payload: result as unknown as CompanionActionPayload,
      };
    }

    if (input.actionId === 'trim') {
      return {
        ok: true,
        summary: 'WSL revisado without mutation.',
        reason: 'Nesta stage o modo leve do WSL only recomenda hibernaction/resumption supervised.',
        payload: {
          status: 'review-only',
          runningDistros: input.companion.runningDistros,
        },
      };
    }

    return {
      ok: false,
      summary: `Action ${input.actionId} is not implemented for WSL.`,
      reason: 'Action not supported.',
      payload: null,
    };
  }

  private async runDockerAction(input: {
    actionId: CompanionActionId;
    companion: CompanionDescriptor;
    desktop: DesktopResourceSnapshot;
  }): Promise<{
    ok: boolean;
    summary: string;
    reason: string;
    payload: CompanionActionPayload | null;
  }> {
    if (input.actionId === 'resume') {
      const executable = this.resolveDockerExecutable(input.desktop);
      if (!executable) {
        return {
          ok: false,
          summary: 'Could not find Docker Desktop executable on this host.',
          reason: 'Executable missing.',
          payload: null,
        };
      }
      await this.startProcess(executable);
      return {
        ok: true,
        summary: 'Docker Desktop acionado again.',
        reason: 'Resumesda local do app.',
        payload: {
          status: 'started',
          executable,
        },
      };
    }

    if (input.actionId === 'stop-idle' || input.actionId === 'hibernate') {
      const processIds = this.resolveProcessIds(input.desktop, 'docker-desktop');
      const installRoots = this.resolveDockerInstallRoots(input.desktop);
      if (processIds.length === 0 && installRoots.length === 0) {
        return {
          ok: true,
          summary: 'Docker Desktop already estava parado.',
          reason: 'There was no active process to stop.',
          payload: {
            status: 'already-stopped',
          },
        };
      }
      await this.stopDockerDesktopProcesses({
        processIds,
        installRoots,
      });
      return {
        ok: true,
        summary: 'Docker Desktop stopped successfully.',
        reason:
          (input.desktop.signals.docker.runningContainerCount || 0) > 0
            ? 'Forced shutdown with active containers under explicit confirmation.'
            : 'Idle companion shutdown.',
        payload: {
          status: 'stopped',
          processIds,
          installRoots,
        },
      };
    }

    if (input.actionId === 'trim') {
      return {
        ok: true,
        summary: 'Docker Desktop revisado without mutation.',
        reason: 'Light mode recommends hibernation when containers are at zero.',
        payload: {
          status: 'review-only',
          runningContainerCount: input.desktop.signals.docker.runningContainerCount,
        },
      };
    }

    return {
      ok: false,
      summary: `Action ${input.actionId} is not implemented for Docker Desktop.`,
      reason: 'Action not supported.',
      payload: null,
    };
  }

  private async runZavorthBridgeAction(input: {
    actionId: CompanionActionId;
  }): Promise<{
    ok: boolean;
    summary: string;
    reason: string;
    payload: CompanionActionPayload | null;
  }> {
    if (input.actionId === 'restart-safe') {
      const result = await this.zavorthBridgeControl.restart();
      return {
        ok: result.ok,
        summary: result.message || 'Supervised ZavorthBridge restart executed.',
        reason: 'Restart via surface nactive do ZavorthBridge.',
        payload: result as unknown as CompanionActionPayload,
      };
    }

    if (input.actionId === 'trim') {
      const result = await this.zavorthBridgeControl.status().catch(() => null);
      return {
        ok: true,
        summary: 'ZavorthBridge reviewed in light mode.',
        reason: 'At this step, ZavorthBridge trim provides guided reading, not blind kill.',
        payload: result as unknown as CompanionActionPayload,
      };
    }

    return {
      ok: false,
      summary: `Action ${input.actionId} is not implemented for ZavorthBridge.`,
      reason: 'Action not supported.',
      payload: null,
    };
  }

  private async runCodexAction(input: {
    actionId: CompanionActionId;
    companion: CompanionDescriptor;
  }): Promise<{
    ok: boolean;
    summary: string;
    reason: string;
    payload: CompanionActionPayload | null;
  }> {
    if (input.actionId === 'trim') {
      return {
        ok: true,
        summary: 'Codex reviewed in light mode.',
        reason: 'At this lifecycle point, Codex trim recommends reducing idle sessions and processes without force-closing anything.',
        payload: {
          status: 'review-only',
          processCount: input.companion.processCount,
        },
      };
    }

    return {
      ok: false,
      summary: `Action ${input.actionId} is not implemented for Codex.`,
      reason: 'Action not supported.',
      payload: null,
    };
  }

  private resolveDockerExecutable(desktop: DesktopResourceSnapshot): string | null {
    const livePath = desktop.items.find((entry) => entry.controlId === 'docker-desktop')?.process?.executablePath || null;
    if (livePath && fs.existsSync(livePath)) {
      return livePath;
    }
    const candidates = [
      'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
      'C:\\Program Files\\Docker\\Docker\\resources\\Docker Desktop.exe',
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  private resolveProcessIds(desktop: DesktopResourceSnapshot, companionId: CompanionId): number[] {
    return desktop.items
      .filter((entry) => entry.controlId === companionId && entry.process?.pid)
      .map((entry) => Number(entry.process?.pid || 0))
      .filter((pid) => pid > 0);
  }

  private resolveDockerInstallRoots(desktop: DesktopResourceSnapshot): string[] {
    const roots = new Set<string>();
    const knownExecutables = [
      this.resolveDockerExecutable(desktop),
      ...desktop.items
        .filter((entry) => entry.controlId === 'docker-desktop')
        .map((entry) => String(entry.process?.executablePath || '').trim())
        .filter(Boolean),
    ];

    for (const executable of knownExecutables) {
      const normalized = String(executable || '').trim();
      if (!normalized) {
        continue;
      }
      const resolved = path.resolve(normalized);
      if (!fs.existsSync(resolved)) {
        continue;
      }
      const parent = path.dirname(resolved);
      roots.add(parent);
      if (path.basename(parent).toLowerCase() === 'frontend') {
        roots.add(path.dirname(parent));
      }
      if (path.basename(parent).toLowerCase() === 'resources') {
        roots.add(path.dirname(parent));
      }
      if (path.basename(parent).toLowerCase() === 'cli-plugins') {
        roots.add(path.dirname(parent));
      }
    }

    const defaults = [
      'C:\\Program Files\\Docker\\Docker',
      'C:\\Program Files\\Docker\\cli-plugins',
    ];
    for (const candidate of defaults) {
      if (fs.existsSync(candidate)) {
        roots.add(path.resolve(candidate));
      }
    }

    return Array.from(roots);
  }

  private async stopProcessIds(processIds: number[]): Promise<void> {
    if (processIds.length === 0) {
      return;
    }
    const ids = processIds.join(',');
    const script = `$ids = @(${ids}); Get-Process | Where-Object { $ids -contains $_.Id } | Stop-Process -Force`;
    await this.exec('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 20_000 });
  }

  private async stopDockerDesktopProcesses(input: {
    processIds: number[];
    installRoots: string[];
  }): Promise<void> {
    const dockerRoots = input.installRoots
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .map((entry) => `'${entry.replace(/'/g, "''")}'`);
    const ids = input.processIds
      .filter((pid) => Number.isFinite(pid) && pid > 0)
      .map((pid) => String(pid));
    const script = [
      `$roots = @(${dockerRoots.join(',')})`,
      `$explicitIds = @(${ids.join(',')})`,
      `$dockerNames = @('Docker Desktop.exe','com.docker.backend.exe','com.docker.build.exe','docker-agent.exe','docker-sandbox.exe')`,
      `function Test-DockerProcessPath([string]$candidatePath) {`,
      `  if (-not $candidatePath) { return $false }`,
      `  foreach ($root in $roots) {`,
      `    if ($root -and $candidatePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }`,
      `  }`,
      `  return $false`,
      `}`,
      `$candidateIds = New-Object 'System.Collections.Generic.HashSet[int]'`,
      `foreach ($id in $explicitIds) { if ($id -gt 0) { [void]$candidateIds.Add([int]$id) } }`,
      `$processes = Get-CimInstance Win32_Process | Where-Object { (Test-DockerProcessPath ([string]$_.ExecutablePath)) -or ($dockerNames -contains $_.Name) }`,
      `foreach ($process in $processes) {`,
      `  if ($process.ProcessId -gt 0) { [void]$candidateIds.Add([int]$process.ProcessId) }`,
      `}`,
      `$orderedIds = $candidateIds.ToArray() | Sort-Object -Descending`,
      `foreach ($pid in $orderedIds) {`,
      `  try { & taskkill.exe /PID $pid /T /F | Out-Null } catch {}`,
      `}`,
      `$leftovers = Get-CimInstance Win32_Process | Where-Object { (Test-DockerProcessPath ([string]$_.ExecutablePath)) -or ($dockerNames -contains $_.Name) }`,
      `foreach ($process in $leftovers) {`,
      `  try { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue } catch {}`,
      `}`,
    ].join('; ');
    await this.exec('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 30_000 });
  }

  private async startProcess(executablePath: string): Promise<void> {
    const script = `Start-Process -FilePath '${executablePath.replace(/'/g, "''")}'`;
    await this.exec('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 15_000 });
  }

  private buildSnapshotFromDesktop(
    desktop: DesktopResourceSnapshot,
    lastActions: CompanionControlState['lastActions'] = this.readState().lastActions,
  ): CompanionControlSnapshot {
    return this.lifecyclePolicy.buildSnapshot(desktop, lastActions);
  }

  private async settleDesktopAfterAction(input: {
    companionId: CompanionId;
    actionId: CompanionActionId;
    ok: boolean;
  }): Promise<DesktopResourceSnapshot> {
    if (!input.ok) {
      return this.readDesktopSnapshot(0);
    }

    if (input.companionId === 'docker-desktop') {
      if (input.actionId === 'resume') {
        return this.waitForDesktopSnapshot(
          (desktop) => {
            const descriptor = this.lifecyclePolicy.buildDescriptor('docker-desktop', desktop);
            return descriptor.status === 'running' || descriptor.status === 'idle';
          },
          {
            timeoutMs: 20_000,
            intervalMs: 750,
          },
        );
      }
      if (input.actionId === 'stop-idle' || input.actionId === 'hibernate') {
        return this.waitForDesktopSnapshot(
          (desktop) => this.resolveProcessIds(desktop, 'docker-desktop').length === 0,
          {
            timeoutMs: 12_000,
            intervalMs: 500,
          },
        );
      }
    }

    if (input.companionId === 'wsl') {
      if (input.actionId === 'resume') {
        return this.waitForDesktopSnapshot(
          (desktop) => this.listRunningWslDistros(desktop).length > 0,
          {
            timeoutMs: 8_000,
            intervalMs: 400,
          },
        );
      }
      if (input.actionId === 'hibernate') {
        return this.waitForDesktopSnapshot(
          (desktop) => this.listRunningWslDistros(desktop).length === 0,
          {
            timeoutMs: 8_000,
            intervalMs: 400,
          },
        );
      }
    }

    return this.readDesktopSnapshot(0);
  }

  private async waitForDesktopSnapshot(
    predicate: (desktop: DesktopResourceSnapshot) => boolean,
    options: {
      timeoutMs: number;
      intervalMs: number;
    },
  ): Promise<DesktopResourceSnapshot> {
    const deadline = Date.now() + options.timeoutMs;
    let snapshot = await this.readDesktopSnapshot(0);
    if (predicate(snapshot)) {
      return snapshot;
    }

    while (Date.now() < deadline) {
      await this.sleep(options.intervalMs);
      snapshot = await this.readDesktopSnapshot(0);
      if (predicate(snapshot)) {
        return snapshot;
      }
    }

    return snapshot;
  }

  private listRunningWslDistros(desktop: DesktopResourceSnapshot): string[] {
    return desktop.signals.wsl.distros
      .filter((entry) => String(entry.state || '').trim().toLowerCase() === 'running')
      .map((entry) => entry.name);
  }

  private readState(): CompanionControlState {
    if (!fs.existsSync(this.stateFilePath)) {
      return {
        updatedAt: this.now().toISOString(),
        lastActions: {},
      };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as CompanionControlState;
      return {
        updatedAt: String(parsed.updatedAt || this.now().toISOString()),
        lastActions: parsed.lastActions || {},
      };
    } catch (error: unknown) {logger.warn('[Companion Control] JSON parse failed', error);
    return {
        updatedAt: this.now().toISOString(),
        lastActions: {},
      };
  }
  }

  private recordActionState(input: {
    companionId: CompanionId;
    actionId: CompanionActionId;
    ok: boolean;
    summary: string;
  }): CompanionStateRecord {
    const next = this.readState();
    const updatedAt = this.now().toISOString();
    const record: CompanionStateRecord = {
      companionId: input.companionId,
      actionId: input.actionId,
      ok: input.ok,
      summary: input.summary,
      updatedAt,
    };
    next.updatedAt = updatedAt;
    next.lastActions[input.companionId] = record;
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return record;
  }

  private async readDesktopSnapshot(preferCachedWithinMs: number = 10_000): Promise<DesktopResourceSnapshot> {
    return this.desktopResources.inspectLive({
      preferCachedWithinMs: Math.max(0, Number(preferCachedWithinMs || 0) || 0),
    });
  }

  private execFileAsync(
    file: string,
    args: string[],
    options: {
      timeoutMs?: number;
    } = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        {
          windowsHide: true,
          maxBuffer: 4 * 1024 * 1024,
          timeout: options.timeoutMs || 20_000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(String(stderr || error.message || 'Failed to run action de companion.').trim()));
            return;
          }
          resolve(String(stdout || '').trim());
        },
      );
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
