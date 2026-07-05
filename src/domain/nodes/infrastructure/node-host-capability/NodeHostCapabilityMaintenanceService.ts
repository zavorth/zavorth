import fs from 'fs';
import path from 'path';
import { buildNodeHostIdentitySnapshot } from './NodeHostCapabilityHelpers.js';
import { NODE_HOST_SUPPORTED_CAPABILITY_IDS } from './NodeHostCapabilityCatalog.js';
import { logger } from '../../../../logger';
import type {
NodeHostCapabilityRuntime,
  NodeHostMaintenanceDoctorReport,
  NodeHostMaintenanceRepairReport,
} from './NodeHostCapabilityTypes.js';

type NodeHostMaintenanceState = {
  pendingResults: Array<Record<string, unknown>>;
  invalidCount: number;
};

export class NodeHostCapabilityMaintenanceService {
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly stateFile: string;
  private readonly allowedRoots: string[];
  private readonly env: NodeJS.ProcessEnv;

  constructor(runtime: NodeHostCapabilityRuntime) {
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
    this.allowedRoots = Array.isArray(runtime.allowedRoots) ? runtime.allowedRoots.map((entry) => path.resolve(entry)) : [this.workspaceRoot, this.tempRoot];
  }

  public buildNodeMaintenanceDoctorReport(
    requestedCapabilities: Array<string | null | undefined> = [],
  ): NodeHostMaintenanceDoctorReport {
    const state = this.readNodeMaintenanceState();
    const supportedCapabilities = this.listSupportedCapabilityIds();
    const normalizedRequestedCapabilities = Array.from(
      new Set(
        requestedCapabilities
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );
    const unsupportedCapabilities = normalizedRequestedCapabilities.filter(
      (entry) => !supportedCapabilities.includes(entry),
    );
    const issues: Array<{
      kind: 'invalid-state' | 'unsupported-capability';
      summary: string;
      actionHint: string | null;
    }> = [];

    if (state.invalidCount > 0) {
      issues.push({
        kind: 'invalid-state',
        summary: `O estado local do node host contem ${state.invalidCount} resultado(s) pendente(s) invalido(s).`,
        actionHint: 'Execute repair para higienizar o state file antes do proximo heartbeat.',
      });
    }

    if (unsupportedCapabilities.length > 0) {
      issues.push({
        kind: 'unsupported-capability',
        summary: `O node host nao implementa ${unsupportedCapabilities.join(', ')}.`,
        actionHint: 'Ajuste o catalogo anunciado ou implemente a capability antes de invocar a malha.',
      });
    }

    return {
      checkedAt: this.now().toISOString(),
      status: issues.length > 0 ? 'attention' : 'healthy',
      summary: issues.length > 0
        ? `Node host com ${issues.length} pendencia(s) local(is).`
        : 'Node host sem pendencias locais relevantes.',
      host: buildNodeHostIdentitySnapshot({
        platform: this.platform,
        workspaceRoot: this.workspaceRoot,
        tempRoot: this.tempRoot,
        allowedRoots: this.allowedRoots,
        env: this.env,
      }),
      stateFile: this.stateFile,
      pendingResults: {
        total: state.pendingResults.length,
        invalid: state.invalidCount,
      },
      requestedCapabilities: normalizedRequestedCapabilities,
      supportedCapabilities,
      issues,
    };
  }

  public repairNodeMaintenanceState(): NodeHostMaintenanceRepairReport {
    const state = this.readNodeMaintenanceState();
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify({ pendingResults: state.pendingResults }, null, 2)}\n`, 'utf8');
    return {
      repairedAt: this.now().toISOString(),
      stateFile: this.stateFile,
      keptResults: state.pendingResults.length,
      removedResults: state.invalidCount,
    };
  }

  private listSupportedCapabilityIds(): string[] {
    return [...NODE_HOST_SUPPORTED_CAPABILITY_IDS];
  }

  private readNodeMaintenanceState(): NodeHostMaintenanceState {
    try {
      if (!fs.existsSync(this.stateFile)) {
        return {
          pendingResults: [],
          invalidCount: 0,
        };
      }
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      const rawEntries: unknown[] = Array.isArray(parsed?.pendingResults) ? parsed.pendingResults : [];
      const validEntries = rawEntries.filter((entry: unknown) => this.isValidPendingResult(entry));
      return {
        pendingResults: validEntries,
        invalidCount: rawEntries.length - validEntries.length,
      };
    } catch (error) {
    logger.warn('[Node Host Capability Maintenance] JSON parse failed', error);
    return {
        pendingResults: [],
        invalidCount: 1,
      };
  }
  }

  private isValidPendingResult(entry: unknown): entry is Record<string, unknown> {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }
    const invocationId = String((entry as Record<string, unknown>).invocationId || '').trim();
    const ok = (entry as Record<string, unknown>).ok;
    return Boolean(invocationId) && typeof ok === 'boolean';
  }
}
