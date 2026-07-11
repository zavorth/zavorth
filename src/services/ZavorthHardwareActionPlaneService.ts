import { HomeAssistantBridge } from '../echo/tools/iot/HomeAssistantBridge.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
} from '../contracts/ZavorthMutationPlaneContract.js';

import { MQTTPublisher } from '../echo/tools/iot/MQTTPublisher.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { TrustPlanePolicyLedgerService } from './TrustPlanePolicyLedgerService.js';
import { logger } from '../logger.js';

export type HardwareProviderId =
  | 'home-assistant'
  | 'mqtt'
  | 'webhook'
  | 'serial'
  | 'hid'
  | 'node-host';

export type HardwareProviderStatus = 'configured' | 'dormant' | 'disabled' | 'blocked';
export type HardwareDeviceType =
  | 'light'
  | 'sensor'
  | 'switch'
  | 'climate'
  | 'lock'
  | 'cover'
  | 'media'
  | 'camera'
  | 'nas'
  | 'printer'
  | 'ups'
  | 'script'
  | 'generic';
export type HardwareDeviceVisibility = 'visible' | 'read-only' | 'hidden';
export type HardwareActionStatus = 'waiting_approval' | 'draft' | 'blocked';
export type HardwareApplyStatus = 'applied' | 'verified' | 'dry_run' | 'blocked' | 'failed';

export type HardwareProviderView = {
  id: HardwareProviderId;
  label: string;
  status: HardwareProviderStatus;
  configured: boolean;
  startsOnRead: false;
  transport: 'rest' | 'mqtt' | 'webhook' | 'serial' | 'hid' | 'node-mesh';
  mutable: boolean;
  summary: string;
  blockers: string[];
};

export type HardwareDeviceRecord = {
  id: string;
  label: string;
  providerId: HardwareProviderId;
  externalId: string | null;
  type: HardwareDeviceType;
  location: string | null;
  riskLevel: ZavorthMutationRiskLevel;
  allowlisted: boolean;
  visibility: HardwareDeviceVisibility;
  allowedActions: string[];
  lastSeenAt: string | null;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type HardwareDeviceView = HardwareDeviceRecord & {
  mutationMode: 'mutable' | 'read_only' | 'hidden';
  providerStatus: HardwareProviderStatus;
  operatorSummary: string;
  blockers: string[];
};

export type HardwareAuditEntry = {
  id: string;
  at: string;
  event: string;
  status: 'previewed' | 'applied' | 'blocked' | 'verified' | 'auto_paused' | 'emergency_stop' | 'noop';
  providerId: HardwareProviderId | null;
  deviceId: string | null;
  action: string | null;
  requestedBy: string | null;
  planId: string | null;
  summary: string;
};

export type HardwareEmergencyStop = {
  active: boolean;
  reason: string | null;
  activatedAt: string | null;
  activatedBy: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
};

export type HardwareAutomationFailureGuard = {
  automationId: string;
  deviceId: string | null;
  failures: number;
  threshold: number;
  lastFailureAt: string | null;
  autoPaused: boolean;
  pausedAt: string | null;
  reason: string | null;
};

export type HardwareActionPlaneState = {
  version: 1;
  updatedAt: string | null;
  emergencyStop: HardwareEmergencyStop;
  devices: Record<string, HardwareDeviceRecord>;
  failureGuards: Record<string, HardwareAutomationFailureGuard>;
  audit: HardwareAuditEntry[];
};

export type HardwareActionPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    providers: number;
    configuredProviders: number;
    devices: number;
    visibleDevices: number;
    allowlistedDevices: number;
    readOnlyDevices: number;
    hiddenDevices: number;
    pendingHardwarePlans: number;
    emergencyStopActive: boolean;
    autoPausedAutomations: number;
    heavyRuntimesStarted: false;
  };
  policy: {
    actionFlow: ['preview', 'approval', 'apply', 'verify', 'audit'];
    providersStartOnRead: false;
    allowlistRequiredForMutation: true;
    nonAllowlistedDefault: 'read-only';
    emergencyStopBlocksPhysicalActions: true;
    physicalAutomationsAutoPauseAfterFailures: true;
    trustPlaneDomain: 'hardware';
    watchModeVerification: 'optional-after-approval';
    federatedMeshDelegation: 'node-host-provider';
  };
  providers: HardwareProviderView[];
  devices: HardwareDeviceView[];
  emergencyStop: HardwareEmergencyStop;
  automationGuards: HardwareAutomationFailureGuard[];
  pendingPlans: ZavorthMutationPlan[];
  audit: HardwareAuditEntry[];
  actions: Array<{
    id: string;
    label: string;
    command: string;
    severity: 'info' | 'warn' | 'critical';
    reason: string;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export type HardwareProviderActionEvidence = {
  ok: boolean;
  status?: 'applied' | 'verified' | 'failed' | 'blocked';
  summary: string;
  data?: Record<string, unknown> | null;
  verified?: boolean;
};

export type HardwareProviderAdapter = {
  execute: (input: {
    provider: HardwareProviderView;
    device: HardwareDeviceRecord;
    action: string;
    payload: Record<string, unknown>;
    requestedBy: string | null;
  }) => Promise<HardwareProviderActionEvidence> | HardwareProviderActionEvidence;
  verify?: (input: {
    provider: HardwareProviderView;
    device: HardwareDeviceRecord;
    action: string;
    payload: Record<string, unknown>;
  }) => Promise<HardwareProviderActionEvidence> | HardwareProviderActionEvidence;
};

export type HardwarePlanActionInput = {
  deviceId: string;
  action: string;
  payload?: Record<string, unknown> | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  approvalRequired?: boolean | null;
  approvalScope?: 'once' | 'session' | 'host' | null;
};

export type HardwarePlanActionResult = {
  generatedAt: string;
  status: HardwareActionStatus;
  ok: boolean;
  summary: string;
  blockers: string[];
  device: HardwareDeviceView | null;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
  snapshot: HardwareActionPlaneSnapshot;
};

export type HardwareApplyPlanResult = {
  generatedAt: string;
  status: HardwareApplyStatus;
  ok: boolean;
  summary: string;
  blockers: string[];
  device: HardwareDeviceView | null;
  mutationPlan: ZavorthMutationPlan | null;
  evidence: HardwareProviderActionEvidence | null;
  snapshot: HardwareActionPlaneSnapshot;
};

type HardwareRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  stateFile?: string | null;
  env?: NodeJS.ProcessEnv;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'listPlans' | 'readPlan' | 'approvePlan' | 'attachApproval' | 'markApplied' | 'markBlocked'
  > | null;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'> | null;
  policyLedgerService?: Pick<TrustPlanePolicyLedgerService, 'append' | 'summarize'> | null;
  providerAdapters?: Partial<Record<HardwareProviderId, HardwareProviderAdapter>> | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const PROVIDERS: Array<{
  id: HardwareProviderId;
  label: string;
  transport: HardwareProviderView['transport'];
  mutable: boolean;
}> = [
  { id: 'home-assistant', label: 'Home Assistant', transport: 'rest', mutable: true },
  { id: 'mqtt', label: 'MQTT', transport: 'mqtt', mutable: true },
  { id: 'webhook', label: 'Webhook local', transport: 'webhook', mutable: true },
  { id: 'serial', label: 'Serial/USB', transport: 'serial', mutable: true },
  { id: 'hid', label: 'HID', transport: 'hid', mutable: true },
  { id: 'node-host', label: 'Federated node host', transport: 'node-mesh', mutable: true },
];

const HIGH_RISK_ACTIONS = new Set([
  'unlock',
  'lock.unlock',
  'disarm',
  'alarm.disarm',
  'open_cover',
  'cover.open',
  'door.open',
  'garage.open',
  'vacuum_start',
  'script.run',
  'run_script',
]);

const READ_ONLY_ACTIONS = new Set([
  'read',
  'read_state',
  'state.read',
  'sensor.read',
  'status',
  'device.info',
]);

export class ZavorthHardwareActionPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly stateFile: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'listPlans' | 'readPlan' | 'approvePlan' | 'attachApproval' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly policyLedger: Pick<TrustPlanePolicyLedgerService, 'append' | 'summarize'>;
  private readonly providerAdapters: Partial<Record<HardwareProviderId, HardwareProviderAdapter>>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: HardwareRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.stateFile = String(
      runtime.stateFile
      || path.join(this.workspaceRoot, 'data', 'runtime', 'hardware-action-plane', 'hardware.json'),
    );
    this.env = runtime.env || process.env;
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.policyLedger = runtime.policyLedgerService || new TrustPlanePolicyLedgerService();
    this.providerAdapters = runtime.providerAdapters || {};
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public async buildSnapshot(input: { includeHidden?: boolean; limit?: number } = {}): Promise<HardwareActionPlaneSnapshot> {
    const limit = Math.max(1, Math.min(Number(input.limit || 12), 50));
    const state = this.readState();
    const providers = this.buildProviders();
    const devices = Object.values(state.devices)
      .map((entry) => this.toDeviceView(entry, providers))
      .filter((entry) => input.includeHidden === true || entry.visibility !== 'hidden')
      .sort((a, b) => a.id.localeCompare(b.id));
    const pendingPlans = this.listPendingHardwarePlans(limit);
    const automationGuards = Object.values(state.failureGuards)
      .sort((a, b) => String(b.lastFailureAt || '').localeCompare(String(a.lastFailureAt || '')));
    const visibleDevices = devices.filter((entry) => entry.visibility !== 'hidden').length;
    const readOnlyDevices = devices.filter((entry) => entry.mutationMode === 'read_only').length;
    const autoPausedAutomations = automationGuards.filter((entry) => entry.autoPaused).length;
    const emergencyStopActive = state.emergencyStop.active === true;
    const summary = {
      posture: this.resolvePosture({
        emergencyStopActive,
        pendingHardwarePlans: pendingPlans.length,
        autoPausedAutomations,
        devices,
      }),
      providers: providers.length,
      configuredProviders: providers.filter((entry) => entry.configured).length,
      devices: devices.length,
      visibleDevices,
      allowlistedDevices: devices.filter((entry) => entry.allowlisted).length,
      readOnlyDevices,
      hiddenDevices: Object.values(state.devices).filter((entry) => entry.visibility === 'hidden').length,
      pendingHardwarePlans: pendingPlans.length,
      emergencyStopActive,
      autoPausedAutomations,
      heavyRuntimesStarted: false as const,
    };
    const actions = this.buildSuggestedActions(summary, devices, providers);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      policy: {
        actionFlow: ['preview', 'approval', 'apply', 'verify', 'audit'],
        providersStartOnRead: false,
        allowlistRequiredForMutation: true,
        nonAllowlistedDefault: 'read-only',
        emergencyStopBlocksPhysicalActions: true,
        physicalAutomationsAutoPauseAfterFailures: true,
        trustPlaneDomain: 'hardware',
        watchModeVerification: 'optional-after-approval',
        federatedMeshDelegation: 'node-host-provider',
      },
      providers,
      devices,
      emergencyStop: { ...state.emergencyStop },
      automationGuards,
      pendingPlans,
      audit: state.audit.slice(0, limit),
      actions,
      narrative: {
        headline: 'Hardware Awareness, IoT e Domotica',
        operatorSummary:
          `${summary.providers} provider(s), ${summary.devices} device(s), ${summary.allowlistedDevices} allowlisted, `
          + `${summary.pendingHardwarePlans} plano(s) fisico(s) pendente(s), emergency stop=${summary.emergencyStopActive ? 'ativo' : 'inativo'}, `
          + `runtime pesado iniciado=${summary.heavyRuntimesStarted ? 'sim' : 'nao'}.`,
        nextAction: actions[0]?.label || 'Registrar devices explicitamente antes de permitir qualquer mutacao fisica.',
      },
    };
  }

  public registerDevice(input: Partial<HardwareDeviceRecord> & {
    id: string;
    providerId: HardwareProviderId;
    requestedBy?: string | null;
  }): HardwareDeviceRecord {
    const state = this.readState();
    const id = this.normalizeId(input.id, 'device');
    const providerId = this.normalizeProviderId(input.providerId);
    const allowlisted = input.allowlisted === true;
    const device: HardwareDeviceRecord = {
      id,
      label: this.cleanText(input.label, id),
      providerId,
      externalId: this.nullableText(input.externalId),
      type: this.normalizeDeviceType(input.type),
      location: this.nullableText(input.location),
      riskLevel: this.normalizeRisk(input.riskLevel),
      allowlisted,
      visibility: this.normalizeVisibility(input.visibility, allowlisted),
      allowedActions: this.normalizeActions(input.allowedActions, input.type),
      lastSeenAt: this.nullableText(input.lastSeenAt),
      notes: Array.isArray(input.notes) ? input.notes.map((entry) => this.cleanText(entry, '')).filter(Boolean) : [],
      metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    };
    state.devices[id] = device;
    this.appendAuditToState(state, {
      event: 'hardware.device.registered',
      status: allowlisted ? 'previewed' : 'noop',
      providerId,
      deviceId: id,
      action: 'register-device',
      requestedBy: input.requestedBy || null,
      planId: null,
      summary: allowlisted
        ? `Device ${id} registrado e allowlisted para acoes explicitas.`
        : `Device ${id} registrado em modo read-only ate allowlist explicita.`,
    });
    this.writeState(state);
    return device;
  }

  public async planAction(input: HardwarePlanActionInput): Promise<HardwarePlanActionResult> {
    const snapshot = await this.buildSnapshot({ includeHidden: true });
    const device = snapshot.devices.find((entry) => entry.id === this.normalizeId(input.deviceId, 'device')) || null;
    const action = this.normalizeAction(input.action);
    const blockers = this.resolveActionBlockers(device, action, snapshot);
    if (!device || blockers.length > 0) {
      this.appendAudit({
        event: 'hardware.action.blocked',
        status: 'blocked',
        providerId: device?.providerId || null,
        deviceId: device?.id || this.normalizeId(input.deviceId, 'device'),
        action,
        requestedBy: input.requestedBy || null,
        planId: null,
        summary: blockers[0] || 'Device nao encontrado.',
      });
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: blockers[0] || 'Device nao encontrado.',
        blockers,
        device,
        mutationPlan: null,
        trustDecision: null,
        snapshot: await this.buildSnapshot(),
      };
    }

    const actionRisk = this.resolveActionRisk(device, action);
    const approvalRequired = input.approvalRequired ?? !READ_ONLY_ACTIONS.has(action);
    const payload = this.normalizePayload(input.payload);
    const readinessGates = this.buildReadinessGates(device, action, snapshot);
    const plan = this.mutationPlane.createPlan({
      domain: 'hardware',
      actionId: 'physical-device-action',
      title: `Hardware: ${action} em ${device.label}`,
      summary: `Preview de acao fisica ${action} no device ${device.id}.`,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'hardware-action-plane',
      riskLevel: actionRisk,
      approvalRequired,
      approvalReason: approvalRequired
        ? 'Acao fisica exige approval antes de afetar hardware real.'
        : 'Leitura ou acao read-only sem efeito fisico mutavel.',
      resourceImpact: {
        ramMb: 32,
        diskMb: 1,
        processCount: 0,
        externalExposure: device.providerId === 'mqtt' || device.providerId === 'home-assistant' ? 'local' : 'none',
        recurring: false,
        notes: [
          `provider=${device.providerId}`,
          `device=${device.id}`,
          `action=${action}`,
          'providers nao sao conectados durante preview',
        ],
      },
      readinessGates,
      validationPlan: [
        'Confirmar allowlist do device.',
        'Confirmar que emergency stop esta inativo.',
        'Aplicar somente apos approval canonico.',
        'Verificar resultado por provider ou Watch Mode quando disponivel.',
      ],
      rollbackPlan: [
        'Usar emergency stop para bloquear novas acoes fisicas.',
        'Executar acao inversa somente se estiver allowlisted e aprovada.',
        'Registrar auditoria do resultado.',
      ],
      payload: {
        providerId: device.providerId,
        deviceId: device.id,
        externalId: device.externalId,
        action,
        payload,
        riskLevel: actionRisk,
        actionFlow: ['preview', 'approval', 'apply', 'verify', 'audit'],
      },
      ttlMs: 6 * 60 * 60 * 1000,
    });
    const trustDecision = await this.trustDecision.evaluate({
      domain: 'hardware',
      actionId: 'physical-device-action',
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'hardware-action-plane',
      riskLevel: actionRisk,
      approvalRequired,
      capabilityId: `hardware.${device.providerId}`,
      reason: 'Hardware Action Plane exige policy unificada antes de qualquer efeito fisico.',
      payload: {
        deviceId: device.id,
        providerId: device.providerId,
        action,
      },
      resourceImpact: plan.resourceImpact,
      approvalScope: input.approvalScope || (actionRisk === 'low' ? 'session' : 'once'),
    });
    const linkedPlan = trustDecision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: trustDecision.permission.permission_id,
        status: trustDecision.decision === 'requires_approval' ? 'pending' : 'approved',
        reason: trustDecision.reason,
      })
      : plan;
    if (trustDecision.decision === 'blocked') {
      this.mutationPlane.markBlocked(linkedPlan.id, trustDecision.reason);
    }
    this.appendLedger({
      status: trustDecision.decision === 'blocked' ? 'blocked' : 'previewed',
      providerId: device.providerId,
      deviceId: device.id,
      action,
      requestedBy: input.requestedBy || null,
      planId: linkedPlan.id,
      riskLevel: actionRisk,
      summary: trustDecision.reason,
    });
    this.appendAudit({
      event: 'hardware.action.previewed',
      status: trustDecision.decision === 'blocked' ? 'blocked' : 'previewed',
      providerId: device.providerId,
      deviceId: device.id,
      action,
      requestedBy: input.requestedBy || null,
      planId: linkedPlan.id,
      summary: trustDecision.reason,
    });

    return {
      generatedAt: this.now().toISOString(),
      status: trustDecision.decision === 'blocked'
        ? 'blocked'
        : linkedPlan.status === 'waiting_approval'
          ? 'waiting_approval'
          : 'draft',
      ok: trustDecision.decision !== 'blocked',
      summary: trustDecision.reason,
      blockers: trustDecision.decision === 'blocked' ? [trustDecision.reason] : [],
      device,
      mutationPlan: trustDecision.decision === 'blocked'
        ? this.mutationPlane.readPlan(linkedPlan.id) || linkedPlan
        : linkedPlan,
      trustDecision,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async approvePlan(input: {
    planId: string;
    approvedBy?: string | null;
    scope?: 'once' | 'session' | 'host' | null;
  }): Promise<ZavorthMutationPlan> {
    return this.mutationPlane.approvePlan(input.planId, {
      approvedBy: input.approvedBy || null,
      scope: input.scope || 'once',
    });
  }

  public async applyPlan(input: {
    planId: string;
    requestedBy?: string | null;
    dryRun?: boolean;
  }): Promise<HardwareApplyPlanResult> {
    const plan = this.mutationPlane.readPlan(input.planId);
    const snapshot = await this.buildSnapshot({ includeHidden: true });
    if (!plan || plan.domain !== 'hardware') {
      return this.blockedApply('MutationPlan de hardware nao encontrado.', null, null, snapshot, null);
    }
    const payload = plan.payload || {};
    const deviceId = this.normalizeId(String(payload.deviceId || ''), 'device');
    const action = this.normalizeAction(String(payload.action || ''));
    const device = snapshot.devices.find((entry) => entry.id === deviceId) || null;
    const blockers = [
      ...this.resolveActionBlockers(device, action, snapshot),
      ...(plan.status === 'waiting_approval' ? ['Plano ainda aguarda approval.'] : []),
      ...(plan.status === 'blocked' ? ['Plano ja esta bloqueado.'] : []),
      ...(plan.status === 'expired' ? ['Plano expirou antes do apply.'] : []),
    ];
    if (!device || blockers.length > 0) {
      this.mutationPlane.markBlocked(plan.id, blockers[0] || 'Apply bloqueado.');
      this.appendAudit({
        event: 'hardware.action.apply-blocked',
        status: 'blocked',
        providerId: device?.providerId || null,
        deviceId: device?.id || deviceId,
        action,
        requestedBy: input.requestedBy || null,
        planId: plan.id,
        summary: blockers[0] || 'Apply bloqueado.',
      });
      return this.blockedApply(blockers[0] || 'Apply bloqueado.', device, plan, await this.buildSnapshot(), null, blockers);
    }
    if (input.dryRun === true) {
      const evidence = {
        ok: true,
        status: 'applied' as const,
        summary: 'Dry-run de apply fisico: nenhuma chamada de provider foi executada.',
        data: { dryRun: true },
      };
      this.appendAudit({
        event: 'hardware.action.apply-dry-run',
        status: 'noop',
        providerId: device.providerId,
        deviceId: device.id,
        action,
        requestedBy: input.requestedBy || null,
        planId: plan.id,
        summary: evidence.summary,
      });
      return {
        generatedAt: this.now().toISOString(),
        status: 'dry_run',
        ok: true,
        summary: evidence.summary,
        blockers: [],
        device,
        mutationPlan: plan,
        evidence,
        snapshot: await this.buildSnapshot(),
      };
    }

    const provider = snapshot.providers.find((entry) => entry.id === device.providerId) || null;
    const adapter = provider ? this.resolveAdapter(provider.id) : null;
    if (!provider || !adapter) {
      const summary = `Provider ${device.providerId} nao tem executor ativo neste runtime.`;
      this.mutationPlane.markBlocked(plan.id, summary);
      this.appendAudit({
        event: 'hardware.action.apply-blocked',
        status: 'blocked',
        providerId: device.providerId,
        deviceId: device.id,
        action,
        requestedBy: input.requestedBy || null,
        planId: plan.id,
        summary,
      });
      return this.blockedApply(summary, device, plan, await this.buildSnapshot(), null, [summary]);
    }

    const evidence = await adapter.execute({
      provider,
      device,
      action,
      payload: this.normalizePayload(payload.payload),
      requestedBy: input.requestedBy || null,
    });
    const verifyEvidence = evidence.ok && adapter.verify
      ? await adapter.verify({
        provider,
        device,
        action,
        payload: this.normalizePayload(payload.payload),
      })
      : null;
    const finalEvidence = verifyEvidence || evidence;
    const status: HardwareApplyStatus = finalEvidence.ok
      ? finalEvidence.verified || finalEvidence.status === 'verified' ? 'verified' : 'applied'
      : finalEvidence.status === 'blocked' ? 'blocked' : 'failed';
    if (finalEvidence.ok) {
      this.mutationPlane.markApplied(plan.id, finalEvidence.summary, [action]);
    } else {
      this.mutationPlane.markBlocked(plan.id, finalEvidence.summary);
    }
    this.appendLedger({
      status: finalEvidence.ok ? 'applied' : 'blocked',
      providerId: device.providerId,
      deviceId: device.id,
      action,
      requestedBy: input.requestedBy || null,
      planId: plan.id,
      riskLevel: this.resolveActionRisk(device, action),
      summary: finalEvidence.summary,
    });
    this.appendAudit({
      event: 'hardware.action.applied',
      status: finalEvidence.ok ? (status === 'verified' ? 'verified' : 'applied') : 'blocked',
      providerId: device.providerId,
      deviceId: device.id,
      action,
      requestedBy: input.requestedBy || null,
      planId: plan.id,
      summary: finalEvidence.summary,
    });
    return {
      generatedAt: this.now().toISOString(),
      status,
      ok: finalEvidence.ok,
      summary: finalEvidence.summary,
      blockers: finalEvidence.ok ? [] : [finalEvidence.summary],
      device,
      mutationPlan: this.mutationPlane.readPlan(plan.id) || plan,
      evidence: finalEvidence,
      snapshot: await this.buildSnapshot(),
    };
  }

  public activateEmergencyStop(input: {
    reason?: string | null;
    requestedBy?: string | null;
  } = {}): HardwareEmergencyStop {
    const state = this.readState();
    state.emergencyStop = {
      active: true,
      reason: this.cleanText(input.reason, 'Emergency stop manual ativado.'),
      activatedAt: this.now().toISOString(),
      activatedBy: this.nullableText(input.requestedBy),
      clearedAt: null,
      clearedBy: null,
    };
    this.appendAuditToState(state, {
      event: 'hardware.emergency-stop.activated',
      status: 'emergency_stop',
      providerId: null,
      deviceId: null,
      action: 'emergency-stop',
      requestedBy: input.requestedBy || null,
      planId: null,
      summary: state.emergencyStop.reason || 'Emergency stop ativado.',
    });
    this.writeState(state);
    return { ...state.emergencyStop };
  }

  public clearEmergencyStop(input: {
    requestedBy?: string | null;
    reason?: string | null;
  } = {}): HardwareEmergencyStop {
    const state = this.readState();
    state.emergencyStop = {
      ...state.emergencyStop,
      active: false,
      clearedAt: this.now().toISOString(),
      clearedBy: this.nullableText(input.requestedBy),
      reason: this.cleanText(input.reason, state.emergencyStop.reason || 'Emergency stop limpo.'),
    };
    this.appendAuditToState(state, {
      event: 'hardware.emergency-stop.cleared',
      status: 'noop',
      providerId: null,
      deviceId: null,
      action: 'clear-emergency-stop',
      requestedBy: input.requestedBy || null,
      planId: null,
      summary: state.emergencyStop.reason || 'Emergency stop limpo.',
    });
    this.writeState(state);
    return { ...state.emergencyStop };
  }

  public recordAutomationFailure(input: {
    automationId: string;
    deviceId?: string | null;
    reason?: string | null;
    threshold?: number | null;
  }): HardwareAutomationFailureGuard {
    const state = this.readState();
    const automationId = this.normalizeId(input.automationId, 'automation');
    const threshold = Math.max(1, Math.min(Number(input.threshold || 3), 10));
    const previous = state.failureGuards[automationId] || {
      automationId,
      deviceId: this.nullableText(input.deviceId),
      failures: 0,
      threshold,
      lastFailureAt: null,
      autoPaused: false,
      pausedAt: null,
      reason: null,
    };
    const failures = previous.failures + 1;
    const autoPaused = previous.autoPaused || failures >= threshold;
    const guard: HardwareAutomationFailureGuard = {
      automationId,
      deviceId: this.nullableText(input.deviceId) || previous.deviceId,
      failures,
      threshold,
      lastFailureAt: this.now().toISOString(),
      autoPaused,
      pausedAt: autoPaused ? previous.pausedAt || this.now().toISOString() : null,
      reason: this.cleanText(input.reason, previous.reason || 'Falha de automacao fisica.'),
    };
    state.failureGuards[automationId] = guard;
    this.appendAuditToState(state, {
      event: autoPaused ? 'hardware.automation.auto-paused' : 'hardware.automation.failure',
      status: autoPaused ? 'auto_paused' : 'blocked',
      providerId: null,
      deviceId: guard.deviceId,
      action: 'automation-failure',
      requestedBy: null,
      planId: null,
      summary: autoPaused
        ? `Automacao ${automationId} pausada apos ${failures} falha(s).`
        : `Falha ${failures}/${threshold} registrada para automacao ${automationId}.`,
    });
    this.writeState(state);
    return guard;
  }

  private buildProviders(): HardwareProviderView[] {
    return PROVIDERS.map((entry) => {
      const configured = this.isProviderConfigured(entry.id);
      const blocked = this.isProviderBlocked(entry.id);
      const status: HardwareProviderStatus = blocked ? 'blocked' : configured ? 'configured' : 'dormant';
      const blockers = blocked
        ? [`Provider ${entry.id} bloqueado por policy/env.`]
        : configured ? [] : [`Provider ${entry.id} esta dormente; configure credenciais/endpoint antes de apply real.`];
      return {
        ...entry,
        status,
        configured,
        startsOnRead: false as const,
        summary: configured
          ? `${entry.label} configurado para apply sob approval; leitura de status nao conecta.`
          : `${entry.label} dormente; disponivel como provider de plano sem boot automatico.`,
        blockers,
      };
    });
  }

  private isProviderConfigured(providerId: HardwareProviderId): boolean {
    if (providerId === 'home-assistant') {
      return Boolean(this.cleanText(this.env.HOME_ASSISTANT_URL, '') && this.cleanText(this.env.HOME_ASSISTANT_TOKEN, ''));
    }
    if (providerId === 'mqtt') {
      return Boolean(this.cleanText(this.env.ZAVORTH_MQTT_BROKER || this.env.MQTT_BROKER, ''));
    }
    if (providerId === 'webhook') {
      return Boolean(this.cleanText(this.env.ZAVORTH_HARDWARE_WEBHOOK_ALLOWLIST, ''));
    }
    if (providerId === 'node-host') {
      return this.cleanText(this.env.ZAVORTH_NODE_MESH_ENABLED, '').toLowerCase() === 'true';
    }
    return false;
  }

  private isProviderBlocked(providerId: HardwareProviderId): boolean {
    const value = this.cleanText(this.env[`ZAVORTH_HARDWARE_${providerId.replace(/-/g, '_').toUpperCase()}_DISABLED`], '');
    return value === '1' || value.toLowerCase() === 'true';
  }

  private toDeviceView(device: HardwareDeviceRecord, providers: HardwareProviderView[]): HardwareDeviceView {
    const provider = providers.find((entry) => entry.id === device.providerId);
    const mutationMode: HardwareDeviceView['mutationMode'] = device.visibility === 'hidden'
      ? 'hidden'
      : device.allowlisted ? 'mutable' : 'read_only';
    const blockers = [
      ...(device.allowlisted ? [] : ['Device nao allowlisted; mutacao bloqueada.']),
      ...(device.visibility === 'hidden' ? ['Device oculto para mutacao e snapshot default.'] : []),
      ...(provider?.status === 'blocked' ? [`Provider ${device.providerId} bloqueado.`] : []),
    ];
    return {
      ...device,
      mutationMode,
      providerStatus: provider?.status || 'dormant',
      operatorSummary: `${device.label} (${device.type}) em ${device.location || 'local n/d'} via ${device.providerId}; modo=${mutationMode}.`,
      blockers,
    };
  }

  private resolveActionBlockers(
    device: HardwareDeviceView | null,
    action: string,
    snapshot: HardwareActionPlaneSnapshot,
  ): string[] {
    if (!device) {
      return ['Device fisico nao encontrado.'];
    }
    const blockers = [];
    if (snapshot.emergencyStop.active) {
      blockers.push(`Emergency stop ativo: ${snapshot.emergencyStop.reason || 'acoes fisicas bloqueadas'}.`);
    }
    if (device.visibility === 'hidden') {
      blockers.push('Device esta oculto e nao aceita mutacao.');
    }
    if (!device.allowlisted && !READ_ONLY_ACTIONS.has(action)) {
      blockers.push('Device nao allowlisted fica read-only para mutacoes fisicas.');
    }
    if (!device.allowedActions.includes(action) && !READ_ONLY_ACTIONS.has(action)) {
      blockers.push(`Acao ${action} nao esta na allowlist do device.`);
    }
    if (device.providerStatus === 'blocked') {
      blockers.push(`Provider ${device.providerId} esta bloqueado.`);
    }
    return blockers;
  }

  private buildReadinessGates(
    device: HardwareDeviceView,
    action: string,
    snapshot: HardwareActionPlaneSnapshot,
  ): ZavorthReadinessGate[] {
    const allowed = device.allowedActions.includes(action) || READ_ONLY_ACTIONS.has(action);
    return [
      {
        id: 'hardware-device-allowlisted',
        status: device.allowlisted || READ_ONLY_ACTIONS.has(action) ? 'passed' : 'blocked',
        canProceed: device.allowlisted || READ_ONLY_ACTIONS.has(action),
        scope: device.id,
        reasons: [
          device.allowlisted
            ? 'Device tem allowlist explicita.'
            : 'Device read-only; somente leitura permitida.',
        ],
        warnings: [],
        blockers: device.allowlisted || READ_ONLY_ACTIONS.has(action) ? [] : ['Device sem allowlist para mutacao fisica.'],
        checkedAt: this.now().toISOString(),
      },
      {
        id: 'hardware-action-allowed',
        status: allowed ? 'passed' : 'blocked',
        canProceed: allowed,
        scope: `${device.id}:${action}`,
        reasons: [allowed ? 'Acao consta na allowlist.' : `Acao ${action} nao permitida para o device.`],
        warnings: [],
        blockers: allowed ? [] : [`Acao ${action} nao permitida para o device.`],
        checkedAt: this.now().toISOString(),
      },
      {
        id: 'hardware-emergency-stop',
        status: snapshot.emergencyStop.active ? 'blocked' : 'passed',
        canProceed: !snapshot.emergencyStop.active,
        scope: 'hardware-action-plane',
        reasons: [snapshot.emergencyStop.active ? 'Emergency stop ativo bloqueia efeitos fisicos.' : 'Emergency stop inativo.'],
        warnings: [],
        blockers: snapshot.emergencyStop.active ? ['Emergency stop ativo.'] : [],
        checkedAt: this.now().toISOString(),
      },
      {
        id: 'hardware-provider-dormant-on-preview',
        status: 'passed',
        canProceed: true,
        scope: device.providerId,
        reasons: ['Preview nao conecta provider nem inicia runtime pesado.'],
        warnings: [],
        blockers: [],
        checkedAt: this.now().toISOString(),
      },
    ];
  }

  private resolveActionRisk(device: HardwareDeviceRecord, action: string): ZavorthMutationRiskLevel {
    const actionRisk: ZavorthMutationRiskLevel = HIGH_RISK_ACTIONS.has(action)
      ? 'high'
      : READ_ONLY_ACTIONS.has(action) ? 'low' : 'medium';
    return this.maxRisk(device.riskLevel, actionRisk);
  }

  private resolvePosture(input: {
    emergencyStopActive: boolean;
    pendingHardwarePlans: number;
    autoPausedAutomations: number;
    devices: HardwareDeviceView[];
  }): HardwareActionPlaneSnapshot['summary']['posture'] {
    if (input.emergencyStopActive) {
      return 'critical';
    }
    if (input.autoPausedAutomations > 0 || input.pendingHardwarePlans > 0) {
      return 'attention';
    }
    const highRiskMutable = input.devices.some((entry) => entry.allowlisted && (entry.riskLevel === 'high' || entry.riskLevel === 'critical'));
    return highRiskMutable ? 'attention' : 'healthy';
  }

  private buildSuggestedActions(
    summary: HardwareActionPlaneSnapshot['summary'],
    devices: HardwareDeviceView[],
    providers: HardwareProviderView[],
  ): HardwareActionPlaneSnapshot['actions'] {
    const actions: HardwareActionPlaneSnapshot['actions'] = [];
    if (summary.emergencyStopActive) {
      actions.push({
        id: 'review-emergency-stop',
        label: 'Revisar emergency stop antes de qualquer apply',
        command: 'npm run ops:hardware -- --json',
        severity: 'critical',
        reason: 'Emergency stop esta bloqueando novas acoes fisicas.',
      });
    }
    if (devices.length === 0) {
      actions.push({
        id: 'register-first-device',
        label: 'Registrar primeiro device em modo read-only',
        command: 'npm run ops:hardware -- --register-device --device light.sala --provider home-assistant --type light --actions turn_on,turn_off',
        severity: 'info',
        reason: 'Nenhum device fisico foi cadastrado no action plane.',
      });
    }
    const dormantProviders = providers.filter((entry) => entry.status === 'dormant').length;
    if (dormantProviders > 0) {
      actions.push({
        id: 'configure-provider-allowlist',
        label: 'Configurar provider somente quando for usar apply real',
        command: 'npm run ops:hardware',
        severity: 'warn',
        reason: `${dormantProviders} provider(s) dormente(s); isso e esperado em idle.`,
      });
    }
    if (summary.pendingHardwarePlans > 0) {
      actions.push({
        id: 'review-hardware-plans',
        label: 'Revisar planos fisicos pendentes',
        command: 'npm run ops:hardware:json',
        severity: 'warn',
        reason: 'Ha MutationPlans de hardware aguardando approval/aplicacao.',
      });
    }
    return actions.slice(0, 6);
  }

  private listPendingHardwarePlans(limit: number): ZavorthMutationPlan[] {
    try {
      return this.mutationPlane.listPlans({ limit: Math.max(limit, 20), includeExpired: false })
        .filter((entry) => entry.domain === 'hardware' && (entry.status === 'waiting_approval' || entry.status === 'approved' || entry.status === 'draft'))
        .slice(0, limit);
    } catch (error: unknown) {logger.warn('[Zavorth Hardware Action Plane] filesystem check failed', error); return []; }
  }

  private resolveAdapter(providerId: HardwareProviderId): HardwareProviderAdapter | null {
    if (this.providerAdapters[providerId]) {
      return this.providerAdapters[providerId] || null;
    }
    if (providerId === 'home-assistant') {
      return {
        execute: async ({ device, action, payload }) => {
          const result = await new HomeAssistantBridge().execute({
            entity_id: device.externalId || device.id,
            action: this.toHomeAssistantAction(action),
            attributes: payload,
          });
          return {
            ok: result.success === true,
            status: result.success === true ? 'applied' : 'failed',
            summary: this.cleanText(result.message, 'Home Assistant retornou sem resumo.'),
            data: result.data as Record<string, unknown> | null,
          };
        },
      };
    }
    if (providerId === 'mqtt') {
      return {
        execute: async ({ device, action, payload }) => {
          const payloadValue = payload.payload ?? payload.value ?? action;
          const result = await new MQTTPublisher().execute({
            broker: String(payload.broker || this.env.ZAVORTH_MQTT_BROKER || this.env.MQTT_BROKER || 'mqtt://localhost:1883'),
            topic: String(payload.topic || device.externalId || device.id),
            payload: typeof payloadValue === 'string' ? payloadValue : JSON.stringify(payloadValue),
            qos: Number(payload.qos || 0),
          });
          return {
            ok: result.success === true,
            status: result.success === true ? 'applied' : 'failed',
            summary: this.cleanText(result.message, 'MQTT retornou sem resumo.'),
            data: result.data as Record<string, unknown> | null,
          };
        },
      };
    }
    return null;
  }

  private blockedApply(
    summary: string,
    device: HardwareDeviceView | null,
    mutationPlan: ZavorthMutationPlan | null,
    snapshot: HardwareActionPlaneSnapshot,
    evidence: HardwareProviderActionEvidence | null,
    blockers: string[] = [summary],
  ): HardwareApplyPlanResult {
    return {
      generatedAt: this.now().toISOString(),
      status: 'blocked',
      ok: false,
      summary,
      blockers,
      device,
      mutationPlan,
      evidence,
      snapshot,
    };
  }

  private readState(): HardwareActionPlaneState {
    if (!this.existsSync(this.stateFile)) {
      return this.defaultState();
    }
    try {
      const parsed = JSON.parse(String(this.readFileSync(this.stateFile, 'utf8') || '{}')) as Partial<HardwareActionPlaneState>;
      return this.normalizeState(parsed);
    } catch (error: unknown) {logger.warn('[Zavorth Hardware Action Plane] JSON parse failed', error);
    return this.defaultState();
  }
  }

  private writeState(state: HardwareActionPlaneState): void {
    const normalized = this.normalizeState({
      ...state,
      updatedAt: this.now().toISOString(),
    });
    this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    this.writeFileSync(this.stateFile, JSON.stringify(normalized, null, 2), 'utf8');
  }

  private defaultState(): HardwareActionPlaneState {
    return {
      version: 1,
      updatedAt: null,
      emergencyStop: {
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        clearedAt: null,
        clearedBy: null,
      },
      devices: {},
      failureGuards: {},
      audit: [],
    };
  }

  private normalizeState(input: Partial<HardwareActionPlaneState>): HardwareActionPlaneState {
    const fallback = this.defaultState();
    const devices = Object.fromEntries(
      Object.values(input.devices || {})
        .map((entry) => this.normalizeDevice(entry))
        .filter((entry): entry is HardwareDeviceRecord => Boolean(entry))
        .map((entry) => [entry.id, entry]),
    );
    const failureGuards = Object.fromEntries(
      Object.values(input.failureGuards || {})
        .map((entry) => this.normalizeFailureGuard(entry))
        .filter((entry): entry is HardwareAutomationFailureGuard => Boolean(entry))
        .map((entry) => [entry.automationId, entry]),
    );
    return {
      version: 1,
      updatedAt: this.nullableText(input.updatedAt),
      emergencyStop: {
        ...fallback.emergencyStop,
        ...(input.emergencyStop || {}),
        active: input.emergencyStop?.active === true,
        reason: this.nullableText(input.emergencyStop?.reason),
        activatedAt: this.nullableText(input.emergencyStop?.activatedAt),
        activatedBy: this.nullableText(input.emergencyStop?.activatedBy),
        clearedAt: this.nullableText(input.emergencyStop?.clearedAt),
        clearedBy: this.nullableText(input.emergencyStop?.clearedBy),
      },
      devices,
      failureGuards,
      audit: Array.isArray(input.audit)
        ? input.audit.map((entry) => this.normalizeAudit(entry)).filter((entry): entry is HardwareAuditEntry => Boolean(entry)).slice(0, 200)
        : [],
    };
  }

  private normalizeDevice(entry: unknown): HardwareDeviceRecord | null {
    const raw = entry as Partial<HardwareDeviceRecord>;
    const id = this.normalizeId(raw?.id, '');
    if (!id) {
      return null;
    }
    const allowlisted = raw.allowlisted === true;
    return {
      id,
      label: this.cleanText(raw.label, id),
      providerId: this.normalizeProviderId(raw.providerId),
      externalId: this.nullableText(raw.externalId),
      type: this.normalizeDeviceType(raw.type),
      location: this.nullableText(raw.location),
      riskLevel: this.normalizeRisk(raw.riskLevel),
      allowlisted,
      visibility: this.normalizeVisibility(raw.visibility, allowlisted),
      allowedActions: this.normalizeActions(raw.allowedActions, raw.type),
      lastSeenAt: this.nullableText(raw.lastSeenAt),
      notes: Array.isArray(raw.notes) ? raw.notes.map((note) => this.cleanText(note, '')).filter(Boolean).slice(0, 12) : [],
      metadata: raw.metadata && typeof raw.metadata === 'object' ? { ...raw.metadata } : {},
    };
  }

  private normalizeFailureGuard(entry: unknown): HardwareAutomationFailureGuard | null {
    const raw = entry as Partial<HardwareAutomationFailureGuard>;
    const automationId = this.normalizeId(raw?.automationId, '');
    if (!automationId) {
      return null;
    }
    const threshold = Math.max(1, Math.min(Number(raw.threshold || 3), 10));
    const failures = Math.max(0, Math.floor(Number(raw.failures || 0)));
    return {
      automationId,
      deviceId: this.nullableText(raw.deviceId),
      failures,
      threshold,
      lastFailureAt: this.nullableText(raw.lastFailureAt),
      autoPaused: raw.autoPaused === true || failures >= threshold,
      pausedAt: this.nullableText(raw.pausedAt),
      reason: this.nullableText(raw.reason),
    };
  }

  private normalizeAudit(entry: unknown): HardwareAuditEntry | null {
    const raw = entry as Partial<HardwareAuditEntry>;
    const event = this.cleanText(raw?.event, '');
    if (!event) {
      return null;
    }
    return {
      id: this.cleanText(raw.id, this.buildAuditId(event)),
      at: this.cleanText(raw.at, this.now().toISOString()),
      event,
      status: this.normalizeAuditStatus(raw.status),
      providerId: raw.providerId ? this.normalizeProviderId(raw.providerId) : null,
      deviceId: this.nullableText(raw.deviceId),
      action: this.nullableText(raw.action),
      requestedBy: this.nullableText(raw.requestedBy),
      planId: this.nullableText(raw.planId),
      summary: this.cleanText(raw.summary, event),
    };
  }

  private appendAudit(input: Omit<HardwareAuditEntry, 'id' | 'at'>): HardwareAuditEntry {
    const state = this.readState();
    const entry = this.appendAuditToState(state, input);
    this.writeState(state);
    return entry;
  }

  private appendAuditToState(state: HardwareActionPlaneState, input: Omit<HardwareAuditEntry, 'id' | 'at'>): HardwareAuditEntry {
    const entry: HardwareAuditEntry = {
      id: this.buildAuditId(input.event),
      at: this.now().toISOString(),
      event: this.cleanText(input.event, 'hardware.event'),
      status: this.normalizeAuditStatus(input.status),
      providerId: input.providerId ? this.normalizeProviderId(input.providerId) : null,
      deviceId: this.nullableText(input.deviceId),
      action: this.nullableText(input.action),
      requestedBy: this.nullableText(input.requestedBy),
      planId: this.nullableText(input.planId),
      summary: this.cleanText(input.summary, input.event),
    };
    state.audit = [entry, ...state.audit].slice(0, 200);
    return entry;
  }

  private appendLedger(input: {
    status: 'previewed' | 'applied' | 'blocked';
    providerId: HardwareProviderId;
    deviceId: string;
    action: string;
    requestedBy: string | null;
    planId: string | null;
    riskLevel: ZavorthMutationRiskLevel;
    summary: string;
  }): void {
    try {
      this.policyLedger.append({
        domain: 'hardware',
        actionId: input.action,
        requestedBy: input.requestedBy,
        sourceSurface: 'hardware-action-plane',
        status: input.status,
        riskLevel: input.riskLevel,
        approvalScope: input.riskLevel === 'low' ? 'session' : 'once',
        planId: input.planId,
        permissionId: null,
        summary: input.summary,
        diff: [
          {
            path: `hardware.devices.${input.deviceId}`,
            before: 'preview',
            after: input.status,
            summary: `${input.providerId}:${input.action}`,
            riskLevel: input.riskLevel,
            reversible: false,
          },
        ],
        rollback: {
          available: false,
          reason: 'Rollback fisico depende de acao inversa allowlisted e novo approval.',
        },
        result: input.summary,
      });
    } catch (error: unknown) {// O ledger nao deve impedir emergency stop ou bloqueio local.
      logger.warn('[Zavorth Hardware Action Plane] operation failed', error);
    }
  }

  private normalizeProviderId(value: unknown): HardwareProviderId {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'home-assistant'
      || normalized === 'mqtt'
      || normalized === 'webhook'
      || normalized === 'serial'
      || normalized === 'hid'
      || normalized === 'node-host'
    ) {
      return normalized;
    }
    return 'webhook';
  }

  private normalizeDeviceType(value: unknown): HardwareDeviceType {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'light'
      || normalized === 'sensor'
      || normalized === 'switch'
      || normalized === 'climate'
      || normalized === 'lock'
      || normalized === 'cover'
      || normalized === 'media'
      || normalized === 'camera'
      || normalized === 'nas'
      || normalized === 'printer'
      || normalized === 'ups'
      || normalized === 'script'
      || normalized === 'generic'
    ) {
      return normalized;
    }
    return 'generic';
  }

  private normalizeVisibility(value: unknown, allowlisted: boolean): HardwareDeviceVisibility {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'visible' || normalized === 'read-only' || normalized === 'hidden') {
      return normalized;
    }
    return allowlisted ? 'visible' : 'read-only';
  }

  private normalizeActions(value: unknown, type: unknown): string[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string' ? value.split(',') : [];
    const actions = raw.map((entry) => this.normalizeAction(String(entry))).filter(Boolean);
    if (actions.length > 0) {
      return [...new Set(actions)].slice(0, 30);
    }
    const deviceType = this.normalizeDeviceType(type);
    if (deviceType === 'light' || deviceType === 'switch') {
      return ['turn_on', 'turn_off', 'toggle', 'read_state'];
    }
    if (deviceType === 'lock') {
      return ['lock', 'read_state'];
    }
    if (deviceType === 'sensor' || deviceType === 'ups' || deviceType === 'camera') {
      return ['read_state', 'device.info'];
    }
    return ['read_state'];
  }

  private normalizePayload(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...value as Record<string, unknown> }
      : {};
  }

  private normalizeRisk(value: unknown): ZavorthMutationRiskLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized;
    }
    return 'medium';
  }

  private maxRisk(a: ZavorthMutationRiskLevel, b: ZavorthMutationRiskLevel): ZavorthMutationRiskLevel {
    const rank: Record<ZavorthMutationRiskLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return rank[a] >= rank[b] ? a : b;
  }

  private normalizeAuditStatus(value: unknown): HardwareAuditEntry['status'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'previewed'
      || normalized === 'applied'
      || normalized === 'blocked'
      || normalized === 'verified'
      || normalized === 'auto_paused'
      || normalized === 'emergency_stop'
      || normalized === 'noop'
    ) {
      return normalized;
    }
    return 'noop';
  }

  private normalizeAction(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'read_state';
  }

  private normalizeId(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
  }

  private cleanText(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  private nullableText(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private buildAuditId(event: string): string {
    const hash = crypto.createHash('sha1')
      .update(`${this.now().toISOString()}:${event}:${Math.random().toString(36)}`)
      .digest('hex')
      .slice(0, 12);
    return `hardware-audit-${hash}`;
  }

  private toHomeAssistantAction(action: string): string {
    const normalized = this.normalizeAction(action);
    if (normalized.includes('.')) {
      return normalized.split('.').pop() || normalized;
    }
    return normalized;
  }
}
