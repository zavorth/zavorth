import { SecureStorageService } from './SecureStorageService.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  InstalledIntegrationState,
  IntegrationCapability,
  IntegrationDraftAnswerMap,
  IntegrationHubState,
  IntegrationInstallDraft,
  IntegrationInstallMode,
  IntegrationManifest,
  IntegrationQuestion,
  IntegrationRequirement,
  IntegrationResolution,
  IntegrationSecretsState,
} from '../contracts/IntegrationHubContract.js';

import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { logger } from '../logger.js';

type InstallerRuntime = {
  now?: () => Date;
  stateFile?: string;
  secretsFile?: string;
  registryService?: IntegrationRegistryService;
  secureStorageService?: SecureStorageService;
};

type BuildDraftInput = {
  requestedId: string;
  requestedBy?: string | null;
  nickname?: string | null;
  selectedMode?: string | null;
  enabledCapabilities?: string[] | null;
  answers?: IntegrationDraftAnswerMap | null;
  persist?: boolean;
};

export class IntegrationInstallerService {
  private readonly now: () => Date;
  private readonly stateFile: string;
  private readonly secretsFile: string;
  private readonly registryService: IntegrationRegistryService;
  private readonly secureStorageService: SecureStorageService;

  constructor(runtime: InstallerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile || config.integrationHubStateFile;
    this.secretsFile = runtime.secretsFile || config.integrationHubSecretsFile;
    this.registryService = runtime.registryService || new IntegrationRegistryService();
    this.secureStorageService = runtime.secureStorageService || new SecureStorageService();
  }

  public readState(): IntegrationHubState {
    return this.readJsonFile<IntegrationHubState>(this.stateFile, {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
  }

  public listInstalled(): InstalledIntegrationState[] {
    return Object.values(this.readState().entries).sort((left, right) => left.id.localeCompare(right.id, 'en-US'));
  }

  public getInstalled(integrationId: string | null | undefined): InstalledIntegrationState | null {
    const normalizedId = this.normalizeId(integrationId);
    if (!normalizedId) {
      return null;
    }

    return this.readState().entries[normalizedId] || null;
  }

  public buildDraft(input: BuildDraftInput): IntegrationInstallDraft {
    const resolution = this.registryService.resolveRequestedIntegration(input.requestedId);
    if (!resolution.manifest) {
      throw new Error('Could not resolve the requested integration.');
    }

    const manifest = resolution.manifest;
    const current = this.getInstalled(manifest.id);
    const selectedMode = this.resolveMode(manifest, input.selectedMode || current?.selectedMode || manifest.defaultMode);
    const enabledCapabilities = this.resolveCapabilities(
      manifest,
      input.enabledCapabilities || current?.enabledCapabilities || manifest.capabilities,
    );
    const secretIds = this.getSecretFieldIds(manifest);
    const submittedAnswers = input.answers || {};
    const publicAnswers = this.omitSecretAnswers(submittedAnswers, secretIds);
    const answers = this.mergeAnswers(current?.answers || {}, publicAnswers);
    const nextState = this.buildInstalledState({
      manifest,
      current,
      requestedBy: input.requestedBy ?? current?.requestedBy ?? null,
      nickname: input.nickname ?? current?.nickname ?? null,
      selectedMode,
      enabledCapabilities,
      answers,
      resolution,
    });

    if (input.persist !== false) {
      this.storeSecretAnswers(manifest, submittedAnswers);
      this.persistState(nextState);
    }

    const missingRequirements = this.getMissingRequirements(manifest, nextState);
    const unansweredQuestions = this.getUnansweredQuestions(manifest, nextState);

    return {
      resolution,
      manifest,
      installed: nextState,
      selectedMode,
      enabledCapabilities,
      missingRequirements,
      unansweredQuestions,
      nextAction: this.buildNextAction(manifest, missingRequirements, unansweredQuestions),
    };
  }

  public getStoredSecretKeys(integrationId: string | null | undefined): string[] {
    const normalizedId = this.normalizeId(integrationId);
    if (!normalizedId) {
      return [];
    }

    const secrets = this.readSecretsState();
    return Object.keys(secrets.entries[normalizedId] || {}).sort((left, right) => left.localeCompare(right, 'en-US'));
  }

  public getStoredSecretValue(
    integrationId: string | null | undefined,
    secretId: string | null | undefined,
  ): string | null {
    const normalizedIntegrationId = this.normalizeId(integrationId);
    const normalizedSecretId = String(secretId || '').trim();
    if (!normalizedIntegrationId || !normalizedSecretId) {
      return null;
    }

    const secrets = this.readSecretsState();
    const bucket = secrets.entries[normalizedIntegrationId] || {};
    const storedValue = bucket[normalizedSecretId];
    if (!storedValue) {
      return null;
    }

    return this.secureStorageService.decryptString(storedValue) || null;
  }

  public recordHealthStatus(
    integrationId: string | null | undefined,
    status: InstalledIntegrationState['lastHealthStatus'],
  ): InstalledIntegrationState | null {
    const normalizedId = this.normalizeId(integrationId);
    if (!normalizedId) {
      return null;
    }

    const state = this.readState();
    const current = state.entries[normalizedId];
    if (!current) {
      return null;
    }

    const nextEntry: InstalledIntegrationState = {
      ...current,
      status: this.resolveRecordedConnectionStatus(current.status, status),
      lastHealthCheckAt: this.now().toISOString(),
      lastHealthStatus: status,
      updatedAt: this.now().toISOString(),
    };
    state.entries[normalizedId] = nextEntry;
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.stateFile, state);
    return nextEntry;
  }

  public removeInstalled(
    integrationId: string | null | undefined,
    options: { removeSecrets?: boolean } = {},
  ): boolean {
    const normalizedId = this.normalizeId(integrationId);
    if (!normalizedId) {
      return false;
    }

    const state = this.readState();
    const existed = Boolean(state.entries[normalizedId]);
    if (!existed) {
      return false;
    }

    delete state.entries[normalizedId];
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.stateFile, state);

    if (options.removeSecrets) {
      const secrets = this.readSecretsState();
      if (secrets.entries[normalizedId]) {
        delete secrets.entries[normalizedId];
        secrets.updatedAt = this.now().toISOString();
        this.writeJsonFile(this.secretsFile, secrets);
      }
    }

    return true;
  }

  public getMissingRequirements(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
  ): IntegrationRequirement[] {
    const secretKeys = new Set(this.getStoredSecretKeys(manifest.id));
    const answers = installed?.answers || {};

    return manifest.requirements.filter((entry) => {
      if (!entry.required) {
        return false;
      }

      if (entry.secret && secretKeys.has(entry.id)) {
        return false;
      }

      if (entry.envKey && String(process.env[entry.envKey] || '').trim()) {
        return false;
      }

      const answerValue = answers[entry.id];
      if (typeof answerValue === 'string' && answerValue.trim()) {
        return false;
      }
      if (Array.isArray(answerValue) && answerValue.length > 0) {
        return false;
      }
      if (typeof answerValue === 'boolean') {
        return false;
      }

      return entry.type !== 'binary';
    });
  }

  public getUnansweredQuestions(
    manifest: IntegrationManifest,
    installed: InstalledIntegrationState | null,
  ): IntegrationQuestion[] {
    const answers = installed?.answers || {};
    const secretKeys = new Set(this.getStoredSecretKeys(manifest.id));
    return manifest.onboardingQuestions.filter((entry) => {
      if (!entry.required) {
        return false;
      }
      if (entry.type === 'secret' && secretKeys.has(entry.id)) {
        return false;
      }
      const current = answers[entry.id];
      if (typeof current === 'string') {
        return !current.trim();
      }
      if (Array.isArray(current)) {
        return current.length === 0;
      }
      if (typeof current === 'boolean') {
        return false;
      }
      return true;
    });
  }

  private persistState(entry: InstalledIntegrationState): void {
    const state = this.readState();
    state.entries[entry.id] = entry;
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.stateFile, state);
  }

  private buildInstalledState(input: {
    manifest: IntegrationManifest;
    current: InstalledIntegrationState | null;
    requestedBy: string | null;
    nickname: string | null;
    selectedMode: IntegrationInstallMode;
    enabledCapabilities: IntegrationCapability[];
    answers: IntegrationDraftAnswerMap;
    resolution: IntegrationResolution;
  }): InstalledIntegrationState {
    const createdAt = input.current?.createdAt || this.now().toISOString();
    const nextState: InstalledIntegrationState = {
      id: input.manifest.id,
      nickname: input.nickname || null,
      requestedBy: input.requestedBy || null,
      status: 'planned',
      selectedMode: input.selectedMode,
      enabledCapabilities: input.enabledCapabilities,
      answers: input.answers,
      createdAt,
      updatedAt: this.now().toISOString(),
      configuredAt: input.current?.configuredAt || null,
      lastHealthCheckAt: input.current?.lastHealthCheckAt || null,
      lastHealthStatus: input.current?.lastHealthStatus || 'unknown',
      notes: this.buildNotes(input.manifest, input.resolution),
    };

    const missingRequirements = this.getMissingRequirements(input.manifest, nextState);
    const unansweredQuestions = this.getUnansweredQuestions(input.manifest, nextState);
    if (missingRequirements.length === 0 && unansweredQuestions.length === 0) {
      nextState.status = 'configured';
      nextState.configuredAt = nextState.configuredAt || this.now().toISOString();
    }

    return nextState;
  }

  private getSecretFieldIds(manifest: IntegrationManifest): Set<string> {
    const secretIds = new Set<string>();
    for (const question of manifest.onboardingQuestions) {
      if (question.type === 'secret') {
        secretIds.add(question.id);
      }
    }
    for (const requirement of manifest.requirements) {
      if (requirement.secret) {
        secretIds.add(requirement.id);
      }
    }
    return secretIds;
  }

  private omitSecretAnswers(
    answers: IntegrationDraftAnswerMap,
    secretIds: Set<string>,
  ): IntegrationDraftAnswerMap {
    const sanitized: IntegrationDraftAnswerMap = {};
    for (const [key, value] of Object.entries(answers || {})) {
      if (secretIds.has(key)) {
        continue;
      }
      sanitized[key] = value;
    }
    return sanitized;
  }

  private buildNotes(manifest: IntegrationManifest, resolution: IntegrationResolution): string[] {
    const notes = [
      `Nivel de suporte: ${manifest.supportLevel}.`,
      `Binding current: ${manifest.binding.summary}`,
    ];

    if (resolution.note) {
      notes.push(resolution.note);
    }

    if (manifest.safetyNotes.length > 0) {
      notes.push(`Security: ${manifest.safetyNotes[0]}`);
    }

    return notes.slice(0, 4);
  }

  private buildNextAction(
    manifest: IntegrationManifest,
    missingRequirements: IntegrationRequirement[],
    unansweredQuestions: IntegrationQuestion[],
  ): IntegrationInstallDraft['nextAction'] {
    if (unansweredQuestions.length > 0) {
      return {
        label: 'Answer onboarding questions',
        command: `npm run integrations:show -- --id ${manifest.id}`,
        reason: 'Basic choices about mode, capabilities, or integration goal are still missing.',
      };
    }

    if (missingRequirements.length > 0) {
      const firstRequirement = missingRequirements[0];
      return {
        label: 'Close main requirement',
        command: `npm run integrations:doctor -- --id ${manifest.id}`,
        reason: `Still missing: ${firstRequirement.label}.`,
      };
    }

    return {
      label: 'Validate integration',
      command: `npm run integrations:doctor -- --id ${manifest.id}`,
      reason: 'The next step is to confirm that the binding is actually healthy.',
    };
  }

  private resolveRecordedConnectionStatus(
    currentStatus: InstalledIntegrationState['status'],
    lastHealthStatus: InstalledIntegrationState['lastHealthStatus'],
  ): InstalledIntegrationState['status'] {
    if (lastHealthStatus === 'ok') {
      return 'healthy';
    }

    if (currentStatus === 'healthy' || currentStatus === 'configured' || currentStatus === 'degraded') {
      return 'degraded';
    }

    return currentStatus;
  }

  private storeSecretAnswers(manifest: IntegrationManifest, answers: IntegrationDraftAnswerMap): void {
    const secretIds = this.getSecretFieldIds(manifest);

    if (secretIds.size === 0) {
      return;
    }

    const secretsState = this.readSecretsState();
    const bucket = { ...(secretsState.entries[manifest.id] || {}) };
    let touched = false;

    for (const secretId of secretIds) {
      const value = answers[secretId];
      if (typeof value !== 'string' || !value.trim()) {
        continue;
      }

      bucket[secretId] = this.secureStorageService.encryptString(value.trim()) || value.trim();
      touched = true;
    }

    if (!touched) {
      return;
    }

    secretsState.entries[manifest.id] = bucket;
    secretsState.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.secretsFile, secretsState);
  }

  private readSecretsState(): IntegrationSecretsState {
    return this.readJsonFile<IntegrationSecretsState>(this.secretsFile, {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
  }

  private resolveMode(manifest: IntegrationManifest, candidate: string): IntegrationInstallMode {
    const normalized = this.normalizeId(candidate) as IntegrationInstallMode;
    if (manifest.modes.some((entry) => entry.id === normalized)) {
      return normalized;
    }
    return manifest.defaultMode;
  }

  private resolveCapabilities(
    manifest: IntegrationManifest,
    capabilityList: string[] | readonly string[],
  ): IntegrationCapability[] {
    const allowed = new Set(manifest.capabilities);
    const normalized = Array.from(
      new Set(
        (capabilityList || [])
          .map((entry) => this.normalizeId(entry))
          .filter((entry): entry is IntegrationCapability => Boolean(entry) && allowed.has(entry as IntegrationCapability)),
      ),
    );

    if (normalized.length > 0) {
      return normalized;
    }

    const defaultSubset = manifest.capabilities.filter((entry) => ['chat', 'code'].includes(entry));
    return defaultSubset.length > 0 ? defaultSubset : manifest.capabilities.slice();
  }

  private mergeAnswers(
    current: IntegrationDraftAnswerMap,
    next: IntegrationDraftAnswerMap,
  ): IntegrationDraftAnswerMap {
    const merged: IntegrationDraftAnswerMap = { ...current };
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          merged[key] = trimmed;
        }
        continue;
      }

      if (Array.isArray(value)) {
        merged[key] = value.map((entry) => String(entry || '').trim()).filter(Boolean);
        continue;
      }

      if (typeof value === 'boolean') {
        merged[key] = value;
      }
    }
    return merged;
  }

  private readJsonFile<T>(targetPath: string, fallback: T): T {
    try {
      if (!fs.existsSync(targetPath)) {
        return fallback;
      }
      return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T;
    } catch (error: unknown) {logger.warn('[Integration Installer] JSON parse failed', error); return fallback; }
  }

  private writeJsonFile(targetPath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(value, null, 2), 'utf8');
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
