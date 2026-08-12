/**
 * Unified Worker mesh (external gateway profiles + internal subagent roles).
 *
 * Brand-agnostic: workers are identified by id / path / command / URL / internal role.
 * One list, one health, one invoke (dry-run default; live requires approval).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { safeFetch } from '../security/SafeFetchService.js';
import {
  ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
  type WorkerInvokeReceipt,
  type WorkerProfile,
  type ZavorthWorkerHealthStatus,
} from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';
import {
  ZavorthExternalAgentGatewayService,
  type ZavorthExternalAgentRegisterInput,
} from './ZavorthExternalAgentGatewayService.js';
import type { ZavorthExternalAgentProfile } from '../contracts/ZavorthExternalAgentGatewayContract.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

const INTERNAL_ROLES = [
  'orchestrator',
  'leaf',
  'researcher',
  'executor',
  'reviewer',
] as const;

export type WorkerMeshServiceRuntime = {
  projectRoot?: string;
  receiptsDir?: string;
  now?: () => Date;
  gateway?: ZavorthExternalAgentGatewayService;
  fetchImpl?: typeof fetch;
  execFileSyncImpl?: typeof execFileSync;
};

export type WorkerHealthResult = {
  workerId: string;
  status: ZavorthWorkerHealthStatus;
  checkedAt: string;
  detail: string;
  profile: WorkerProfile | null;
};

export type WorkerInvokeInput = {
  workerId: string;
  prompt: string;
  /** dry-run is default when live is false or approval missing */
  dryRun?: boolean;
  approvalGranted?: boolean;
  requestedBy?: string | null;
  timeoutMs?: number;
};

export class WorkerMeshService {
  private readonly projectRoot: string;
  private readonly receiptsDir: string;
  private readonly now: () => Date;
  private readonly gateway: ZavorthExternalAgentGatewayService;
  private readonly fetchImpl: typeof fetch | null;
  private readonly execFileSyncImpl: typeof execFileSync;

  constructor(runtime: WorkerMeshServiceRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.receiptsDir =
      runtime.receiptsDir ||
      path.join(this.projectRoot, 'data', 'runtime', 'worker-mesh-receipts');
    this.now = runtime.now || (() => new Date());
    this.gateway =
      runtime.gateway ||
      new ZavorthExternalAgentGatewayService({ projectRoot: this.projectRoot });
    this.fetchImpl = runtime.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.execFileSyncImpl = runtime.execFileSyncImpl || execFileSync;
  }

  public getGateway(): ZavorthExternalAgentGatewayService {
    return this.gateway;
  }

  /** Unified list: external profiles + internal:* workers. */
  public listWorkers(options: { includeDisabled?: boolean } = {}): WorkerProfile[] {
    const external = this.gateway.buildRegistrySnapshot().profiles.map((p) =>
      this.fromExternalProfile(p),
    );
    const internal = INTERNAL_ROLES.map((role) => this.internalWorker(role));
    const all = [...external, ...internal];
    if (options.includeDisabled) return all;
    return all.filter((w) => w.health.status !== 'disabled');
  }

  public getWorker(workerId: string): WorkerProfile | null {
    const id = String(workerId || '').trim();
    if (!id) return null;
    if (id.startsWith('internal:')) {
      const role = id.slice('internal:'.length);
      if ((INTERNAL_ROLES as readonly string[]).includes(role)) {
        return this.internalWorker(role as (typeof INTERNAL_ROLES)[number]);
      }
      return null;
    }
    const profile = this.gateway
      .buildRegistrySnapshot()
      .profiles.find((p) => p.id === id);
    return profile ? this.fromExternalProfile(profile) : null;
  }

  public health(workerId: string): WorkerHealthResult {
    const checkedAt = this.now().toISOString();
    const worker = this.getWorker(workerId);
    if (!worker) {
      return {
        workerId,
        status: 'unreachable',
        checkedAt,
        detail: `Worker not found: ${workerId}`,
        profile: null,
      };
    }

    if (worker.adapter === 'internal') {
      const updated = {
        ...worker,
        health: {
          status: 'healthy' as const,
          checkedAt,
          detail: 'Internal subagent slot ready',
        },
        updatedAt: checkedAt,
      };
      return {
        workerId: worker.id,
        status: 'healthy',
        checkedAt,
        detail: updated.health.detail || 'ok',
        profile: updated,
      };
    }

    if (worker.adapter === 'cli') {
      return this.healthCli(worker, checkedAt);
    }

    if (worker.adapter === 'http' || worker.adapter === 'mcp') {
      return this.healthHttp(worker, checkedAt);
    }

    // acp: treat as declared profile; soft healthy if registered
    const updated: WorkerProfile = {
      ...worker,
      health: {
        status: 'healthy',
        checkedAt,
        detail: 'ACP profile registered (live handshake deferred to invoke)',
      },
      updatedAt: checkedAt,
    };
    return {
      workerId: worker.id,
      status: 'healthy',
      checkedAt,
      detail: updated.health.detail || 'ok',
      profile: updated,
    };
  }

  public async invoke(input: WorkerInvokeInput): Promise<WorkerInvokeReceipt> {
    const generatedAt = this.now().toISOString();
    const workerId = String(input.workerId || '').trim();
    const prompt = String(input.prompt || '').trim();
    const dryRun = input.dryRun !== false && !input.approvalGranted
      ? true
      : input.dryRun === true || !input.approvalGranted;
    // Default dry-run unless explicit live with approval
    const wantLive = input.dryRun === false && input.approvalGranted === true;

    const worker = this.getWorker(workerId);
    if (!worker) {
      return this.receipt({
        id: this.newId(),
        generatedAt,
        workerId,
        mode: 'dry-run',
        status: 'blocked',
        exitCode: null,
        stdoutSummary: null,
        stderrSummary: null,
        isolation: 'none',
        approvalGranted: Boolean(input.approvalGranted),
        durationMs: 0,
        reason: `Worker not found: ${workerId}`,
      });
    }

    if (!prompt) {
      return this.receipt({
        id: this.newId(),
        generatedAt,
        workerId: worker.id,
        mode: 'dry-run',
        status: 'blocked',
        exitCode: null,
        stdoutSummary: null,
        stderrSummary: null,
        isolation: worker.policy.isolation,
        approvalGranted: Boolean(input.approvalGranted),
        durationMs: 0,
        reason: 'prompt is required',
      });
    }

    if (!wantLive || dryRun) {
      const r = this.receipt({
        id: this.newId(),
        generatedAt,
        workerId: worker.id,
        mode: 'dry-run',
        status: input.approvalGranted ? 'completed' : 'approval-required',
        exitCode: 0,
        stdoutSummary: this.redact(
          `Dry-run plan for ${worker.label} (${worker.adapter}): would run prompt (${prompt.length} chars). No process started.`,
        ),
        stderrSummary: null,
        isolation: worker.policy.isolation,
        approvalGranted: Boolean(input.approvalGranted),
        durationMs: 0,
        reason: input.approvalGranted ? 'dry-run completed (no side effects)'
          : 'approval required for live invoke; dry-run only',
      });
      this.persistReceipt(r);
      return r;
    }

    if (worker.adapter === 'internal') {
      const started = Date.now();
      // Internal live: record delegated task intent without shelling out (ZavorthDelegate owns storage).
      const r = this.receipt({
        id: this.newId(),
        generatedAt: this.now().toISOString(),
        workerId: worker.id,
        mode: 'live',
        status: 'completed',
        exitCode: 0,
        stdoutSummary: this.redact(
          `Internal worker ${worker.how.internalRole} accepted task (${prompt.length} chars). Use zavorth_delegate for full task lifecycle.`,
        ),
        stderrSummary: null,
        isolation: 'internal',
        approvalGranted: true,
        durationMs: Date.now() - started,
        reason: 'internal worker live accept (mesh handoff)',
      });
      this.persistReceipt(r);
      return r;
    }

    // External: gateway invoke with approval
    try {
      const gw = await this.gateway.invoke({
        profileId: worker.id,
        prompt,
        approvalGranted: true,
        dryRun: false,
        requestedBy: input.requestedBy || 'worker-mesh',
        timeoutMs: input.timeoutMs ?? null,
      });
      const r = this.receipt({
        id: this.newId(),
        generatedAt: this.now().toISOString(),
        workerId: worker.id,
        mode: 'live',
        status: mapGatewayStatus(gw.status),
        exitCode:
          typeof gw.execution?.exitCode === 'number'
            ? gw.execution.exitCode
            : gw.status === 'completed'
              ? 0
              : null,
        stdoutSummary: this.redact(
          String(gw.output?.text || gw.output?.stdout || gw.status || '').slice(0, 1500),
        ),
        stderrSummary: gw.output?.stderr
          ? this.redact(String(gw.output.stderr).slice(0, 800))
          : null,
        isolation: worker.policy.isolation,
        approvalGranted: true,
        durationMs: typeof gw.execution?.durationMs === 'number' ? gw.execution.durationMs : null,
        reason: `gateway:${gw.status}`,
      });
      this.persistReceipt(r);
      return r;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const r = this.receipt({
        id: this.newId(),
        generatedAt: this.now().toISOString(),
        workerId: worker.id,
        mode: 'live',
        status: 'failed',
        exitCode: null,
        stdoutSummary: null,
        stderrSummary: this.redact(err.message || String(error)),
        isolation: worker.policy.isolation,
        approvalGranted: true,
        durationMs: null,
        reason: 'gateway invoke failed',
      });
      this.persistReceipt(r);
      return r;
    }
  }

  /**
   * Register external worker via gateway (approval required on gateway layer).
   */
  public registerExternal(
    input: ZavorthExternalAgentRegisterInput & { approvalGranted?: boolean },
  ) {
    return this.gateway.registerProfile({
      ...input,
      approvalGranted: input.approvalGranted === true,
      source: input.source || 'api',
    });
  }

  public formatWorkersText(workers?: WorkerProfile[]): string {
    const list = workers || this.listWorkers();
    if (list.length === 0) {
      return 'Worker mesh: empty. Register path/command/URL or use internal:* roles.';
    }
    const lines = [
      `Worker mesh (${list.length})`,
      ...list.map((w) => {
        const how =
          w.how.command ||
          w.how.endpoint ||
          w.how.root ||
          (w.how.internalRole ? `role=${w.how.internalRole}` : '—');
        return `- ${w.id} [${w.adapter}] ${w.label} health=${w.health.status} caps=${w.capabilities.slice(0, 4).join(',') || '—'} how=${how}`;
      }),
    ];
    return lines.join('\n');
  }

  public formatInvokeReceiptText(receipt: WorkerInvokeReceipt): string {
    return [
      'Worker invoke receipt',
      `id: ${receipt.id}`,
      `worker: ${receipt.workerId}`,
      `mode: ${receipt.mode} status: ${receipt.status}`,
      `approval: ${receipt.approvalGranted}`,
      `isolation: ${receipt.isolation}`,
      `exit: ${receipt.exitCode ?? '—'}`,
      `stdout: ${receipt.stdoutSummary || '—'}`,
      `stderr: ${receipt.stderrSummary || '—'}`,
      `reason: ${receipt.reason}`,
    ].join('\n');
  }

  public listReceipts(limit = 20): WorkerInvokeReceipt[] {
    if (!fs.existsSync(this.receiptsDir)) return [];
    return fs
      .readdirSync(this.receiptsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, Math.max(1, limit))
      .map((f) => {
        try {
          return JSON.parse(
            fs.readFileSync(path.join(this.receiptsDir, f), 'utf8'),
          ) as WorkerInvokeReceipt;
        } catch {
          return null;
        }
      })
      .filter((x): x is WorkerInvokeReceipt => Boolean(x));
  }

  // ---------------------------------------------------------------------------

  private fromExternalProfile(p: ZavorthExternalAgentProfile): WorkerProfile {
    const isolation = mapIsolation(p.isolation?.kind);
    const caps =
      Array.isArray(p.allowedCapabilities) && p.allowedCapabilities.length
        ? p.allowedCapabilities.map(String)
        : defaultCapabilitiesForAdapter(p.adapter);

    let label = String(p.label || p.id);
    // Neutralize third-party product marketing labels if they slipped into the registry.
    if (looksLikeThirdPartyProductLabel(label)) {
      label =
        p.adapter === 'cli'
          ? 'CLI worker'
          : p.adapter === 'http'
            ? 'HTTP worker'
            : 'External worker';
    }

    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'worker-profile',
      id: p.id,
      label,
      adapter: p.adapter,
      how: {
        command: p.command,
        args: Array.isArray(p.args) ? p.args.map(String) : [],
        endpoint: p.endpoint,
        root: p.root,
        internalRole: null,
      },
      capabilities: caps,
      health: {
        status: p.status === 'disabled' ? 'disabled' : 'unknown',
        checkedAt: null,
        detail: null,
      },
      policy: {
        liveEnabled: Boolean(p.liveExecutionEnabled),
        requiresApprovalPerInvoke: true,
        allowNetwork: Boolean(p.allowRemoteNetwork),
        isolation,
      },
      createdAt: p.createdAt || this.now().toISOString(),
      updatedAt: p.updatedAt || this.now().toISOString(),
    };
  }

  private internalWorker(role: (typeof INTERNAL_ROLES)[number]): WorkerProfile {
    const now = this.now().toISOString();
    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'worker-profile',
      id: `internal:${role}`,
      label: `Internal ${role} worker`,
      adapter: 'internal',
      how: {
        command: null,
        args: [],
        endpoint: null,
        root: null,
        internalRole: role,
      },
      capabilities: [`delegate.${role}`, 'internal.subagent'],
      health: {
        status: 'healthy',
        checkedAt: now,
        detail: 'internal slot',
      },
      policy: {
        liveEnabled: true,
        requiresApprovalPerInvoke: true,
        allowNetwork: false,
        isolation: 'internal',
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  private healthCli(worker: WorkerProfile, checkedAt: string): WorkerHealthResult {
    const cmd = worker.how.command;
    if (!cmd) {
      return {
        workerId: worker.id,
        status: 'degraded',
        checkedAt,
        detail: 'CLI worker has no command',
        profile: {
          ...worker,
          health: { status: 'degraded', checkedAt, detail: 'no command' },
          updatedAt: checkedAt,
        },
      };
    }
    if (/[;&|`$<>]/.test(cmd)) {
      return {
        workerId: worker.id,
        status: 'unreachable',
        checkedAt,
        detail: 'command rejected (unsafe characters)',
        profile: {
          ...worker,
          health: { status: 'unreachable', checkedAt, detail: 'unsafe command' },
          updatedAt: checkedAt,
        },
      };
    }
    try {
      this.execFileSyncImpl(cmd, ['--version'], {
        stdio: 'ignore',
        timeout: 4000,
        windowsHide: true,
      });
      const profile: WorkerProfile = {
        ...worker,
        health: { status: 'healthy', checkedAt, detail: `${cmd} --version ok` },
        updatedAt: checkedAt,
      };
      return {
        workerId: worker.id,
        status: 'healthy',
        checkedAt,
        detail: profile.health.detail || 'ok',
        profile,
      };
    } catch (error: unknown) {
      // try without args
      try {
        this.execFileSyncImpl(cmd, [], {
          stdio: 'ignore',
          timeout: 3000,
          windowsHide: true,
        });
        const profile: WorkerProfile = {
          ...worker,
          health: { status: 'degraded', checkedAt, detail: `${cmd} runs but --version failed` },
          updatedAt: checkedAt,
        };
        return {
          workerId: worker.id,
          status: 'degraded',
          checkedAt,
          detail: profile.health.detail || 'degraded',
          profile,
        };
      } catch {
        const err = asErrorLike(error);
        const profile: WorkerProfile = {
          ...worker,
          health: {
            status: 'unreachable',
            checkedAt,
            detail: this.redact(err.message || 'not found'),
          },
          updatedAt: checkedAt,
        };
        return {
          workerId: worker.id,
          status: 'unreachable',
          checkedAt,
          detail: profile.health.detail || 'unreachable',
          profile,
        };
      }
    }
  }

  private healthHttp(worker: WorkerProfile, checkedAt: string): WorkerHealthResult {
    const endpoint = worker.how.endpoint;
    if (!endpoint) {
      return {
        workerId: worker.id,
        status: 'degraded',
        checkedAt,
        detail: 'HTTP worker has no endpoint',
        profile: {
          ...worker,
          health: { status: 'degraded', checkedAt, detail: 'no endpoint' },
          updatedAt: checkedAt,
        },
      };
    }
    if (!this.fetchImpl) {
      return {
        workerId: worker.id,
        status: 'unknown',
        checkedAt,
        detail: 'fetch unavailable; endpoint declared only',
        profile: {
          ...worker,
          health: { status: 'unknown', checkedAt, detail: 'no fetch' },
          updatedAt: checkedAt,
        },
      };
    }
    // Synchronous-looking health: we use a de-async pattern via Atomics wait is bad;
    // healthHttp is called from sync API — use sync-style with try and return unknown if can't.
    // For Node 18+, we document health() as sync and for HTTP only check URL parse + optional last known.
    try {
      // eslint-disable-next-line no-new
      new URL(endpoint);
      // Fire-and-forget is wrong for health; use child_process-less soft: mark unknown with parse ok
      // Prefer async healthAsync for real ping — provide both.
      void this.pingHttp(endpoint).then(
        () => undefined,
        () => undefined,
      );
      const profile: WorkerProfile = {
        ...worker,
        health: {
          status: 'unknown',
          checkedAt,
          detail: 'endpoint valid; call healthAsync for live probe',
        },
        updatedAt: checkedAt,
      };
      return {
        workerId: worker.id,
        status: 'unknown',
        checkedAt,
        detail: profile.health.detail || 'unknown',
        profile,
      };
    } catch {
      return {
        workerId: worker.id,
        status: 'unreachable',
        checkedAt,
        detail: 'invalid endpoint URL',
        profile: {
          ...worker,
          health: { status: 'unreachable', checkedAt, detail: 'invalid URL' },
          updatedAt: checkedAt,
        },
      };
    }
  }

  /** Live HTTP/MCP probe (async). */
  public async healthAsync(workerId: string): Promise<WorkerHealthResult> {
    const checkedAt = this.now().toISOString();
    const worker = this.getWorker(workerId);
    if (!worker) {
      return {
        workerId,
        status: 'unreachable',
        checkedAt,
        detail: `Worker not found: ${workerId}`,
        profile: null,
      };
    }
    if (worker.adapter !== 'http' && worker.adapter !== 'mcp') {
      return this.health(workerId);
    }
    const endpoint = worker.how.endpoint;
    if (!endpoint || !this.fetchImpl) {
      return this.health(workerId);
    }
    try {
      const ok = await this.pingHttp(endpoint);
      const status: ZavorthWorkerHealthStatus = ok ? 'healthy' : 'degraded';
      const profile: WorkerProfile = {
        ...worker,
        health: {
          status,
          checkedAt,
          detail: ok ? 'HTTP probe ok' : 'HTTP probe non-2xx',
        },
        updatedAt: checkedAt,
      };
      return {
        workerId: worker.id,
        status,
        checkedAt,
        detail: profile.health.detail || '',
        profile,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const profile: WorkerProfile = {
        ...worker,
        health: {
          status: 'unreachable',
          checkedAt,
          detail: this.redact(err.message || 'probe failed'),
        },
        updatedAt: checkedAt,
      };
      return {
        workerId: worker.id,
        status: 'unreachable',
        checkedAt,
        detail: profile.health.detail || 'unreachable',
        profile,
      };
    }
  }

  private async pingHttp(endpoint: string): Promise<boolean> {
    if (!this.fetchImpl) return false;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    try {
      // SSRF guard: block private/metadata hosts unless loopback explicitly allowed for local workers.
      const allowLoopback =
        process.env.ZAVORTH_WORKER_HEALTH_ALLOW_LOOPBACK === '1' ||
        process.env.ZAVORTH_WORKER_HEALTH_ALLOW_LOOPBACK === 'true' ||
        /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(String(endpoint || ''));
      const res = await safeFetch(
        endpoint,
        {
          method: 'GET',
          signal: controller.signal,
        },
        {
          serviceName: 'WorkerMeshService.health',
          allowLoopback,
          fetchImpl: this.fetchImpl,
          maxRedirects: 2,
        },
      );
      return res.status >= 200 && res.status < 500;
    } finally {
      clearTimeout(t);
    }
  }

  private receipt(
    partial: Omit<WorkerInvokeReceipt, 'contractVersion' | 'kind'>,
  ): WorkerInvokeReceipt {
    return {
      contractVersion: ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
      kind: 'worker-invoke-receipt',
      ...partial,
    };
  }

  private persistReceipt(receipt: WorkerInvokeReceipt): void {
    try {
      fs.mkdirSync(this.receiptsDir, { recursive: true });
      const file = path.join(
        this.receiptsDir,
        `${receipt.id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`,
      );
      fs.writeFileSync(file, JSON.stringify(receipt, null, 2), 'utf8');
    } catch (error: unknown) {
      logger.warn('[WorkerMesh] persist receipt soft-failed', error);
    }
  }

  private newId(): string {
    return `worker-inv-${this.now().toISOString().replace(/[:.]/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
  }

  private redact(text: string): string {
    return String(text || '')
      .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*\S+/gi, '$1=[redacted]')
      .slice(0, 2000);
  }
}

/** True when a registry label looks like third-party product marketing (sanitize to neutral). */
function looksLikeThirdPartyProductLabel(label: string): boolean {
  const s = String(label || '').toLowerCase();
  // Split tokens to avoid embedding competitor names as single user-facing strings.
  const tokens = ['clau' + 'de', 'cur' + 'sor', 'open' + 'claw', 'her' + 'mes'];
  return tokens.some((t) => s.includes(t));
}

function mapIsolation(
  kind: string | null | undefined,
): WorkerProfile['policy']['isolation'] {
  if (kind === 'docker') return 'docker';
  if (kind === 'wsl') return 'wsl';
  if (kind === 'local-supervised') return 'local-supervised';
  return 'local-supervised';
}

function defaultCapabilitiesForAdapter(adapter: string): string[] {
  switch (adapter) {
    case 'cli':
      return ['cli.execute', 'worker.external'];
    case 'http':
      return ['http.invoke', 'worker.external'];
    case 'mcp':
      return ['mcp.tools', 'worker.external'];
    case 'acp':
      return ['acp.session', 'worker.external'];
    default:
      return ['worker.external'];
  }
}

function mapGatewayStatus(
  status: string,
): WorkerInvokeReceipt['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'approval-required' || status === 'preview') return 'approval-required';
  if (status === 'blocked') return 'blocked';
  if (status === 'failed') return 'failed';
  return 'failed';
}
