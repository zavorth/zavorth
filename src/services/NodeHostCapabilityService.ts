import path from 'path';
import type { NodeMeshCapabilityId } from '../contracts/NodeMeshContract.js';
import { NODE_HOST_SUPPORTED_CAPABILITY_IDS } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityCatalog.js';
import { buildExecutionResult, normalizeTimeout } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityExecutionHelpers.js';
import { NodeHostCapabilityFilesystemService } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityFilesystemService.js';
import { NodeHostCapabilityHostSurfaceService } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityHostSurfaceService.js';
import { NodeHostCapabilityMaintenanceService } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityMaintenanceService.js';
import {
  buildScopeViolationResult,
  resolveAllowedPath,
  uniqueNormalizedPaths,
} from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityPathPolicy.js';
import { ShellNodeHostCommandRunner } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityShellCommandRunner.js';
import { detectSensitiveData, redactSensitiveText } from '../security/SensitiveDataGuard.js';
import type {
  NodeHostAssignment,
  NodeHostCapabilityRuntime,
  NodeHostCommandRunner,
  NodeHostExecutionResult,
} from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityTypes.js';

const SYSTEM_RUN_DEFAULT_ALLOWED_BINARIES = [
  'echo',
  'git',
  'git.exe',
  'node',
  'node.exe',
  'npm',
  'npm.cmd',
  'pnpm',
  'pnpm.cmd',
  'python',
  'python.exe',
  'python3',
  'python3.exe',
  'py',
  'py.exe',
  'yarn',
  'yarn.cmd',
];

const SYSTEM_RUN_FORBIDDEN_BINARIES = new Set([
  'bash',
  'bash.exe',
  'bitsadmin',
  'bitsadmin.exe',
  'certutil',
  'certutil.exe',
  'cmd',
  'cmd.exe',
  'curl',
  'curl.exe',
  'del',
  'erase',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'reg',
  'reg.exe',
  'rm',
  'sh',
  'sh.exe',
  'wget',
  'wget.exe',
]);

const SYSTEM_RUN_CODE_BINARIES = new Set([
  'node',
  'node.exe',
  'npm',
  'npm.cmd',
  'npx',
  'npx.cmd',
  'pnpm',
  'pnpm.cmd',
  'python',
  'python.exe',
  'python3',
  'python3.exe',
  'py',
  'py.exe',
  'yarn',
  'yarn.cmd',
]);

const SYSTEM_RUN_SHELL_META = /[;&|<>`$%]/u;
const SYSTEM_RUN_READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'branch',
  'diff',
  'log',
  'remote',
  'rev-parse',
  'show',
  'status',
]);

type SystemRunPolicyDecision =
  | { ok: true; cwd: string }
  | { ok: false; result: Omit<NodeHostExecutionResult, 'invocationId'> };

export type {
  NodeHostAssignment,
  NodeHostCapabilityRuntime,
  NodeHostCommandRunner,
  NodeHostExecutionResult,
} from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityTypes.js';
export class NodeHostCapabilityService {
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly stateFile: string;
  private readonly allowedRoots: string[];
  private readonly env: NodeJS.ProcessEnv;
  private readonly commandRunner: NodeHostCommandRunner;
  private readonly filesystemService: NodeHostCapabilityFilesystemService;
  private readonly hostSurfaceService: NodeHostCapabilityHostSurfaceService;
  private readonly maintenanceService: NodeHostCapabilityMaintenanceService;

  constructor(runtime: NodeHostCapabilityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platform = runtime.platform || process.platform;
    this.workspaceRoot = path.resolve(runtime.workspaceRoot || process.cwd());
    this.tempRoot = runtime.tempRoot
      ? path.resolve(runtime.tempRoot)
      : path.resolve(this.workspaceRoot, 'data', 'runtime', 'node-host');
    this.stateFile = runtime.stateFile
      ? path.resolve(runtime.stateFile)
      : path.resolve(this.tempRoot, 'node-host-state.json');
    this.env = runtime.env || process.env;
    this.allowedRoots = uniqueNormalizedPaths([
      ...(Array.isArray(runtime.allowedRoots) ? runtime.allowedRoots : []),
      this.workspaceRoot,
      this.tempRoot,
    ]);
    this.commandRunner = runtime.commandRunner || new ShellNodeHostCommandRunner();
    const serviceRuntime = {
      now: this.now,
      platform: this.platform,
      workspaceRoot: this.workspaceRoot,
      tempRoot: this.tempRoot,
      stateFile: this.stateFile,
      allowedRoots: this.allowedRoots,
      env: this.env,
      commandRunner: this.commandRunner,
    };
    this.filesystemService = new NodeHostCapabilityFilesystemService(serviceRuntime);
    this.hostSurfaceService = new NodeHostCapabilityHostSurfaceService(serviceRuntime);
    this.maintenanceService = new NodeHostCapabilityMaintenanceService(serviceRuntime);
  }

  public async executeAssignment(assignment: NodeHostAssignment): Promise<NodeHostExecutionResult> {
    switch (String(assignment.capabilityId || '').trim()) {
      case 'system.run':
        return buildExecutionResult(assignment.id, await this.runSystemCommand(assignment.payload || null));
      case 'node.maintenance':
        return buildExecutionResult(assignment.id, await this.runNodeMaintenance(assignment.action, assignment.payload || null));
      case 'browser.proxy':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.proxyBrowser(assignment.payload || null));
      case 'device.info':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.describeDevice(assignment.payload || null));
      case 'files.read':
        return buildExecutionResult(assignment.id, await this.filesystemService.readFileFromHost(assignment.payload || null));
      case 'files.write':
        return buildExecutionResult(assignment.id, await this.filesystemService.writeFileToHost(assignment.payload || null));
      case 'files.watch':
        return buildExecutionResult(assignment.id, await this.filesystemService.watchFilesFromHost(assignment.payload || null));
      case 'screen.capture':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.captureScreen(assignment.payload || null));
      case 'camera.capture':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.captureCamera(assignment.payload || null));
      case 'location.read':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.readLocation(assignment.payload || null));
      case 'device.confirm':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.confirmDeviceAction(assignment.payload || null));
      case 'haptics.vibrate':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.vibrateHaptic(assignment.payload || null));
      case 'clipboard.read':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.readClipboard(assignment.payload || null));
      case 'clipboard.write':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.writeClipboard(assignment.payload || null));
      case 'notifications.send':
        return buildExecutionResult(assignment.id, await this.hostSurfaceService.sendNotification(assignment.payload || null));
      default:
        return {
          invocationId: assignment.id,
          ok: false,
          resultSummary: `Capability ${assignment.capabilityId} ainda nao foi implementada neste node host.`,
          stderr: `unsupported capability: ${assignment.capabilityId}`,
          exitCode: null,
          data: {
            action: assignment.action,
          },
        };
    }
  }

  public listSupportedCapabilityIds(): NodeMeshCapabilityId[] {
    return [...NODE_HOST_SUPPORTED_CAPABILITY_IDS];
  }

  private async runSystemCommand(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const command = String(payload?.command || '').trim();
    if (!command) {
      return {
        ok: false,
        resultSummary: 'A invocacao system.run nao trouxe payload.command.',
        stdout: null,
        stderr: 'payload.command ausente',
        exitCode: null,
        data: null,
      };
    }

    const policy = this.evaluateSystemRunRequest(command, payload);
    if (policy.ok === false) {
      return policy.result;
    }

    const invocation = this.buildSystemRunInvocation(command);
    const result = await this.commandRunner.run(invocation, {
      cwd: policy.cwd,
      timeoutMs: normalizeTimeout(payload?.timeoutMs, 120000),
    });
    const stdout = result.stdout ? redactSensitiveText(result.stdout) : result.stdout;
    const stderr = result.stderr ? redactSensitiveText(result.stderr) : result.stderr;

    return {
      ok: result.ok,
      resultSummary: result.ok
        ? 'Comando executado no node host.'
        : `Comando saiu com codigo ${result.exitCode ?? 'desconhecido'}.`,
      stdout,
      stderr,
      exitCode: result.exitCode,
      data: {
        command: redactSensitiveText(command),
        cwd: policy.cwd,
      },
    };
  }

  private evaluateSystemRunRequest(
    command: string,
    payload: Record<string, unknown> | null,
  ): SystemRunPolicyDecision {
    const requestedCwd = String(payload?.cwd || '').trim() || this.workspaceRoot;
    let cwd: string;
    try {
      cwd = resolveAllowedPath({
        targetPath: requestedCwd,
        capabilityId: 'system.run',
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    } catch (error) {
      return {
        ok: false,
        result: buildScopeViolationResult({
          capabilityId: 'system.run',
          targetPath: requestedCwd,
          error,
          workspaceRoot: this.workspaceRoot,
          allowedRoots: this.allowedRoots,
        }),
      };
    }

    const policyError = this.validateSystemRunCommand(command);
    if (policyError) {
      return {
        ok: false,
        result: {
          ok: false,
          resultSummary: 'system.run bloqueou um comando fora da politica zero-trust do node host.',
          stdout: null,
          stderr: policyError,
          exitCode: null,
          data: {
            command: redactSensitiveText(command),
            cwd,
          },
        },
      };
    }

    return { ok: true, cwd };
  }

  private validateSystemRunCommand(command: string): string | null {
    if (String(this.env.ZAVORTH_NODE_HOST_SYSTEM_RUN_BREAK_GLASS || '').toLowerCase() === 'true') {
      return null;
    }

    if (command.length > 2000) {
      return 'system.run bloqueou comando acima de 2000 caracteres.';
    }
    if (command.includes('\0') || /[\r\n]/u.test(command)) {
      return 'system.run bloqueou comando com caracteres de controle.';
    }
    if (detectSensitiveData(command).length > 0) {
      return 'system.run bloqueou segredo bruto no comando. Use um canal de credenciais aprovado.';
    }
    if (SYSTEM_RUN_SHELL_META.test(command)) {
      return 'system.run bloqueou metacaracteres de shell. Use comandos simples e argumentos literais.';
    }

    const parsed = tokenizeSystemRunCommand(command);
    if (parsed.ok === false) {
      return parsed.error;
    }

    const file = parsed.file;
    const binary = path.basename(file).toLowerCase();
    if (file.includes('/') || file.includes('\\')) {
      return 'system.run exige binario pelo nome, sem caminho absoluto ou relativo.';
    }
    if (SYSTEM_RUN_FORBIDDEN_BINARIES.has(binary)) {
      return `system.run bloqueou binario perigoso "${file}".`;
    }
    if (!this.allowedSystemRunBinaries().has(binary)) {
      return `system.run bloqueou binario "${file}" fora da allowlist. Configure ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOWED_BINARIES para liberar explicitamente.`;
    }
    if (binary === 'git' || binary === 'git.exe') {
      const subcommand = String(parsed.args[0] || '').toLowerCase();
      if (subcommand && !SYSTEM_RUN_READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)) {
        return `system.run bloqueou git ${subcommand}; somente subcomandos read-only sao permitidos por padrao.`;
      }
    }
    if (
      SYSTEM_RUN_CODE_BINARIES.has(binary)
      && !isVersionOnlySystemRun(parsed.args)
      && String(this.env.ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOW_CODE || '').toLowerCase() !== 'true'
    ) {
      return `system.run bloqueou "${file}" porque ele pode executar codigo. Use ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOW_CODE=true apenas em hosts confiaveis.`;
    }

    return null;
  }

  private buildSystemRunInvocation(command: string) {
    if (String(this.env.ZAVORTH_NODE_HOST_SYSTEM_RUN_BREAK_GLASS || '').toLowerCase() === 'true') {
      return command;
    }

    const parsed = tokenizeSystemRunCommand(command);
    if (parsed.ok === false) {
      return command;
    }

    const binary = path.basename(parsed.file).toLowerCase();
    if (this.platform === 'win32' && binary === 'echo') {
      return command;
    }

    return {
      label: 'system.run',
      command,
      file: parsed.file,
      args: parsed.args,
    };
  }

  private allowedSystemRunBinaries(): Set<string> {
    const configured = String(this.env.ZAVORTH_NODE_HOST_SYSTEM_RUN_ALLOWED_BINARIES || '').trim();
    const values = configured
      ? configured.split(',').map((entry) => entry.trim()).filter(Boolean)
      : SYSTEM_RUN_DEFAULT_ALLOWED_BINARIES;
    return new Set(values.map((entry) => entry.toLowerCase()));
  }

  private async runNodeMaintenance(
    action: string,
    payload: Record<string, unknown> | null,
  ): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const normalizedAction = String(action || payload?.mode || payload?.operation || 'doctor').trim().toLowerCase();
    if (normalizedAction === 'doctor') {
      const requestedCapabilities = Array.isArray(payload?.requestedCapabilities)
        ? payload?.requestedCapabilities as Array<string | null | undefined>
        : [];
      const report = this.maintenanceService.buildNodeMaintenanceDoctorReport(requestedCapabilities);
      return {
        ok: true,
        resultSummary: report.status === 'healthy'
          ? 'Doctor do node host sem pendencias operacionais.'
          : 'Doctor do node host encontrou pendencias locais.',
        stdout: JSON.stringify(report, null, 2),
        stderr: null,
        exitCode: 0,
        data: report as unknown as Record<string, unknown>,
      };
    }

    if (normalizedAction === 'repair') {
      const report = this.maintenanceService.repairNodeMaintenanceState();
      return {
        ok: true,
        resultSummary: report.removedResults > 0
          ? `Repair do node host removeu ${report.removedResults} resultado(s) invalido(s).`
          : 'Repair do node host nao precisou alterar o estado local.',
        stdout: JSON.stringify(report, null, 2),
        stderr: null,
        exitCode: 0,
        data: report as unknown as Record<string, unknown>,
      };
    }

    return {
      ok: false,
      resultSummary: `node.maintenance nao reconhece a acao ${normalizedAction}.`,
      stdout: null,
      stderr: `unsupported maintenance action: ${normalizedAction}`,
      exitCode: null,
      data: {
        action: normalizedAction,
        supportedActions: ['doctor', 'repair'],
      },
    };
  }

}

function isVersionOnlySystemRun(args: string[]): boolean {
  return args.length === 1 && ['--version', '-v', 'version'].includes(String(args[0] || ''));
}

function tokenizeSystemRunCommand(command: string): { ok: true; file: string; args: string[] } | { ok: false; error: string } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (quote === char) {
      quote = null;
      continue;
    }
    if (!quote && /\s/u.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (quote) {
    return { ok: false, error: 'system.run bloqueou comando com aspas nao fechadas.' };
  }
  if (current) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    return { ok: false, error: 'system.run bloqueou comando vazio.' };
  }

  return {
    ok: true,
    file: tokens[0],
    args: tokens.slice(1),
  };
}
