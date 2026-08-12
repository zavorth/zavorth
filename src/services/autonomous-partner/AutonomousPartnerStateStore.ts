import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { logger } from '../../logger.js';
import type {
  AutonomousMissionCheckpoint,
  AutonomousMissionRecord,
  AutonomousMissionUsage,
  AutonomousPartnerAuditEntry,
  AutonomousPartnerState,
} from '../../contracts/AutonomousEngineeringPartnerContract.js';
import {
  buildAuditId,
  cleanText,
  normalizeAutonomyLevel,
  normalizeCheckpointStatus,
  normalizeEvidenceKind,
  normalizeEvidenceStatus,
  normalizeId,
  normalizeList,
  normalizeMissionStatus,
  normalizeRisk,
  normalizeSuccessCriteria,
  nullableText,
  nonNegative,
} from './AutonomousPartnerUtils.js';

export type StateStoreRuntime = {
  stateFile: string;
  now: () => Date;
  buildMissionPolicy: (input: {
    objective: string;
    autonomyLevel: ReturnType<typeof normalizeAutonomyLevel>;
    riskLevel: ReturnType<typeof normalizeRisk>;
    mutable: unknown;
  }) => AutonomousMissionRecord['policy'];
  normalizeBudget: (
    budget: AutonomousMissionRecord['budget'] | undefined,
    level: AutonomousMissionRecord['autonomyLevel'],
    riskLevel: AutonomousMissionRecord['riskLevel'],
  ) => AutonomousMissionRecord['budget'];
};

export class AutonomousPartnerStateStore {
  private readonly now: () => Date;
  private readonly stateFile: string;
  private readonly buildMissionPolicy: StateStoreRuntime['buildMissionPolicy'];
  private readonly normalizeBudget: StateStoreRuntime['normalizeBudget'];

  constructor(runtime: StateStoreRuntime) {
    this.now = runtime.now;
    this.stateFile = runtime.stateFile;
    this.buildMissionPolicy = runtime.buildMissionPolicy;
    this.normalizeBudget = runtime.normalizeBudget;
  }

  readState(): AutonomousPartnerState {
    try {
      if (!fs.existsSync(this.stateFile)) {
        return this.defaultState();
      }
      return this.normalizeState(JSON.parse(fs.readFileSync(this.stateFile, 'utf8')));
    } catch (error: unknown) {
      logger.warn('[Zavorth Autonomous Engineering Partner] state read failed', error);
      return this.defaultState();
    }
  }

  writeMission(state: AutonomousPartnerState, mission: AutonomousMissionRecord, summary: string): void {
    const normalized = this.normalizeMission(mission);
    if (!normalized) {
      throw new Error(`Mission invalid: ${mission.id || 'n/d'}.`);
    }
    state.missions[mission.id] = normalized;
    state.audit = [
      this.buildAudit({
        missionId: mission.id,
        event: 'mission.updated',
        status: mission.status,
        requestedBy: mission.requestedBy,
        summary,
      }),
      ...state.audit,
    ].slice(0, 200);
    this.writeState(state);
  }

  upsertMission(mission: AutonomousMissionRecord, summary: string): void {
    const state = this.readState();
    this.writeMission(state, mission, summary);
  }

  writeState(state: AutonomousPartnerState): void {
    const normalized = this.normalizeState({
      ...state,
      updatedAt: this.now().toISOString(),
    });
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(normalized, null, 2), 'utf8');
  }

  normalizeMission(entry: unknown): AutonomousMissionRecord | null {
    const raw = entry as Partial<AutonomousMissionRecord>;
    const id = normalizeId(raw?.id);
    const objective = cleanText(raw?.objective, '');
    if (!id || !objective) {
      return null;
    }
    const autonomyLevel = normalizeAutonomyLevel(raw.autonomyLevel);
    const riskLevel = normalizeRisk(raw.riskLevel);
    const createdAt = cleanText(raw.createdAt, this.now().toISOString());
    return {
      id,
      objective,
      context: nullableText(raw.context),
      autonomyLevel,
      riskLevel,
      status: normalizeMissionStatus(raw.status),
      createdAt,
      updatedAt: cleanText(raw.updatedAt, createdAt),
      requestedBy: nullableText(raw.requestedBy),
      sourceSurface: nullableText(raw.sourceSurface),
      successCriteria: normalizeSuccessCriteria(raw.successCriteria),
      budget: this.normalizeBudget(raw.budget, autonomyLevel, riskLevel),
      usage: this.normalizeUsage(raw.usage),
      policy:
        raw.policy ||
        this.buildMissionPolicy({
          objective,
          autonomyLevel,
          riskLevel,
          mutable: null,
        }),
      plan: normalizeList(raw.plan),
      checkpoints: Array.isArray(raw.checkpoints)
        ? raw.checkpoints
            .map((item) => this.normalizeCheckpoint(item))
            .filter((item): item is AutonomousMissionCheckpoint => Boolean(item))
        : [],
      evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(0, 100) : [],
      mutationPlanId: nullableText(raw.mutationPlanId),
      trustDecision: raw.trustDecision || null,
      pauseReason: nullableText(raw.pauseReason),
      result: raw.result || null,
    };
  }

  private normalizeUsage(raw: Partial<AutonomousMissionUsage> | undefined): AutonomousMissionUsage {
    return {
      actions: nonNegative(raw?.actions),
      mutableActions: nonNegative(raw?.mutableActions),
      cost: nonNegative(raw?.cost),
      durationMs: nonNegative(raw?.durationMs),
      networkCalls: nonNegative(raw?.networkCalls),
      filesystemWrites: nonNegative(raw?.filesystemWrites),
      externalDeliveries: nonNegative(raw?.externalDeliveries),
      failures: nonNegative(raw?.failures),
    };
  }

  private normalizeCheckpoint(entry: unknown): AutonomousMissionCheckpoint | null {
    const raw = entry as Partial<AutonomousMissionCheckpoint>;
    const id = normalizeId(raw?.id);
    if (!id) {
      return null;
    }
    return {
      id,
      label: cleanText(raw.label, id),
      plane: cleanText(raw.plane, 'autonomous-partner'),
      status: normalizeCheckpointStatus(raw.status),
      required: raw.required === true,
      summary: cleanText(raw.summary, id),
      sourceRef: nullableText(raw.sourceRef),
      command: nullableText(raw.command),
      evidenceRefs: normalizeList(raw.evidenceRefs),
    };
  }

  private normalizeAudit(entry: unknown): AutonomousPartnerAuditEntry | null {
    const raw = entry as Partial<AutonomousPartnerAuditEntry>;
    const event = cleanText(raw?.event, '');
    if (!event) {
      return null;
    }
    return {
      id: cleanText(raw.id, buildAuditId(event, this.now)),
      at: cleanText(raw.at, this.now().toISOString()),
      missionId: nullableText(raw.missionId),
      event,
      status: raw.status === 'noop' ? 'noop' : normalizeMissionStatus(raw.status),
      requestedBy: nullableText(raw.requestedBy),
      summary: cleanText(raw.summary, event),
    };
  }

  private buildAudit(input: Omit<AutonomousPartnerAuditEntry, 'id' | 'at'>): AutonomousPartnerAuditEntry {
    return {
      id: buildAuditId(input.event, this.now),
      at: this.now().toISOString(),
      missionId: nullableText(input.missionId),
      event: cleanText(input.event, 'mission.event'),
      status: input.status,
      requestedBy: nullableText(input.requestedBy),
      summary: cleanText(input.summary, input.event),
    };
  }

  defaultState(): AutonomousPartnerState {
    return {
      version: 1,
      updatedAt: null,
      missions: {},
      audit: [],
    };
  }

  private normalizeState(input: Partial<AutonomousPartnerState>): AutonomousPartnerState {
    const missions = Object.fromEntries(
      Object.values(input.missions || {})
        .map((entry) => this.normalizeMission(entry))
        .filter((entry): entry is AutonomousMissionRecord => Boolean(entry))
        .map((entry) => [entry.id, entry]),
    );
    return {
      version: 1,
      updatedAt: nullableText(input.updatedAt),
      missions,
      audit: Array.isArray(input.audit)
        ? input.audit
            .map((entry) => this.normalizeAudit(entry))
            .filter((entry): entry is AutonomousPartnerAuditEntry => Boolean(entry))
            .slice(0, 200)
        : [],
    };
  }
}
