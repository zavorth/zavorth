import fs from 'fs';
import path from 'path';
import type {
  ZavorthRemoteTransportEntry,
  ZavorthRemoteTransportSnapshot,
} from './ZavorthRemoteTransportService.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import { GatewayCompatibilityDoctorService } from './GatewayCompatibilityDoctorService.js';
import { AIGatewaySidecarService } from './AIGatewaySidecarService.js';
import { RemoteTransportDoctorService } from './RemoteTransportDoctorService.js';
import { ToolHookPipelineService } from './ToolHookPipelineService.js';

type RemoteTransportActionRuntime = {
  now?: () => Date;
  defaultWorkspace?: string | null;
  remoteTransportService?: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  remoteTransportDoctorService?: Pick<RemoteTransportDoctorService, 'run' | 'readLastReport'>;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
  AIGatewaySidecarService?: Pick<AIGatewaySidecarService, 'start' | 'stop'>;
  GatewayCompatibilityDoctorService?: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  historyFilePath?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type ZavorthRemoteTransportActionExecution = {
  generatedAt: string;
  transportId: string;
  actionId: 'inspect' | 'prepare' | 'smoke' | 'repair';
  status: 'applied' | 'manual' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  selected: ZavorthRemoteTransportEntry | null;
  snapshot: ZavorthRemoteTransportSnapshot;
};

export type ZavorthRemoteTransportActionHistoryEntry = {
  occurredAt: string;
  transportId: string;
  actionId: ZavorthRemoteTransportActionExecution['actionId'];
  status: ZavorthRemoteTransportActionExecution['status'];
  ok: boolean;
  summary: string;
  requestedBy: string | null;
};

export type ZavorthRemoteTransportActionHistorySnapshot = {
  generatedAt: string;
  transportId: string | null;
  summary: {
    total: number;
    ok: number;
    blocked: number;
  };
  entries: ZavorthRemoteTransportActionHistoryEntry[];
};

export class ZavorthRemoteTransportActionService {
  private readonly now: () => Date;
  private readonly defaultWorkspace: string | null;
  private readonly remoteTransports: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
  private readonly remoteTransportDoctor: Pick<RemoteTransportDoctorService, 'run' | 'readLastReport'>;
  private readonly hookPipeline: Pick<ToolHookPipelineService, 'run'>;
  private readonly AIGatewaySidecar: Pick<AIGatewaySidecarService, 'start' | 'stop'>;
  private readonly AIGatewayCompatibilityDoctor: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  private readonly historyFilePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: RemoteTransportActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultWorkspace = this.normalizeWorkspace(runtime.defaultWorkspace);
    this.remoteTransports = runtime.remoteTransportService || new ZavorthRemoteTransportService();
    this.remoteTransportDoctor =
      runtime.remoteTransportDoctorService ||
      new RemoteTransportDoctorService({
        remoteTransportService: this.remoteTransports,
      });
    this.hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
    this.AIGatewaySidecar = runtime.AIGatewaySidecarService || new AIGatewaySidecarService();
    this.AIGatewayCompatibilityDoctor =
      runtime.GatewayCompatibilityDoctorService || new GatewayCompatibilityDoctorService();
    this.historyFilePath =
      runtime.historyFilePath
      || path.resolve(process.cwd(), 'data', 'runtime', 'remote-transport-action-history.json');
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async execute(input: {
    transportId: string;
    actionId: string;
    requestedBy?: string | null;
    workspace?: string | null;
  }): Promise<ZavorthRemoteTransportActionExecution> {
    const transportId = String(input.transportId || '').trim();
    const actionId = this.normalizeActionId(input.actionId);
    const workspace = this.normalizeWorkspace(input.workspace);
    if (!transportId) {
      throw new Error('transportId obrigatorio.');
    }
    if (!actionId) {
      throw new Error('actionId obrigatorio.');
    }

    const selected = this.remoteTransports.buildSnapshot({ selectedId: transportId }).selected;
    if (!selected) {
      throw new Error(`Transporte remoto nao encontrado: ${transportId}.`);
    }

    const before = await this.hookPipeline.run({
      event: 'transport.before_action',
      workspace,
      context: {
        transportId,
        actionId,
        requestedBy: String(input.requestedBy || '').trim() || null,
      },
    });
    if (!before.ok) {
      return this.finish(actionId, selected, 'blocked', 'Um hook bloqueou a acao de transporte remoto.', [
        'Revise o hook de workspace associado a transport.before_action.',
      ]);
    }

    let result: ZavorthRemoteTransportActionExecution;
    switch (actionId) {
      case 'inspect':
        result = this.finish(actionId, selected, 'manual', `Inspecao pronta para ${selected.label}.`, [
          selected.operatorSummary,
          ...(selected.endpoint ? [`Endpoint: ${selected.endpoint}`] : []),
          ...(selected.actionHint ? [`Proximo passo sugerido: ${selected.actionHint}`] : []),
        ]);
        break;
      case 'prepare':
        result = await this.executePrepare(selected);
        break;
      case 'smoke':
        result = await this.executeSmoke(selected);
        break;
      case 'repair':
        result = await this.executeRepair(selected);
        break;
      default:
        throw new Error(`Acao de transporte desconhecida: ${actionId}.`);
    }

    await this.hookPipeline.run({
      event: 'transport.after_action',
      workspace,
      context: {
        transportId,
        actionId,
        status: result.status,
        ok: result.ok,
        requestedBy: String(input.requestedBy || '').trim() || null,
      },
    });

    this.appendHistory(result, String(input.requestedBy || '').trim() || null);
    return result;
  }

  public readHistory(input: {
    transportId?: string | null;
    limit?: number | null;
  } = {}): ZavorthRemoteTransportActionHistorySnapshot {
    const transportId = String(input.transportId || '').trim() || null;
    const limit = Number.isFinite(Number(input.limit)) ? Math.max(1, Number(input.limit)) : 20;
    const filtered = this.readHistoryEntries()
      .filter((entry) => !transportId || entry.transportId === transportId)
      .slice(0, limit);
    return {
      generatedAt: this.now().toISOString(),
      transportId,
      summary: {
        total: filtered.length,
        ok: filtered.filter((entry) => entry.ok).length,
        blocked: filtered.filter((entry) => !entry.ok).length,
      },
      entries: filtered,
    };
  }

  private async executePrepare(selected: ZavorthRemoteTransportEntry): Promise<ZavorthRemoteTransportActionExecution> {
    if (selected.id === 'AIGateway') {
      const started = await this.AIGatewaySidecar.start();
      return this.finish(
        'prepare',
        selected,
        started.ready ? 'applied' : 'manual',
        started.ready
          ? `${selected.label} foi preparado e confirmou health no host.`
          : `${selected.label} recebeu preparo operacional, mas ainda aguarda confirmacao de health.`,
        [
          started.message,
          `Base URL: ${started.baseUrl}.`,
          ...(started.advertisedBaseUrl ? [`Base URL publica: ${started.advertisedBaseUrl}.`] : []),
        ],
      );
    }

    if (selected.readiness === 'ready') {
      return this.finish('prepare', selected, 'manual', `${selected.label} ja esta pronto no plano remoto.`, [
        selected.operatorSummary,
        'Nao ha preparo adicional obrigatorio neste momento.',
      ]);
    }

    const details = [
      selected.operatorSummary,
      ...(selected.actionHint ? [`Comando sugerido: ${selected.actionHint}`] : []),
      ...selected.details.slice(0, 3),
    ];
    return this.finish('prepare', selected, 'applied', `${selected.label} recebeu um roteiro de preparo.`, details);
  }

  private async executeSmoke(selected: ZavorthRemoteTransportEntry): Promise<ZavorthRemoteTransportActionExecution> {
    if (selected.id === 'AIGateway') {
      const compat = await this.AIGatewayCompatibilityDoctor.run();
      const report = await this.remoteTransportDoctor.run({ selectedId: selected.id });
      const item = report.items.find((candidate) => candidate.transportId === selected.id) || null;
      return this.finish(
        'smoke',
        selected,
        compat.ok && report.status !== 'failed' ? 'applied' : 'blocked',
        compat.ok && report.status !== 'failed'
          ? `Smoke real concluido para ${selected.label}.`
          : `Smoke real encontrou pendencias em ${selected.label}.`,
        [
          compat.summary,
          report.summary,
          ...(item?.details || []),
        ],
      );
    }

    if (selected.readiness === 'ready') {
      return this.finish('smoke', selected, 'applied', `Smoke leve concluido para ${selected.label}.`, [
        selected.operatorSummary,
        selected.endpoint
          ? `Endpoint visivel: ${selected.endpoint}.`
          : 'Transporte sem endpoint publico, mas pronto no plano atual.',
      ]);
    }

    return this.finish('smoke', selected, 'blocked', `Smoke bloqueado para ${selected.label}.`, [
      selected.operatorSummary,
      ...(selected.actionHint ? [`Prepare antes: ${selected.actionHint}`] : []),
    ]);
  }

  private async executeRepair(selected: ZavorthRemoteTransportEntry): Promise<ZavorthRemoteTransportActionExecution> {
    if (selected.id === 'AIGateway') {
      await this.AIGatewaySidecar.stop();
      const restarted = await this.AIGatewaySidecar.start();
      const compat = await this.AIGatewayCompatibilityDoctor.run();
      const report = await this.remoteTransportDoctor.run({ selectedId: selected.id });
      const item = report.items.find((candidate) => candidate.transportId === selected.id) || null;
      return this.finish(
        'repair',
        selected,
        restarted.ready && compat.ok && report.status !== 'failed' ? 'applied' : 'blocked',
        restarted.ready && compat.ok && report.status !== 'failed'
          ? `${selected.label} foi reconciliado e revalidado no host.`
          : `${selected.label} executou repair, mas ainda terminou com pendencias.`,
        [
          restarted.message,
          compat.summary,
          report.summary,
          ...(item?.details || []),
        ],
      );
    }

    if (selected.readiness === 'disabled') {
      return this.finish('repair', selected, 'blocked', `Repair bloqueado para ${selected.label}.`, [
        selected.operatorSummary,
        'Esse transporte ainda esta desativado no runtime atual.',
        ...(selected.actionHint ? [`Habilite antes: ${selected.actionHint}`] : []),
      ]);
    }

    if (selected.readiness === 'ready' && !selected.telemetry.lastError && selected.telemetry.pendingWork === 0) {
      return this.finish('repair', selected, 'manual', `${selected.label} ja esta saudavel no plano remoto.`, [
        selected.operatorSummary,
        'Nao existe repair obrigatorio neste momento.',
      ]);
    }

    const details = [
      selected.operatorSummary,
      selected.telemetry.statusLine,
      selected.telemetry.lastError
        ? `Ultimo desvio observado: ${selected.telemetry.lastError}`
        : 'Sem erro fatal registrado; o repair foca reconciliar estado e fila.',
      selected.telemetry.pendingWork > 0
        ? `Pendencias em aberto: ${selected.telemetry.pendingWork}.`
        : 'Sem pendencias em aberto no transporte.',
      ...(selected.actionHint ? [`Comando sugerido: ${selected.actionHint}`] : []),
      ...selected.details.slice(0, 2),
    ];

    return this.finish('repair', selected, 'applied', `${selected.label} recebeu um roteiro de repair.`, details);
  }

  private finish(
    actionId: ZavorthRemoteTransportActionExecution['actionId'],
    selected: ZavorthRemoteTransportEntry,
    status: ZavorthRemoteTransportActionExecution['status'],
    summary: string,
    details: string[],
  ): ZavorthRemoteTransportActionExecution {
    const snapshot = this.remoteTransports.buildSnapshot({ selectedId: selected.id });
    return {
      generatedAt: this.now().toISOString(),
      transportId: selected.id,
      actionId,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      selected: snapshot.selected,
      snapshot,
    };
  }

  private appendHistory(
    result: ZavorthRemoteTransportActionExecution,
    requestedBy: string | null,
  ): void {
    const current = this.readHistoryEntries();
    const next: ZavorthRemoteTransportActionHistoryEntry = {
      occurredAt: result.generatedAt,
      transportId: result.transportId,
      actionId: result.actionId,
      status: result.status,
      ok: result.ok,
      summary: result.summary,
      requestedBy,
    };
    const merged = [next, ...current].slice(0, 100);
    if (!this.existsSync(path.dirname(this.historyFilePath))) {
      this.mkdirSync(path.dirname(this.historyFilePath), { recursive: true });
    }
    this.writeFileSync(this.historyFilePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  private readHistoryEntries(): ZavorthRemoteTransportActionHistoryEntry[] {
    try {
      if (!this.existsSync(this.historyFilePath)) {
        return [];
      }
      const parsed = JSON.parse(this.readFileSync(this.historyFilePath, 'utf8'));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          occurredAt: String(entry.occurredAt || '').trim(),
          transportId: String(entry.transportId || '').trim(),
          actionId: this.normalizeActionId(String(entry.actionId || '').trim()) || 'inspect',
          status: ['applied', 'manual', 'blocked'].includes(String(entry.status || '').trim())
            ? String(entry.status || '').trim() as ZavorthRemoteTransportActionExecution['status']
            : 'manual',
          ok: entry.ok !== false,
          summary: String(entry.summary || '').trim(),
          requestedBy: String(entry.requestedBy || '').trim() || null,
        }))
        .filter((entry) => Boolean(entry.occurredAt && entry.transportId && entry.summary));
    } catch {
      return [];
    }
  }

  private normalizeActionId(value: string | null | undefined): ZavorthRemoteTransportActionExecution['actionId'] | '' {
    const normalized = String(value || '').trim().toLowerCase().split(':').pop() || '';
    switch (normalized) {
      case 'inspect':
      case 'prepare':
      case 'smoke':
      case 'repair':
        return normalized;
      default:
        return '';
    }
  }

  private normalizeWorkspace(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    return this.defaultWorkspace || process.cwd();
  }
}
