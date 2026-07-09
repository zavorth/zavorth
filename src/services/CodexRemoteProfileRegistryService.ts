
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type CodexRemotePersistedProfile = {
  id: string;
  label: string;
  description: string;
  codexCliPath?: string | null;
  codexHome?: string | null;
  workspaceRoot?: string | null;
  enabled?: boolean;
};

type CodexRemoteProfileRegistryState = {
  activeProfileId: string | null;
  profiles: CodexRemotePersistedProfile[];
};

type CodexRemoteProfileRegistryIssueCode =
  | 'state-file-invalid'
  | 'profile-invalid'
  | 'profile-duplicate'
  | 'active-profile-missing'
  | 'state-write-failed';

export type CodexRemoteProfileRegistryIssue = {
  code: CodexRemoteProfileRegistryIssueCode;
  message: string;
  profileId?: string | null;
};

type CodexRemoteProfileRegistryRuntime = {
  now?: () => Date;
  stateFilePath?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type CodexRemoteExecutionProfile = {
  id: string;
  label: string;
  description: string;
  codexCliPath: string;
  codexHome: string | null;
  workspaceRoot: string | null;
  enabled: boolean;
  active: boolean;
  source: 'default' | 'stored';
};

export type CodexRemoteProfileRegistryHealthSnapshot = {
  generatedAt: string;
  status: 'healthy' | 'degraded';
  stateFilePath: string;
  stateFileExists: boolean;
  activeProfileId: string | null;
  profileCount: number;
  enabledProfileCount: number;
  issues: CodexRemoteProfileRegistryIssue[];
  operatorSummary: string;
};

export type CodexRemoteProfileRegistryReadinessSnapshot = {
  generatedAt: string;
  ready: boolean;
  status: 'ready' | 'degraded';
  requestedProfileId: string | null;
  resolvedProfileId: string;
  activeProfileId: string;
  profileCount: number;
  enabledProfileCount: number;
  availableActions: Array<'select-profile' | 'upsert-profile' | 'delete-profile'>;
  recommendedAction: 'none' | 'select-profile' | 'create-profile' | 'repair-state-file';
  issues: string[];
  operatorSummary: string;
};

export type CodexRemoteProfileRegistrySnapshot = {
  generatedAt: string;
  activeProfileId: string;
  profiles: CodexRemoteExecutionProfile[];
  health: CodexRemoteProfileRegistryHealthSnapshot;
  readiness: CodexRemoteProfileRegistryReadinessSnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type CodexRemoteProfileRegistryReadResult = {
  state: CodexRemoteProfileRegistryState;
  issues: CodexRemoteProfileRegistryIssue[];
  stateFileExists: boolean;
  rawActiveProfileId: string | null;
};

const EMPTY_STATE: CodexRemoteProfileRegistryState = {
  activeProfileId: null,
  profiles: [],
};

export class CodexRemoteProfileRegistryService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: CodexRemoteProfileRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath =
      runtime.stateFilePath || path.join(config.dataDir, 'runtime', 'codex-remote-profiles.json');
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public buildSnapshot(): CodexRemoteProfileRegistrySnapshot {
    const profiles = this.buildProfiles();
    const activeProfile = profiles.find((profile) => profile.active) || profiles[0];
    const health = this.buildHealthSnapshot();
    const readiness = this.buildReadinessSnapshot(activeProfile?.id || null);

    return {
      generatedAt: this.now().toISOString(),
      activeProfileId: activeProfile?.id || 'default',
      profiles,
      health,
      readiness,
      narrative: {
        headline: `Codex Remote expÃµe ${profiles.length} perfil(is) configurÃ¡vel(eis).`,
        operatorSummary: activeProfile
          ? `Perfil ativo: ${activeProfile.label}. ${profiles.filter((profile) => profile.enabled).length} perfil(is) habilitado(s).`
          : 'Nenhum perfil do Codex Remote foi resolvido.',
      },
    };
  }

  public resolveExecutionProfile(profileId?: string | null): CodexRemoteExecutionProfile {
    const profiles = this.buildProfiles();
    const requestedId = String(profileId || '').trim();
    const resolved =
      (requestedId
        ? profiles.find((profile) => profile.id === requestedId && profile.enabled)
        : null)
      || profiles.find((profile) => profile.active && profile.enabled)
      || profiles.find((profile) => profile.enabled)
      || profiles[0];

    if (!resolved) {
      return {
        id: 'default',
        label: 'Default Codex',
        description: 'Perfil padrao do Codex CLI.',
        codexCliPath: config.codexCliPath,
        codexHome: this.deriveCodexHome(config.codexCliPath),
        workspaceRoot: config.defaultWorkspace,
        enabled: true,
        active: true,
        source: 'default',
      };
    }

    return resolved;
  }

  public listProfiles(): CodexRemoteExecutionProfile[] {
    return this.buildProfiles();
  }

  public listStoredProfiles(): CodexRemotePersistedProfile[] {
    return this.readState().state.profiles.slice();
  }

  public getProfile(profileId: string): CodexRemoteExecutionProfile | null {
    const normalizedId = String(profileId || '').trim();
    if (!normalizedId) {
      return null;
    }

    return this.buildProfiles().find((profile) => profile.id === normalizedId) || null;
  }

  public upsertProfile(
    profile: Partial<CodexRemotePersistedProfile> & Pick<CodexRemotePersistedProfile, 'id'>,
  ): CodexRemoteExecutionProfile {
    const normalizedId = String(profile?.id || '').trim();
    if (!normalizedId) {
      throw new Error('profileId obrigatorio.');
    }
    if (normalizedId === 'default') {
      throw new Error('Nao e possivel sobrescrever o perfil default.');
    }

    const currentState = this.readState().state;
    const existingProfile = currentState.profiles.find((entry) => entry.id === normalizedId) || null;
    const nextProfile = this.normalizeStoredProfile(profile, existingProfile);
    if (!nextProfile) {
      throw new Error('profileId obrigatorio.');
    }

    const profiles = currentState.profiles.slice();
    const existingIndex = profiles.findIndex((entry) => entry.id === normalizedId);
    if (existingIndex >= 0) {
      profiles.splice(existingIndex, 1, nextProfile);
    } else {
      profiles.push(nextProfile);
    }

    this.writeState({
      activeProfileId: this.normalizeActiveProfileId(currentState.activeProfileId, profiles),
      profiles,
    });

    return this.resolveExecutionProfile(normalizedId);
  }

  public deleteProfile(profileId: string): boolean {
    const normalizedId = String(profileId || '').trim();
    if (!normalizedId || normalizedId === 'default') {
      return false;
    }

    const currentState = this.readState().state;
    if (!currentState.profiles.some((profile) => profile.id === normalizedId)) {
      return false;
    }

    const profiles = currentState.profiles.filter((profile) => profile.id !== normalizedId);
    this.writeState({
      activeProfileId: this.normalizeActiveProfileId(
        currentState.activeProfileId === normalizedId ? null : currentState.activeProfileId,
        profiles,
      ),
      profiles,
    });

    return true;
  }

  public buildHealthSnapshot(): CodexRemoteProfileRegistryHealthSnapshot {
    const readResult = this.readState();
    const profiles = readResult.state.profiles;
    const activeProfileId =
      this.buildProfilesFromState(readResult.state).find((profile) => profile.active)?.id
      || 'default';
    const enabledProfileCount = profiles.filter((profile) => profile.enabled !== false).length;
    const issues = this.buildHealthIssues(readResult, profiles);
    const healthy = issues.length === 0;

    return {
      generatedAt: this.now().toISOString(),
      status: healthy ? 'healthy' : 'degraded',
      stateFilePath: this.stateFilePath,
      stateFileExists: readResult.stateFileExists,
      activeProfileId,
      profileCount: profiles.length,
      enabledProfileCount,
      issues,
      operatorSummary: healthy
        ? `Registry de perfis pronto com ${profiles.length} perfil(is) e ${enabledProfileCount} habilitado(s).`
        : `Registry de perfis com ${issues.length} problema(s) detectado(s).`,
    };
  }

  public buildReadinessSnapshot(profileId?: string | null): CodexRemoteProfileRegistryReadinessSnapshot {
    const readResult = this.readState();
    const profiles = this.buildProfilesFromState(readResult.state);
    const requestedProfileId = String(profileId || '').trim() || null;
    const resolvedProfile = requestedProfileId
      ? profiles.find((profile) => profile.id === requestedProfileId && profile.enabled)
      : this.resolveExecutionProfile(null);
    const activeProfile = profiles.find((profile) => profile.active) || profiles[0] || null;
    const issues: string[] = [];

    if (requestedProfileId && !resolvedProfile) {
      issues.push(`Perfil solicitado nao esta disponivel: ${requestedProfileId}.`);
    }

    const ready = Boolean(resolvedProfile);
    const recommendedAction: CodexRemoteProfileRegistryReadinessSnapshot['recommendedAction'] =
      !readResult.stateFileExists
        ? 'none'
        : issues.length > 0
          ? 'select-profile'
          : profiles.length <= 1
            ? 'create-profile'
            : 'none';

    return {
      generatedAt: this.now().toISOString(),
      ready,
      status: issues.length > 0 ? 'degraded' : 'ready',
      requestedProfileId,
      resolvedProfileId: resolvedProfile?.id || activeProfile?.id || 'default',
      activeProfileId: activeProfile?.id || 'default',
      profileCount: profiles.length,
      enabledProfileCount: profiles.filter((profile) => profile.enabled).length,
      availableActions: ['select-profile', 'upsert-profile', 'delete-profile'],
      recommendedAction,
      issues,
      operatorSummary: ready
        ? `Perfil pronto para uso: ${resolvedProfile?.label || activeProfile?.label || 'Default Codex'}.`
        : 'Nenhum perfil pronto para uso.',
    };
  }

  public selectProfile(profileId: string): CodexRemoteExecutionProfile {
    const normalizedId = String(profileId || '').trim();
    if (!normalizedId) {
      throw new Error('profileId obrigatorio.');
    }

    const snapshot = this.buildSnapshot();
    const target = snapshot.profiles.find((profile) => profile.id === normalizedId && profile.enabled);
    if (!target) {
      throw new Error(`Perfil do Codex Remote nao encontrado: ${normalizedId}.`);
    }

    const state = this.readState().state;
    this.writeState({
      ...state,
      activeProfileId: normalizedId,
    });

    return this.resolveExecutionProfile(normalizedId);
  }

  private buildProfiles(): CodexRemoteExecutionProfile[] {
    return this.buildProfilesFromState(this.readState().state);
  }

  private buildProfilesFromState(state: CodexRemoteProfileRegistryState): CodexRemoteExecutionProfile[] {
    const defaultProfile = this.buildDefaultProfile(state.activeProfileId);
    const storedProfiles = (state.profiles || [])
      .map((profile) => this.buildStoredProfile(profile, state.activeProfileId))
      .filter((profile): profile is CodexRemoteExecutionProfile => Boolean(profile));
    const merged = [defaultProfile, ...storedProfiles];

    const seen = new Set<string>();
    return merged.filter((profile) => {
      if (seen.has(profile.id)) {
        return false;
      }
      seen.add(profile.id);
      return true;
    });
  }

  private buildDefaultProfile(activeProfileId: string | null): CodexRemoteExecutionProfile {
    return {
      id: 'default',
      label: 'Default Codex',
      description: 'Usa o Codex CLI padrao configurado no host.',
      codexCliPath: config.codexCliPath,
      codexHome: this.deriveCodexHome(config.codexCliPath),
      workspaceRoot: config.defaultWorkspace,
      enabled: true,
      active: !activeProfileId || activeProfileId === 'default',
      source: 'default',
    };
  }

  private buildStoredProfile(
    profile: CodexRemotePersistedProfile,
    activeProfileId: string | null,
  ): CodexRemoteExecutionProfile | null {
    const id = String(profile?.id || '').trim();
    if (!id) {
      return null;
    }

    const codexCliPath = String(profile?.codexCliPath || '').trim() || config.codexCliPath;
    const codexHome = String(profile?.codexHome || '').trim() || this.deriveCodexHome(codexCliPath);
    const workspaceRoot = String(profile?.workspaceRoot || '').trim() || config.defaultWorkspace;

    return {
      id,
      label: String(profile?.label || '').trim() || id,
      description: String(profile?.description || '').trim() || 'Perfil adicional do Codex Remote.',
      codexCliPath,
      codexHome,
      workspaceRoot,
      enabled: profile?.enabled !== false,
      active: activeProfileId === id,
      source: 'stored',
    };
  }

  private normalizeStoredProfile(
    profile: Partial<CodexRemotePersistedProfile> & Pick<CodexRemotePersistedProfile, 'id'>,
    fallback: CodexRemotePersistedProfile | null,
  ): CodexRemotePersistedProfile | null {
    const id = String(profile?.id || '').trim();
    if (!id) {
      return null;
    }

    const label = String(profile?.label || fallback?.label || '').trim() || id;
    const description = String(profile?.description || fallback?.description || '').trim()
      || 'Perfil adicional do Codex Remote.';
    const codexCliPath = String(profile?.codexCliPath || fallback?.codexCliPath || '').trim() || config.codexCliPath;
    const codexHome = String(profile?.codexHome || fallback?.codexHome || '').trim() || this.deriveCodexHome(codexCliPath);
    const workspaceRoot = String(profile?.workspaceRoot || fallback?.workspaceRoot || '').trim() || config.defaultWorkspace;

    return {
      id,
      label,
      description,
      codexCliPath,
      codexHome,
      workspaceRoot,
      enabled: profile?.enabled !== undefined ? profile.enabled !== false : fallback?.enabled !== false,
    };
  }

  private deriveCodexHome(codexCliPath: string): string | null {
    const normalizedPath = String(codexCliPath || '').trim();
    if (!normalizedPath) {
      return null;
    }

    const sandboxBinDir = path.dirname(normalizedPath);
    if (path.basename(sandboxBinDir).toLowerCase() === '.sandbox-bin') {
      return path.dirname(sandboxBinDir);
    }

    return process.env.CODEX_HOME || null;
  }

  private normalizeActiveProfileId(activeProfileId: string | null, profiles: CodexRemotePersistedProfile[]): string | null {
    const normalized = String(activeProfileId || '').trim();
    if (!normalized) {
      return null;
    }

    if (normalized === 'default') {
      return 'default';
    }

    if (profiles.some((profile) => profile.id === normalized)) {
      return normalized;
    }

    const firstEnabledProfile = profiles.find((profile) => profile.enabled !== false);
    return firstEnabledProfile?.id || null;
  }

  private readState(): CodexRemoteProfileRegistryReadResult {
    const stateFileExists = this.existsSync(this.stateFilePath);
    if (!stateFileExists) {
      return {
        state: { ...EMPTY_STATE },
        issues: [],
        stateFileExists,
        rawActiveProfileId: null,
      };
    }

    try {
      const parsed = JSON.parse(this.readFileSync(this.stateFilePath, 'utf8')) as Partial<CodexRemoteProfileRegistryState>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          state: { ...EMPTY_STATE },
          issues: [
            {
              code: 'state-file-invalid',
              message: 'O arquivo de estado do registry nao possui um objeto valido.',
            },
          ],
          stateFileExists,
          rawActiveProfileId: null,
        };
      }

      const issues: CodexRemoteProfileRegistryIssue[] = [];
      const rawActiveProfileId = String(parsed.activeProfileId || '').trim() || null;
      const sanitizedProfiles = this.sanitizeStoredProfiles(parsed.profiles, issues);
      const activeProfileId = this.normalizeActiveProfileId(rawActiveProfileId, sanitizedProfiles);

      return {
        state: {
          activeProfileId,
          profiles: sanitizedProfiles,
        },
        issues,
        stateFileExists,
        rawActiveProfileId,
      };
    } catch (error: unknown) {logger.warn('[Codex Remote Profile Registry] parsing failed', error);
    return {
        state: { ...EMPTY_STATE },
        issues: [
          {
            code: 'state-file-invalid',
            message: 'Falha ao ler ou interpretar o arquivo de estado do registry.',
            },
          ],
          stateFileExists,
          rawActiveProfileId: null,
        };
  }
  }

  private sanitizeStoredProfiles(
    profiles: unknown,
    issues: CodexRemoteProfileRegistryIssue[],
  ): CodexRemotePersistedProfile[] {
    if (!Array.isArray(profiles)) {
      return [];
    }

    const sanitized: CodexRemotePersistedProfile[] = [];
    const seen = new Set<string>();

    for (const rawProfile of profiles) {
      const normalized = this.normalizeStoredProfileFromUnknown(rawProfile, issues);
      if (!normalized) {
        continue;
      }

      if (seen.has(normalized.id)) {
        issues.push({
          code: 'profile-duplicate',
          message: `Perfil duplicado ignorado: ${normalized.id}.`,
          profileId: normalized.id,
        });
        continue;
      }

      seen.add(normalized.id);
      sanitized.push(normalized);
    }

    return sanitized;
  }

  private normalizeStoredProfileFromUnknown(
    rawProfile: unknown,
    issues: CodexRemoteProfileRegistryIssue[],
  ): CodexRemotePersistedProfile | null {
    if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) {
      issues.push({
        code: 'profile-invalid',
        message: 'Entrada de perfil invalida ignorada.',
      });
      return null;
    }

    const profile = rawProfile as Partial<CodexRemotePersistedProfile>;
    const id = String(profile.id || '').trim();
    if (!id) {
      issues.push({
        code: 'profile-invalid',
        message: 'Entrada de perfil sem id foi ignorada.',
      });
      return null;
    }

    return this.normalizeStoredProfile(
      {
        id,
        label: profile.label,
        description: profile.description,
        codexCliPath: profile.codexCliPath,
        codexHome: profile.codexHome,
        workspaceRoot: profile.workspaceRoot,
        enabled: profile.enabled,
      },
      null,
    );
  }

  private buildHealthIssues(
    readResult: CodexRemoteProfileRegistryReadResult,
    profiles: CodexRemotePersistedProfile[],
  ): CodexRemoteProfileRegistryIssue[] {
    const issues = readResult.issues.slice();
    const rawActiveProfileId = String(readResult.rawActiveProfileId || '').trim();
    const activeProfileExists =
      rawActiveProfileId === 'default' || profiles.some((profile) => profile.id === rawActiveProfileId);

    if (rawActiveProfileId && !activeProfileExists) {
      issues.push({
        code: 'active-profile-missing',
        message: `O perfil ativo salvo nao existe mais: ${rawActiveProfileId}.`,
        profileId: rawActiveProfileId,
      });
    }

    return issues;
  }

  private writeState(state: CodexRemoteProfileRegistryState): void {
    const normalizedState = {
      activeProfileId: this.normalizeActiveProfileId(state.activeProfileId, state.profiles),
      profiles: this.sanitizeStoredProfiles(state.profiles, []),
    };

    try {
      this.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
      this.writeFileSync(this.stateFilePath, JSON.stringify(normalizedState, null, 2), 'utf8');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'erro desconhecido';
      throw new Error(`Falha ao persistir o registry de perfis do Codex Remote: ${message}`);
    }
  }
}
