import { spawn, spawnSync, type ChildProcess, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  startExternalLauncherReload,
  type ExternalLauncherReloadDeps,
  type ExternalLauncherReloadInput,
} from './HostSupervisorLauncher.js';
import { sanitizeWindowsEnv } from './HostEnvironment.js';
import { errorMessage } from '../utils/errorLike.js';

export type HostPresenceBinaryMode = 'binary' | 'sources+bun' | 'missing';

export type HostPresenceGoalLoopHeartbeat = {
  daemonId: string;
  status: string;
  lastHeartbeatAt: string | null;
  source: 'state-db' | 'state-file' | 'daemon-service' | 'none';
  heartbeatRecorded: boolean;
};

export type HostPresenceOsServiceScaffold = {
  platform: string;
  scaffolded: boolean;
  path: string | null;
  registered: boolean;
  adminRequired: boolean;
  note: string;
};

export type HostPresenceSnapshot = {
  contractVersion: 'host-presence/1';
  productName: 'HostPresenceUnit';
  generatedAt: string;
  projectRoot: string;
  statePath: string;
  installed: boolean;
  running: boolean;
  status: string;
  pid: number | null;
  command: string | null;
  binary: {
    present: boolean;
    path: string | null;
    mode: HostPresenceBinaryMode;
    bunRequired: boolean;
  };
  policyAuthority: string;
  gateway: {
    baseUrl: string;
    ready: boolean;
    summary: string;
  };
  goalLoop: HostPresenceGoalLoopHeartbeat;
  daemon: {
    installed: boolean;
    status: string;
    pid: number | null;
    health: string;
  };
  osService: HostPresenceOsServiceScaffold;
  supervisor: {
    reloadScriptPresent: boolean;
    summary: string;
  };
  lines: string[];
};

export type HostPresenceActionResult = {
  ok: boolean;
  action: 'install' | 'start' | 'stop' | 'status';
  dryRun: boolean;
  summary: string;
  snapshot: HostPresenceSnapshot;
};

type HostPresencePersistedState = {
  productName: 'HostPresenceUnit';
  installed: boolean;
  status: string;
  command: string | null;
  pid: number | null;
  installedAt: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  osServicePath: string | null;
  goalLoop: HostPresenceGoalLoopHeartbeat | null;
  lastEnsure: string | null;
};

export type HostPresenceUnitOptions = {
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  stateDir?: string;
  stateDbPath?: string | null;
  platform?: NodeJS.Platform;
  resolveBinary?: (projectRoot: string, env: NodeJS.ProcessEnv) => string | null;
  ensureBinary?: (projectRoot: string, env: NodeJS.ProcessEnv) => { ok: boolean; path: string | null; detail: string };
  probeGateway?: (baseUrl: string) => { ok: boolean; summary: string } | Promise<{ ok: boolean; summary: string }>;
  readGoalLoopHeartbeat?: () => HostPresenceGoalLoopHeartbeat | null;
  spawnImpl?: typeof spawn;
  spawnSyncImpl?: typeof spawnSync;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  rmSync?: typeof fs.rmSync;
  killPid?: (pid: number) => boolean;
  isPidAlive?: (pid: number) => boolean;
  startSupervisorReload?: (
    input: ExternalLauncherReloadInput,
    deps: ExternalLauncherReloadDeps,
  ) => { accepted: boolean; summary: string };
  supervisedReloadRequestScriptPath?: string | null;
  powershellExecutablePath?: string | null;
};

const CONTRACT = 'host-presence/1' as const;
const PRODUCT_NAME = 'HostPresenceUnit' as const;
const DEFAULT_GATEWAY = 'http://localhost:20128';

function defaultPersisted(): HostPresencePersistedState {
  return {
    productName: PRODUCT_NAME,
    installed: false,
    status: 'not-installed',
    command: null,
    pid: null,
    installedAt: null,
    startedAt: null,
    stoppedAt: null,
    osServicePath: null,
    goalLoop: null,
    lastEnsure: null,
  };
}

export class HostPresenceUnit {
  private readonly projectRoot: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly stateDirectory: string;
  private readonly statePath: string;
  private readonly stateDbPath: string | null;
  private readonly platform: NodeJS.Platform;
  private readonly resolveBinaryFn: (projectRoot: string, env: NodeJS.ProcessEnv) => string | null;
  private readonly ensureBinaryFn: (
    projectRoot: string,
    env: NodeJS.ProcessEnv,
  ) => { ok: boolean; path: string | null; detail: string };
  private readonly probeGatewayFn: (
    baseUrl: string,
  ) => { ok: boolean; summary: string } | Promise<{ ok: boolean; summary: string }>;
  private readonly readGoalLoopHeartbeatFn: (() => HostPresenceGoalLoopHeartbeat | null) | null;
  private readonly spawnImpl: typeof spawn;
  private readonly spawnSyncImpl: typeof spawnSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly killPidFn: (pid: number) => boolean;
  private readonly isPidAliveFn: (pid: number) => boolean;
  private readonly startSupervisorReloadFn: (
    input: ExternalLauncherReloadInput,
    deps: ExternalLauncherReloadDeps,
  ) => { accepted: boolean; summary: string };
  private readonly supervisedReloadRequestScriptPath: string | null;
  private readonly powershellExecutablePath: string | null;

  constructor(options: HostPresenceUnitOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
    this.stateDirectory = path.resolve(
      options.stateDir || path.join(this.projectRoot, '.zavorth', 'host-presence'),
    );
    this.statePath = path.join(this.stateDirectory, 'host-presence.json');
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.platform = options.platform || process.platform;
    this.resolveBinaryFn = options.resolveBinary || defaultResolveBinary;
    this.ensureBinaryFn = options.ensureBinary || defaultEnsureBinary;
    this.probeGatewayFn = options.probeGateway || defaultProbeGateway;
    this.readGoalLoopHeartbeatFn = options.readGoalLoopHeartbeat || null;
    this.spawnImpl = options.spawnImpl || spawn;
    this.spawnSyncImpl = options.spawnSyncImpl || spawnSync;
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.killPidFn = options.killPid || defaultKillPid;
    this.isPidAliveFn = options.isPidAlive || defaultIsPidAlive;
    this.startSupervisorReloadFn = options.startSupervisorReload || startExternalLauncherReload;
    this.supervisedReloadRequestScriptPath =
      options.supervisedReloadRequestScriptPath
      ?? path.join(this.projectRoot, 'scripts', 'request-supervised-reload.ps1');
    this.powershellExecutablePath =
      options.powershellExecutablePath
      ?? (this.platform === 'win32'
        ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : null);
  }

  public async status(): Promise<HostPresenceActionResult> {
    const snapshot = await this.buildSnapshot();
    if (snapshot.installed || snapshot.goalLoop.heartbeatRecorded) {
      this.persistGoalLoopHeartbeat(snapshot.goalLoop);
    }
    return {
      ok: true,
      action: 'status',
      dryRun: false,
      summary: snapshot.running ? 'Host presence is running.' : snapshot.installed ? 'Host presence is installed.' : 'Host presence is not installed.',
      snapshot,
    };
  }

  public async install(input: {
    dryRun?: boolean;
    ensureBinary?: boolean;
    osService?: boolean;
    command?: string | null;
  } = {}): Promise<HostPresenceActionResult> {
    const dryRun = Boolean(input.dryRun);
    const ensureBinary = input.ensureBinary !== false;
    const osService = input.osService !== false;
    let state = this.readState();

    if (dryRun) {
      const snapshot = await this.buildSnapshot(state);
      return {
        ok: true,
        action: 'install',
        dryRun: true,
        summary: 'Install preview — re-run without dry-run to write host presence state.',
        snapshot,
      };
    }

    this.mkdirSync(this.stateDirectory, { recursive: true });

    let ensureDetail: string | null = null;
    if (ensureBinary) {
      const ensured = this.ensureBinaryFn(this.projectRoot, this.env);
      ensureDetail = ensured.detail;
      state.lastEnsure = this.now().toISOString();
    }

    const command = String(input.command || state.command || this.defaultHostCommand()).trim() || this.defaultHostCommand();
    let osServicePath: string | null = state.osServicePath;
    let osNote = 'OS service scaffold skipped.';
    if (osService) {
      const scaffold = this.writeOsServiceScaffold(command);
      osServicePath = scaffold.path;
      osNote = scaffold.note;
      // Soft registration never fails install
      if (scaffold.scaffolded && this.platform === 'win32') {
        this.tryRegisterWindowsTaskSoft(scaffold.path);
      }
    }

    state = {
      ...state,
      productName: PRODUCT_NAME,
      installed: true,
      status: state.pid && this.isPidAliveFn(Number(state.pid)) ? 'running' : 'installed',
      command,
      installedAt: state.installedAt || this.now().toISOString(),
      osServicePath,
    };
    this.writeState(state);

    const snapshot = await this.buildSnapshot(state);
    this.persistGoalLoopHeartbeat(snapshot.goalLoop);
    if (ensureDetail) {
      snapshot.lines.push(`ensure: ${ensureDetail}`);
    }
    // Prefer honest registration status from the live probe over the scaffold write note alone.
    osNote = snapshot.osService.scaffolded
      ? (snapshot.osService.registered
        ? `OS service scaffold present and registered (${snapshot.osService.platform}).`
        : osNote)
      : osNote;
    snapshot.lines.push(`os-service: ${osNote}`);

    return {
      ok: true,
      action: 'install',
      dryRun: false,
      summary: `HostPresenceUnit installed. Binary mode: ${snapshot.binary.mode}.`,
      snapshot,
    };
  }

  public async start(input: {
    dryRun?: boolean;
    yes?: boolean;
    command?: string | null;
  } = {}): Promise<HostPresenceActionResult> {
    let state = this.readState();
    if (!state.installed) {
      const installed = await this.install({ ensureBinary: true, osService: true });
      state = this.readState();
      if (!installed.ok) {
        return {
          ok: false,
          action: 'start',
          dryRun: Boolean(input.dryRun),
          summary: 'Install required before start failed.',
          snapshot: installed.snapshot,
        };
      }
    }

    const command = String(input.command || state.command || this.defaultHostCommand()).trim();
    const dryRun = Boolean(input.dryRun) || input.yes === false;

    if (dryRun && input.yes !== true) {
      const snapshot = await this.buildSnapshot({ ...state, command });
      return {
        ok: true,
        action: 'start',
        dryRun: true,
        summary: `Start preview: ${command}. Pass yes to spawn the host process.`,
        snapshot,
      };
    }

    if (state.pid && this.isPidAliveFn(Number(state.pid))) {
      const snapshot = await this.buildSnapshot(state);
      return {
        ok: true,
        action: 'start',
        dryRun: false,
        summary: `Already running (pid ${state.pid}).`,
        snapshot,
      };
    }

    const child = this.spawnImpl(command, [], {
      cwd: this.projectRoot,
      env: this.platform === 'win32' ? sanitizeWindowsEnv(this.env) : { ...this.env },
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }) as ChildProcess;
    child.unref?.();

    state = {
      ...state,
      installed: true,
      status: 'running',
      command,
      pid: typeof child.pid === 'number' ? child.pid : null,
      startedAt: this.now().toISOString(),
    };
    this.writeState(state);

    // Soft supervisor readiness probe (does not restart unless explicitly asked later)
    const scriptPresent = Boolean(
      this.supervisedReloadRequestScriptPath
      && this.existsSync(this.supervisedReloadRequestScriptPath),
    );

    const snapshot = await this.buildSnapshot(state);
    snapshot.supervisor = {
      reloadScriptPresent: scriptPresent,
      summary: scriptPresent
        ? 'Supervised reload script present.'
        : 'Supervised reload script not present (optional).',
    };
    snapshot.lines = this.renderLines(snapshot);

    return {
      ok: true,
      action: 'start',
      dryRun: false,
      summary: state.pid ? `Started HostPresenceUnit pid ${state.pid}.` : 'Start requested (no pid recorded).',
      snapshot,
    };
  }

  public async stop(input: {
    dryRun?: boolean;
    yes?: boolean;
  } = {}): Promise<HostPresenceActionResult> {
    const state = this.readState();
    const pid = Number(state.pid || 0);
    const dryRun = Boolean(input.dryRun) || input.yes !== true;

    if (!pid) {
      const snapshot = await this.buildSnapshot({ ...state, status: 'stopped', pid: null });
      return {
        ok: true,
        action: 'stop',
        dryRun: false,
        summary: 'Host presence has no recorded PID.',
        snapshot,
      };
    }

    if (dryRun) {
      const snapshot = await this.buildSnapshot(state);
      return {
        ok: true,
        action: 'stop',
        dryRun: true,
        summary: `Stop preview: pid ${pid}. Pass yes to signal the process.`,
        snapshot,
      };
    }

    const stopped = this.killPidFn(pid);
    const next: HostPresencePersistedState = {
      ...state,
      status: stopped ? 'stopped' : 'stale',
      pid: null,
      stoppedAt: this.now().toISOString(),
    };
    this.writeState(next);
    const snapshot = await this.buildSnapshot(next);
    return {
      ok: stopped,
      action: 'stop',
      dryRun: false,
      summary: stopped ? `Stop sent to pid ${pid}.` : `Could not signal pid ${pid}.`,
      snapshot,
    };
  }

  /**
   * Soft supervised handoff using HostSupervisorLauncher (never throws; no admin hard-fail).
   */
  public requestSupervisedReload(input: ExternalLauncherReloadInput): { accepted: boolean; summary: string } {
    if (!this.supervisedReloadRequestScriptPath || !this.powershellExecutablePath) {
      return {
        accepted: false,
        summary: 'Supervised reload is only available when PowerShell and the request script are present.',
      };
    }
    try {
      return this.startSupervisorReloadFn(input, {
        spawnImpl: this.spawnImpl,
        processRef: process,
        projectRoot: this.projectRoot,
        powershellExecutablePath: this.powershellExecutablePath,
        supervisedReloadRequestScriptPath: this.supervisedReloadRequestScriptPath,
      });
    } catch (error: unknown) {
      return { accepted: false, summary: errorMessage(error) };
    }
  }

  private async buildSnapshot(stateOverride?: HostPresencePersistedState): Promise<HostPresenceSnapshot> {
    const state = stateOverride || this.readState();
    const binaryPath = this.resolveBinaryFn(this.projectRoot, this.env);
    const binaryPresent = Boolean(binaryPath && this.existsSync(binaryPath));
    const sourcesPresent = this.existsSync(
      path.join(this.projectRoot, 'packages', 'code', 'cli', 'src', 'index.ts'),
    );
    const mode: HostPresenceBinaryMode = binaryPresent
      ? 'binary'
      : sourcesPresent
        ? 'sources+bun'
        : 'missing';
    const policyAuthority = String(this.env.ZAVORTH_POLICY_AUTHORITY || 'gateway').trim() || 'gateway';
    const baseUrl = resolveGatewayBaseUrl(this.env);
    const gatewayProbe = await Promise.resolve(this.probeGatewayFn(baseUrl));
    const goalLoop = this.resolveGoalLoopHeartbeat(state);
    const daemon = this.readDaemonServiceState();
    const pid = state.pid && this.isPidAliveFn(Number(state.pid)) ? Number(state.pid) : null;
    const running = Boolean(pid);
    const osService = this.readOsServiceStatus(state);

    const supervisorScript = this.supervisedReloadRequestScriptPath;
    const reloadScriptPresent = Boolean(supervisorScript && this.existsSync(supervisorScript));

    const snapshot: HostPresenceSnapshot = {
      contractVersion: CONTRACT,
      productName: PRODUCT_NAME,
      generatedAt: this.now().toISOString(),
      projectRoot: this.projectRoot,
      statePath: this.statePath,
      installed: Boolean(state.installed),
      running,
      status: running ? 'running' : state.installed ? String(state.status || 'installed') : 'not-installed',
      pid,
      command: state.command,
      binary: {
        present: binaryPresent,
        path: binaryPath,
        mode,
        bunRequired: !binaryPresent,
      },
      policyAuthority,
      gateway: {
        baseUrl,
        ready: Boolean(gatewayProbe.ok),
        summary: gatewayProbe.summary,
      },
      goalLoop,
      daemon,
      osService,
      supervisor: {
        reloadScriptPresent,
        summary: reloadScriptPresent
          ? 'HostSupervisorLauncher reload script available.'
          : 'HostSupervisorLauncher reload script optional / missing.',
      },
      lines: [],
    };
    snapshot.lines = this.renderLines(snapshot);
    return snapshot;
  }

  private persistGoalLoopHeartbeat(goalLoop: HostPresenceGoalLoopHeartbeat): void {
    if (!goalLoop.heartbeatRecorded) return;
    try {
      const state = this.readState();
      this.writeState({ ...state, goalLoop });
    } catch {
      // soft
    }
  }

  private resolveGoalLoopHeartbeat(state: HostPresencePersistedState): HostPresenceGoalLoopHeartbeat {
    if (this.readGoalLoopHeartbeatFn) {
      const injected = this.readGoalLoopHeartbeatFn();
      if (injected) return injected;
    }

    const fromDb = this.readGoalLoopFromStateDb();
    if (fromDb) return fromDb;

    if (state.goalLoop && state.goalLoop.lastHeartbeatAt) {
      return {
        ...state.goalLoop,
        source: 'state-file',
        heartbeatRecorded: true,
      };
    }

    const daemon = this.readDaemonServiceState();
    if (daemon.installed || daemon.pid) {
      return {
        daemonId: 'daemon-service',
        status: daemon.status,
        lastHeartbeatAt: null,
        source: 'daemon-service',
        heartbeatRecorded: daemon.health === 'alive',
      };
    }

    return {
      daemonId: 'goal-loop-daemon',
      status: 'unknown',
      lastHeartbeatAt: null,
      source: 'none',
      heartbeatRecorded: false,
    };
  }

  private readGoalLoopFromStateDb(): HostPresenceGoalLoopHeartbeat | null {
    if (!this.stateDbPath || !this.existsSync(this.stateDbPath)) return null;
    try {
      // Lazy require keeps unit tests free of sqlite when path absent
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ZavorthOperationalStateDbService } = require('../services/ZavorthOperationalStateDbService.js') as {
        ZavorthOperationalStateDbService: new (opts: { dbPath: string; now?: () => Date }) => {
          getMeta: <T = unknown>(key: string) => T | null;
          close: () => void;
        };
      };
      const db = new ZavorthOperationalStateDbService({ dbPath: this.stateDbPath, now: this.now });
      try {
        const keys = [
          'goal-loop-daemon:goal-loop-daemon',
          'goal-loop-daemon:cli-goal-loop-daemon',
          'goal-loop-daemon:daemon-a',
        ];
        for (const key of keys) {
          const meta = db.getMeta<{
            daemonId?: string;
            status?: string;
            heartbeatAt?: string;
          }>(key);
          if (meta && (meta.heartbeatAt || meta.status)) {
            return {
              daemonId: String(meta.daemonId || key.replace(/^goal-loop-daemon:/, '')),
              status: String(meta.status || 'unknown'),
              lastHeartbeatAt: meta.heartbeatAt ? String(meta.heartbeatAt) : null,
              source: 'state-db',
              heartbeatRecorded: Boolean(meta.heartbeatAt),
            };
          }
        }
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
    return null;
  }

  private readDaemonServiceState(): HostPresenceSnapshot['daemon'] {
    const daemonPath = path.join(this.projectRoot, '.zavorth', 'daemon.json');
    try {
      if (!this.existsSync(daemonPath)) {
        return { installed: false, status: 'not-installed', pid: null, health: 'not-running' };
      }
      const raw = JSON.parse(this.readFileSync(daemonPath, 'utf8') as string) as {
        installed?: boolean;
        status?: string;
        pid?: number | null;
      };
      const pid = Number(raw.pid || 0) || null;
      const alive = pid ? this.isPidAliveFn(pid) : false;
      return {
        installed: Boolean(raw.installed),
        status: String(raw.status || 'unknown'),
        pid,
        health: alive ? 'alive' : pid ? 'stale' : 'not-running',
      };
    } catch {
      return { installed: false, status: 'unknown', pid: null, health: 'not-running' };
    }
  }

  private readOsServiceStatus(state: HostPresencePersistedState): HostPresenceOsServiceScaffold {
    const defaultName = this.platform === 'win32'
      ? 'zavorth-host-task.xml'
      : this.platform === 'darwin'
        ? 'com.zavorth.host.plist'
        : 'zavorth-host.service';
    const scaffoldPath =
      state.osServicePath
      || path.join(this.stateDirectory, 'os-service', defaultName);
    const scaffolded = this.existsSync(scaffoldPath);
    const registered = this.platform === 'darwin'
      ? this.isLaunchdLoaded('com.zavorth.host')
      : this.platform === 'linux'
        ? this.isSystemdUserUnitEnabled('zavorth-host.service')
        : this.platform === 'win32'
          ? this.isWindowsTaskRegistered('ZavorthHostPresence')
          : false;
    return {
      platform: this.platform,
      scaffolded,
      path: scaffolded ? scaffoldPath : null,
      registered,
      adminRequired: this.platform === 'linux',
      note: scaffolded
        ? (registered
          ? 'OS service scaffold present and registered for this user session.'
          : 'OS service scaffold present (registration is optional and non-admin by default).')
        : 'OS service scaffold not written yet — run host install.',
    };
  }

  private isWindowsTaskRegistered(taskName: string): boolean {
    if (this.platform !== 'win32') return false;
    const powershell = this.powershellExecutablePath;
    if (!powershell || !this.existsSync(powershell)) return false;
    try {
      const result = this.spawnSyncImpl(
        powershell,
        ['-NoProfile', '-Command', `Get-ScheduledTask -TaskName ${JSON.stringify(taskName)} -ErrorAction Stop | Out-Null`],
        { encoding: 'utf8', windowsHide: true, timeout: 5_000 },
      );
      return result.status === 0;
    } catch {
      return false;
    }
  }

  private writeOsServiceScaffold(command: string): HostPresenceOsServiceScaffold {
    const dir = path.join(this.stateDirectory, 'os-service');
    this.mkdirSync(dir, { recursive: true });

    if (this.platform === 'win32') {
      const xmlPath = path.join(dir, 'zavorth-host-task.xml');
      const ps1Path = path.join(dir, 'register-zavorth-host-task.ps1');
      const xml = buildWindowsTaskXml({
        projectRoot: this.projectRoot,
        command,
      });
      const ps1 = [
        '# HostPresenceUnit — optional Windows scheduled task (user-level, no admin required).',
        '# Register: powershell -NoProfile -ExecutionPolicy Bypass -File register-zavorth-host-task.ps1',
        `$ErrorActionPreference = "Stop"`,
        `$taskName = "ZavorthHostPresence"`,
        `$xmlPath = Join-Path $PSScriptRoot "zavorth-host-task.xml"`,
        `try {`,
        `  Register-ScheduledTask -TaskName $taskName -Xml (Get-Content -LiteralPath $xmlPath -Raw) -Force -ErrorAction Stop | Out-Null`,
        `  Write-Host "Registered user scheduled task: $taskName"`,
        `} catch {`,
        `  Write-Host "Soft skip (no admin / policy): $($_.Exception.Message)"`,
        `  exit 0`,
        `}`,
        '',
      ].join(os.EOL);
      this.writeFileSync(xmlPath, xml, 'utf8');
      this.writeFileSync(ps1Path, ps1, 'utf8');
      return {
        platform: 'win32',
        scaffolded: true,
        path: xmlPath,
        registered: false,
        adminRequired: false,
        note: `Windows task scaffold written (user-level). Soft register via ${ps1Path}`,
      };
    }

    if (this.platform === 'darwin') {
      const plistPath = path.join(dir, 'com.zavorth.host.plist');
      const xmlEscape = (value: string): string =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const plist = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        '<dict>',
        '  <key>Label</key>',
        '  <string>com.zavorth.host</string>',
        '  <key>WorkingDirectory</key>',
        `  <string>${xmlEscape(this.projectRoot)}</string>`,
        '  <key>ProgramArguments</key>',
        '  <array>',
        '    <string>/bin/sh</string>',
        '    <string>-lc</string>',
        `    <string>${xmlEscape(command)}</string>`,
        '  </array>',
        '  <key>RunAtLoad</key>',
        '  <true/>',
        '  <key>KeepAlive</key>',
        '  <true/>',
        '</dict>',
        '</plist>',
        '',
      ].join('\n');
      this.writeFileSync(plistPath, plist, 'utf8');
      return {
        platform: 'darwin',
        scaffolded: true,
        path: plistPath,
        registered: this.isLaunchdLoaded('com.zavorth.host'),
        adminRequired: false,
        note: `launchd plist scaffold written at ${plistPath} (not loaded by default).`,
      };
    }

    const unitPath = path.join(dir, 'zavorth-host.service');
    const unit = [
      '[Unit]',
      'Description=Zavorth HostPresenceUnit',
      'After=network.target',
      '',
      '[Service]',
      `WorkingDirectory=${this.projectRoot}`,
      `ExecStart=/bin/sh -lc ${JSON.stringify(command)}`,
      'Restart=on-failure',
      '',
      '[Install]',
      'WantedBy=default.target',
      '',
    ].join('\n');
    this.writeFileSync(unitPath, unit, 'utf8');
    return {
      platform: this.platform === 'linux' ? 'linux' : this.platform,
      scaffolded: true,
      path: unitPath,
      registered: this.isSystemdUserUnitEnabled('zavorth-host.service'),
      adminRequired: true,
      note: `systemd user unit scaffold written at ${unitPath} (not installed system-wide).`,
    };
  }

  private isLaunchdLoaded(label: string): boolean {
    if (this.platform !== 'darwin') return false;
    try {
      const result = this.spawnSyncImpl('launchctl', ['list', label], {
        encoding: 'utf8',
        timeout: 5_000,
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  private isSystemdUserUnitEnabled(unitName: string): boolean {
    if (this.platform !== 'linux') return false;
    try {
      const result = this.spawnSyncImpl('systemctl', ['--user', 'is-enabled', unitName], {
        encoding: 'utf8',
        timeout: 5_000,
      });
      const out = String(result.stdout || '').trim().toLowerCase();
      return result.status === 0 && (out === 'enabled' || out === 'static');
    } catch {
      return false;
    }
  }

  private tryRegisterWindowsTaskSoft(xmlPath: string | null): void {
    if (!xmlPath || this.platform !== 'win32') return;
    const ps1 = path.join(path.dirname(xmlPath), 'register-zavorth-host-task.ps1');
    if (!this.existsSync(ps1)) return;
    const powershell = this.powershellExecutablePath;
    if (!powershell || !this.existsSync(powershell)) return;
    try {
      this.spawnSyncImpl(
        powershell,
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 15_000,
        },
      );
    } catch {
      // soft — install must not fail
    }
  }

  private defaultHostCommand(): string {
    // Prefer host supervisor (dist/host.js) or agent-runtime host source, never Code TUI binary first.
    const distHost = path.join(this.projectRoot, 'dist', 'host.js');
    if (this.existsSync(distHost)) {
      return `${process.execPath} ${JSON.stringify(distHost)}`;
    }
    const srcHost = path.join(this.projectRoot, 'src', 'host.ts');
    if (this.existsSync(srcHost)) {
      return `npx tsx ${JSON.stringify(srcHost)}`;
    }
    return `${process.execPath} -e "setInterval(()=>{}, 60000)"`;
  }

  private readState(): HostPresencePersistedState {
    try {
      if (!this.existsSync(this.statePath)) return defaultPersisted();
      const raw = JSON.parse(this.readFileSync(this.statePath, 'utf8') as string) as Partial<HostPresencePersistedState>;
      return {
        ...defaultPersisted(),
        ...raw,
        productName: PRODUCT_NAME,
      };
    } catch {
      return defaultPersisted();
    }
  }

  private writeState(state: HostPresencePersistedState): void {
    this.mkdirSync(this.stateDirectory, { recursive: true });
    this.writeFileSync(this.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private renderLines(snapshot: HostPresenceSnapshot): string[] {
    return [
      `product: ${snapshot.productName}`,
      `installed: ${snapshot.installed ? 'yes' : 'no'}`,
      `status: ${snapshot.status}`,
      `running: ${snapshot.running ? 'yes' : 'no'}`,
      `pid: ${snapshot.pid ?? 'none'}`,
      `binary: ${snapshot.binary.present ? 'yes' : 'no'} (${snapshot.binary.mode})`,
      `bun-required: ${snapshot.binary.bunRequired ? 'yes' : 'no'}`,
      `policy-authority: ${snapshot.policyAuthority}`,
      `gateway: ${snapshot.gateway.baseUrl} (${snapshot.gateway.ready ? 'ready' : 'down'}) — ${snapshot.gateway.summary}`,
      `goal-loop: ${snapshot.goalLoop.status} heartbeat=${snapshot.goalLoop.lastHeartbeatAt || 'none'} source=${snapshot.goalLoop.source}`,
      `daemon: ${snapshot.daemon.status} health=${snapshot.daemon.health} pid=${snapshot.daemon.pid ?? 'none'}`,
      `os-service: ${snapshot.osService.scaffolded ? 'scaffolded' : 'missing'} registered=${snapshot.osService.registered ? 'yes' : 'no'} (${snapshot.osService.platform})`,
      `supervisor: ${snapshot.supervisor.summary}`,
    ];
  }
}

function resolveGatewayBaseUrl(env: NodeJS.ProcessEnv): string {
  const pick = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  };
  return (
    pick(env.ZAVORTH_GATEWAY_BASE_URL)
    || pick(env.ZavorthGateway_BASE_URL)
    || pick(env.BASE_URL)
    || pick(env.NEXT_PUBLIC_BASE_URL)
    || DEFAULT_GATEWAY
  );
}

function defaultResolveBinary(projectRoot: string, env: NodeJS.ProcessEnv): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const launch = require(path.join(projectRoot, 'bin', 'lib', 'launch-code-tui.cjs')) as {
      resolveCompiledCodeBinary?: (root: string, env: NodeJS.ProcessEnv) => string | null;
    };
    if (typeof launch.resolveCompiledCodeBinary === 'function') {
      return launch.resolveCompiledCodeBinary(projectRoot, env);
    }
  } catch {
    // fall through
  }
  return null;
}

function defaultEnsureBinary(
  projectRoot: string,
  env: NodeJS.ProcessEnv,
): { ok: boolean; path: string | null; detail: string } {
  const existing = defaultResolveBinary(projectRoot, env);
  if (existing) {
    return { ok: true, path: existing, detail: `already present: ${existing}` };
  }
  const ensureScript = path.join(projectRoot, 'scripts', 'ensure-code-runtime.mjs');
  if (!fs.existsSync(ensureScript)) {
    return { ok: false, path: null, detail: 'ensure-code-runtime.mjs missing' };
  }
  try {
    const result = spawnSync(process.execPath, [ensureScript], {
      cwd: projectRoot,
      env: { ...env, ZAVORTH_CODE_ENSURE_ONCE: '1' },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
    }) as SpawnSyncReturns<string>;
    const after = defaultResolveBinary(projectRoot, env);
    if (after) {
      return { ok: true, path: after, detail: `ensured binary: ${after}` };
    }
    return {
      ok: result.status === 0,
      path: null,
      detail: result.status === 0
        ? 'ensure completed soft (binary still optional; Bun+sources may work)'
        : `ensure exit ${result.status}`,
    };
  } catch (error: unknown) {
    return { ok: false, path: null, detail: errorMessage(error) };
  }
}

function defaultProbeGateway(baseUrl: string): { ok: boolean; summary: string } {
  // Soft offline default — no network in unit tests; callers inject probes for live use.
  return {
    ok: false,
    summary: `not probed (${baseUrl})`,
  };
}

function defaultIsPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultKillPid(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

function buildWindowsTaskXml(input: { projectRoot: string; command: string }): string {
  const workingDirectory = input.projectRoot.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const command = input.command.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Zavorth HostPresenceUnit (user-level scaffold)</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c ${command}</Arguments>
      <WorkingDirectory>${workingDirectory}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

export function renderHostPresenceText(snapshot: HostPresenceSnapshot): string {
  return snapshot.lines.join('\n');
}
