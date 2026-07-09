
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { AIGatewaySidecarService } from './AIGatewaySidecarService.js';
import { ZavorthGatewayLauncherService } from './ZavorthGatewayLauncherService.js';
import { logger } from '../logger.js';
import {
ZavorthRemoteTransportService,
  type ZavorthRemoteTransportEntry,
} from './ZavorthRemoteTransportService.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
export type RemoteTransportDoctorItem = {
  transportId: string;
  label: string;
  kind: ZavorthRemoteTransportEntry['kind'];
  transport: string;
  readiness: ZavorthRemoteTransportEntry['readiness'];
  available: boolean;
  endpoint: string | null;
  status: 'passed' | 'failed' | 'skipped';
  probeStatus: 'passed' | 'failed' | 'skipped';
  probeHttpStatus: number | null;
  summary: string;
  error: string | null;
  recommendedAction: string | null;
  details: string[];
};

export type RemoteTransportDoctorReport = {
  checkedAt: string;
  status: 'passed' | 'failed' | 'skipped';
  summary: string;
  command: string;
  file: string;
  items: RemoteTransportDoctorItem[];
};

type RemoteTransportDoctorRuntime = {
  now?: () => Date;
  remoteTransportService?: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  reportFilePath?: string;
  fetchImpl?: typeof fetch;
  aiGatewaySidecar?: Pick<AIGatewaySidecarService, 'start'>;
  gatewayLauncher?: Pick<ZavorthGatewayLauncherService, 'ensureStarted'>;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export class RemoteTransportDoctorService {
  private readonly now: () => Date;
  private readonly remoteTransportService: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  private readonly reportFilePath: string;
  private readonly fetchImpl: typeof fetch | null;
  private readonly aiGatewaySidecar: Pick<AIGatewaySidecarService, 'start'>;
  private readonly gatewayLauncher: Pick<ZavorthGatewayLauncherService, 'ensureStarted'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: RemoteTransportDoctorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.remoteTransportService = runtime.remoteTransportService || new ZavorthRemoteTransportService();
    this.reportFilePath = runtime.reportFilePath || config.remoteTransportDoctorReportFile;
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.aiGatewaySidecar = runtime.aiGatewaySidecar || new AIGatewaySidecarService();
    this.gatewayLauncher = runtime.gatewayLauncher || new ZavorthGatewayLauncherService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async run(input: { selectedId?: string | null } = {}): Promise<RemoteTransportDoctorReport> {
    const snapshot = this.remoteTransportService.buildSnapshot({
      selectedId: String(input.selectedId || '').trim() || null,
    });
    const checkedAt = this.now().toISOString();
    const items = await Promise.all(snapshot.entries.map((entry) => this.inspectEntry(entry)));
    const failedCount = items.filter((item) => item.status === 'failed').length;
    const passedCount = items.filter((item) => item.status === 'passed').length;
    const status: RemoteTransportDoctorReport['status'] =
      failedCount > 0
        ? 'failed'
        : passedCount > 0
          ? 'passed'
          : 'skipped';

    const report: RemoteTransportDoctorReport = {
      checkedAt,
      status,
      summary: this.buildSummary(status),
      command: 'npm run test:transports:smoke',
      file: this.reportFilePath,
      items,
    };

    this.writeReport(report);
    return report;
  }

  public readLastReport(input: { selectedId?: string | null } = {}): RemoteTransportDoctorReport | null {
    try {
      if (!this.existsSync(this.reportFilePath)) {
        return null;
      }
      const parsed = JSON.parse(this.readFileSync(this.reportFilePath, 'utf8')) as RemoteTransportDoctorReport;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        return null;
      }
      const selectedId = String(input.selectedId || '').trim() || null;
      if (!selectedId) {
        return parsed;
      }
      const items = parsed.items.filter((item) => item.transportId === selectedId);
      return {
        ...parsed,
        status: this.resolveStatus(items),
        items,
      };
    } catch (error: unknown) {logger.warn('[Remote Transport Doctor] parsing failed', error); return null; }
  }

  private async inspectEntry(entry: ZavorthRemoteTransportEntry): Promise<RemoteTransportDoctorItem> {
    if (entry.readiness === 'disabled') {
      return {
        transportId: entry.id,
        label: entry.label,
        kind: entry.kind,
        transport: entry.transport,
        readiness: entry.readiness,
        available: false,
        endpoint: entry.endpoint,
        status: 'skipped',
        probeStatus: 'skipped',
        probeHttpStatus: null,
        summary: `${entry.label} esta desativado neste runtime.`,
        error: null,
        recommendedAction: null,
        details: [
          entry.operatorSummary,
          ...(entry.actionHint ? [`Comando util: ${entry.actionHint}`] : []),
        ],
      };
    }

    const hasPendingWork = entry.telemetry.pendingWork > 0;
    const rawError = entry.telemetry.lastError;
    const benignError = typeof rawError === 'string'
      && /ainda nao iniciou|ultimo processo registrado|desativado|indisponivel|AIGateway upstream|pairing draft expirado/i.test(rawError);
    const hasError = Boolean(rawError) && !benignError;
    const inactive =
      entry.readiness !== 'ready'
      && entry.available === false
      && !hasPendingWork
      && !hasError;

    if (inactive) {
      return {
        transportId: entry.id,
        label: entry.label,
        kind: entry.kind,
        transport: entry.transport,
        readiness: entry.readiness,
        available: entry.available,
        endpoint: entry.endpoint,
        status: 'skipped',
        probeStatus: 'skipped',
        probeHttpStatus: null,
        summary: `${entry.label} ainda nao esta ativo neste runtime.`,
        error: null,
        recommendedAction: entry.actionHint || null,
        details: [
          entry.operatorSummary,
          entry.telemetry.statusLine,
          ...(entry.actionHint ? [`Comando util: ${entry.actionHint}`] : []),
        ],
      };
    }

    const reconciliationDetails =
      entry.id === 'AIGateway'
        ? await this.ensureAIGatewayReachable(entry.endpoint)
        : [];
    const probe = await this.probeEndpoint(entry.endpoint);
    const endpointReachable = probe.status !== 'failed';
    const ready = entry.readiness === 'ready' && !hasError && !hasPendingWork && endpointReachable;

    if (ready) {
      return {
        transportId: entry.id,
        label: entry.label,
        kind: entry.kind,
        transport: entry.transport,
        readiness: entry.readiness,
        available: entry.available,
        endpoint: entry.endpoint,
        status: 'passed',
        probeStatus: probe.status,
        probeHttpStatus: probe.httpStatus,
        summary: entry.endpoint
          ? `${entry.label} validado por probe ativo e pelo snapshot do plano remoto.`
          : `${entry.label} validado a partir do snapshot do plano remoto.`,
        error: null,
        recommendedAction: null,
        details: [
          ...reconciliationDetails,
          entry.operatorSummary,
          entry.telemetry.statusLine,
          probe.detail,
          ...(entry.endpoint ? [`Endpoint: ${entry.endpoint}.`] : []),
          ...(entry.actionHint ? [`Proximo passo sugerido: ${entry.actionHint}`] : []),
        ],
      };
    }

    return {
      transportId: entry.id,
      label: entry.label,
      kind: entry.kind,
      transport: entry.transport,
      readiness: entry.readiness,
      available: entry.available,
      endpoint: entry.endpoint,
      status: 'failed',
      probeStatus: probe.status,
      probeHttpStatus: probe.httpStatus,
      summary: `${entry.label} ainda precisa de atencao operacional.`,
      error: entry.telemetry.lastError
        || (probe.status === 'failed' ? probe.detail : null)
        || (entry.telemetry.pendingWork > 0 ? 'Ha pendencias abertas no plano remoto.' : null),
      recommendedAction: 'npm run test:transports:smoke',
      details: [
        ...reconciliationDetails,
        entry.operatorSummary,
        entry.telemetry.statusLine,
        probe.detail,
        ...(entry.endpoint ? [`Endpoint: ${entry.endpoint}.`] : []),
        ...(entry.actionHint ? [`Comando sugerido: ${entry.actionHint}`] : []),
        ...entry.details.slice(0, 3),
      ],
    };
  }

  private async probeEndpoint(endpoint: string | null): Promise<{
    status: 'passed' | 'failed' | 'skipped';
    httpStatus: number | null;
    detail: string;
  }> {
    if (!endpoint) {
      return {
        status: 'skipped',
        httpStatus: null,
        detail: 'Probe ativo pulado; transporte sem endpoint HTTP declarado.',
      };
    }
    if (!this.fetchImpl) {
      return {
        status: 'skipped',
        httpStatus: null,
        detail: 'Probe ativo pulado; fetch indisponivel neste runtime.',
      };
    }

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'GET',
      });
      if (response.status >= 500) {
        return {
          status: 'failed',
          httpStatus: response.status,
          detail: `Probe ativo recebeu HTTP ${response.status} em ${endpoint}.`,
        };
      }
      return {
        status: 'passed',
        httpStatus: response.status,
        detail: `Probe ativo confirmou reachability em ${endpoint} (HTTP ${response.status}).`,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Remote Transport Doctor] network request failed', error);
    return {
        status: 'failed',
        httpStatus: null,
        detail: `Probe ativo falhou para ${endpoint}: ${errorMessage(error)}`,
      };
  }
  }

  private async ensureAIGatewayReachable(endpoint: string | null): Promise<string[]> {
    const details: string[] = [];
    if (!endpoint) {
      return details;
    }

    const initialProbe = await this.probeEndpoint(endpoint);
    if (initialProbe.status !== 'failed') {
      return details;
    }

    try {
      const sidecar = await this.aiGatewaySidecar.start();
      details.push(sidecar.message);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      details.push(`Tentativa de start do sidecar AIGateway falhou: ${errorMessage(error)}`);
      return details;
    }

    try {
      const gateway = await this.gatewayLauncher.ensureStarted();
      details.push(gateway.message || 'Gateway AIGateway reconciliado antes do probe.');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      details.push(`Tentativa de start do gateway AIGateway falhou: ${errorMessage(error)}`);
    }

    return details;
  }

  private buildSummary(status: RemoteTransportDoctorReport['status']): string {
    if (status === 'failed') {
      return 'Doctor dos transportes remotos encontrou pendencias operacionais.';
    }
    if (status === 'passed') {
      return 'Doctor dos transportes remotos validou os transportes disponiveis.';
    }
    return 'Nenhum transporte remoto elegivel para doctor neste runtime.';
  }

  private resolveStatus(items: RemoteTransportDoctorItem[]): RemoteTransportDoctorReport['status'] {
    if (!items.length) {
      return 'skipped';
    }
    if (items.some((item) => item.status === 'failed')) {
      return 'failed';
    }
    if (items.some((item) => item.status === 'passed')) {
      return 'passed';
    }
    return 'skipped';
  }

  private writeReport(report: RemoteTransportDoctorReport): void {
    if (!this.reportFilePath) {
      return;
    }

    if (!this.existsSync(path.dirname(this.reportFilePath))) {
      this.mkdirSync(path.dirname(this.reportFilePath), { recursive: true });
    }
    this.writeFileSync(this.reportFilePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
}
