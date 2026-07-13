import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

export type WhatsAppBridgeSupervisorStatus = {
  contractVersion: 'zavorth-whatsapp-bridge-supervisor/1';
  generatedAt: string;
  experimental: true;
  tier: 'T2';
  productionClaim: 'experimental';
  desired: 'running' | 'stopped';
  process: {
    running: boolean;
    pid: number | null;
    exitCode: number | null;
    restarts: number;
    lastStartAt: string | null;
    lastExitAt: string | null;
    lastError: string | null;
  };
  health: {
    ok: boolean;
    connection: string | null;
    httpStatus: number | null;
    scriptHash: string | null;
    detail: string;
  };
  bridgeUrl: string;
  sessionDir: string;
  statusFile: string;
  packageReady: boolean;
  nextStep: string | null;
};

type SupervisorDeps = {
  projectRoot?: string | null;
  now?: () => Date;
  spawnImpl?: typeof spawn;
  fetchImpl?: typeof fetch;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const DEFAULT_PORT = 3910;

export class WhatsAppBridgeSupervisorService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly spawnImpl: typeof spawn;
  private readonly fetchImpl: typeof fetch;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  private child: ChildProcess | null = null;
  private desired: 'running' | 'stopped' = 'stopped';
  private restarts = 0;
  private lastStartAt: string | null = null;
  private lastExitAt: string | null = null;
  private lastError: string | null = null;
  private exitCode: number | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(deps: SupervisorDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.now = deps.now || (() => new Date());
    this.spawnImpl = deps.spawnImpl || spawn;
    this.fetchImpl = deps.fetchImpl || fetch;
    this.existsSync = deps.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = deps.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = deps.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = deps.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public get bridgeRoot(): string {
    return path.join(this.projectRoot, 'scripts', 'whatsapp-bridge');
  }

  public get bridgeEntry(): string {
    return path.join(this.bridgeRoot, 'bridge.mjs');
  }

  public get sessionDir(): string {
    return String(config.whatsappSessionDir || '').trim()
      || path.join(this.projectRoot, 'data', 'whatsapp-bridge', 'session');
  }

  public get statusFile(): string {
    return String(config.whatsappStatusFile || '').trim()
      || path.join(this.projectRoot, 'data', 'runtime', 'whatsapp-bridge-status.json');
  }

  public get bridgeUrl(): string {
    const configured = String(config.whatsappBridgeUrl || '').trim();
    if (configured) return configured.replace(/\/$/, '');
    return `http://127.0.0.1:${DEFAULT_PORT}`;
  }

  public get packageReady(): boolean {
    return this.existsSync(path.join(this.bridgeRoot, 'node_modules', '@whiskeysockets', 'baileys'))
      || this.existsSync(path.join(this.bridgeRoot, 'node_modules', 'baileys'));
  }

  public async start(options: { pairOnly?: boolean } = {}): Promise<WhatsAppBridgeSupervisorStatus> {
    this.desired = 'running';
    if (this.child && !this.child.killed) {
      return this.status();
    }
    if (!this.existsSync(this.bridgeEntry)) {
      this.lastError = `Bridge entry missing: ${this.bridgeEntry}`;
      return this.status();
    }
    if (!this.packageReady) {
      this.lastError = 'Bridge dependencies missing. Run: cd scripts/whatsapp-bridge && npm install';
      return this.status();
    }

    this.mkdirSync(this.sessionDir, { recursive: true });
    this.mkdirSync(path.dirname(this.statusFile), { recursive: true });

    const port = this.resolvePort();
    const args = [
      this.bridgeEntry,
      '--port', String(port),
      '--host', '127.0.0.1',
      '--session', this.sessionDir,
      '--status-file', this.statusFile,
    ];
    if (options.pairOnly) args.push('--pair-only');

    try {
      this.child = this.spawnImpl(process.execPath, args, {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          WHATSAPP_ALLOWED_CHAT_IDS: (config.whatsappAllowedChatIds || []).join(','),
          WHATSAPP_SESSION_DIR: this.sessionDir,
          WHATSAPP_BRIDGE_STATUS_FILE: this.statusFile,
          ZAVORTH_WHATSAPP_INBOUND_URL: String(process.env.ZAVORTH_WHATSAPP_INBOUND_URL || process.env.WHATSAPP_INBOUND_WEBHOOK || '').trim(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.lastStartAt = this.now().toISOString();
      this.lastError = null;
      this.exitCode = null;

      this.child.stdout?.on('data', (chunk) => {
        const line = String(chunk || '').trim();
        if (line) this.appendLog(line);
      });
      this.child.stderr?.on('data', (chunk) => {
        const line = String(chunk || '').trim();
        if (line) {
          this.lastError = line.slice(0, 300);
          this.appendLog(`ERR ${line}`);
        }
      });
      this.child.on('exit', (code) => {
        this.exitCode = typeof code === 'number' ? code : null;
        this.lastExitAt = this.now().toISOString();
        this.child = null;
        if (this.desired === 'running') {
          this.scheduleRestart();
        }
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.child = null;
    }

    return this.status();
  }

  public async stop(): Promise<WhatsAppBridgeSupervisorStatus> {
    this.desired = 'stopped';
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
      this.child = null;
      this.lastExitAt = this.now().toISOString();
    }
    return this.status();
  }

  public async status(): Promise<WhatsAppBridgeSupervisorStatus> {
    const health = await this.probeHealth();
    const running = Boolean(this.child && !this.child.killed);
    return {
      contractVersion: 'zavorth-whatsapp-bridge-supervisor/1',
      generatedAt: this.now().toISOString(),
      experimental: true,
      tier: 'T2',
      productionClaim: 'experimental',
      desired: this.desired,
      process: {
        running,
        pid: this.child?.pid || null,
        exitCode: this.exitCode,
        restarts: this.restarts,
        lastStartAt: this.lastStartAt,
        lastExitAt: this.lastExitAt,
        lastError: this.lastError,
      },
      health,
      bridgeUrl: this.bridgeUrl,
      sessionDir: this.sessionDir,
      statusFile: this.statusFile,
      packageReady: this.packageReady,
      nextStep: this.resolveNextStep(running, health),
    };
  }

  private resolveNextStep(running: boolean, health: WhatsAppBridgeSupervisorStatus['health']): string | null {
    if (!this.packageReady) {
      return 'cd scripts/whatsapp-bridge && npm install';
    }
    if (!running && this.desired === 'stopped') {
      return 'zavorth whatsapp-bridge start';
    }
    if (running && health.connection === 'qr') {
      return 'Scan the QR printed by the bridge process (Linked Devices).';
    }
    if (running && !health.ok) {
      return 'Wait for Baileys connect or inspect data/runtime/whatsapp-bridge-status.json';
    }
    if (running && health.ok) {
      return 'Set WHATSAPP_BRIDGE_URL=' + this.bridgeUrl + ' and WHATSAPP_PROVIDER=baileys';
    }
    return null;
  }

  private resolvePort(): number {
    try {
      const url = new URL(this.bridgeUrl);
      const port = Number(url.port || DEFAULT_PORT);
      return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
    } catch {
      return DEFAULT_PORT;
    }
  }

  private scheduleRestart(): void {
    if (this.restartTimer) return;
    this.restarts += 1;
    const delayMs = Math.min(30_000, 1000 * Math.max(1, this.restarts));
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.desired === 'running') {
        void this.start();
      }
    }, delayMs);
  }

  private async probeHealth(): Promise<WhatsAppBridgeSupervisorStatus['health']> {
    try {
      const response = await this.fetchImpl(`${this.bridgeUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      return {
        ok: Boolean(body.ok) && response.ok,
        connection: body.connection == null ? null : String(body.connection),
        httpStatus: response.status,
        scriptHash: body.scriptHash == null ? null : String(body.scriptHash),
        detail: response.ok ? 'bridge health endpoint reachable' : `health HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        connection: null,
        httpStatus: null,
        scriptHash: null,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private appendLog(line: string): void {
    try {
      const logPath = path.join(this.projectRoot, 'data', 'runtime', 'whatsapp-bridge.log');
      this.mkdirSync(path.dirname(logPath), { recursive: true });
      this.writeFileSync(logPath, `${this.now().toISOString()} ${line}\n`, { flag: 'a' });
    } catch {
      // logging must not break supervisor
    }
  }
}
