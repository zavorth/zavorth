/**
 * Persist and resolve operator voice preferences (STT/TTS sovereignty).
 * Default state is unconfigured — never invent Flash/Whisper product defaults.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import {
  VOICE_STT_CONFIGURE_HINT,
  VOICE_TTS_CONFIGURE_HINT,
  ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION,
  createUnconfiguredVoicePreference,
  isVoiceSttConfigured,
  normalizeVoiceSttProvider,
  normalizeVoiceTtsProvider,
  type VoiceInteractionMode,
  type VoicePreference,
  type VoiceSttProviderId,
  type VoiceSttResolveResult,
  type VoiceTtsProviderId,
  type VoiceTtsResolveResult,
} from '../../contracts/voice/VoicePreferenceContract.js';

export type VoicePreferenceServiceOptions = {
  projectRoot?: string;
  preferencePath?: string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  fs?: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'writeFileSync'>;
};

export type VoicePreferencePatch = {
  userId?: string | null;
  workspaceId?: string | null;
  mode?: VoiceInteractionMode;
  stt?: Partial<VoicePreference['stt']>;
  tts?: Partial<VoicePreference['tts']>;
};

export class VoicePreferenceService {
  private readonly preferencePath: string;
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fs: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'writeFileSync'>;

  constructor(options: VoicePreferenceServiceOptions = {}) {
    const root = path.resolve(options.projectRoot || config.projectRoot || process.cwd());
    this.preferencePath = options.preferencePath || path.join(root, 'data', 'runtime', 'voice', 'preference.json');
    this.now = options.now || (() => new Date());
    this.env = options.env || process.env;
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
    };
  }

  public getPreferencePath(): string {
    return this.preferencePath;
  }

  public get(): VoicePreference {
    if (!this.fs.existsSync(this.preferencePath)) {
      return createUnconfiguredVoicePreference(this.now);
    }
    try {
      const raw = JSON.parse(this.fs.readFileSync(this.preferencePath, 'utf8')) as Partial<VoicePreference>;
      return this.normalizeStored(raw);
    } catch {
      return createUnconfiguredVoicePreference(this.now);
    }
  }

  public isSttConfigured(): boolean {
    return isVoiceSttConfigured(this.get());
  }

  public set(patch: VoicePreferencePatch): VoicePreference {
    const current = this.get();
    const next: VoicePreference = {
      ...current,
      version: ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION,
      updatedAt: this.now().toISOString(),
      userId: patch.userId !== undefined ? patch.userId : current.userId,
      workspaceId: patch.workspaceId !== undefined ? patch.workspaceId : current.workspaceId,
      mode: patch.mode || current.mode,
      stt: {
        ...current.stt,
        ...(patch.stt || {}),
      },
      tts: {
        ...current.tts,
        ...(patch.tts || {}),
      },
    };

    if (patch.stt?.provider != null) {
      const p = normalizeVoiceSttProvider(patch.stt.provider);
      next.stt.provider = p || 'none';
    }
    if (patch.tts?.provider != null) {
      const p = normalizeVoiceTtsProvider(patch.tts.provider);
      next.tts.provider = p || 'none';
    }
    if (patch.stt?.model !== undefined) {
      const m = String(patch.stt.model || '').trim();
      next.stt.model = m || null;
    }
    if (patch.tts?.voiceId !== undefined) {
      const v = String(patch.tts.voiceId || '').trim();
      next.tts.voiceId = v || null;
    }
    if (patch.stt?.language != null) {
      next.stt.language = String(patch.stt.language || 'auto').trim() || 'auto';
    }
    if (typeof patch.tts?.enabled === 'boolean') {
      next.tts.enabled = patch.tts.enabled;
    }

    // Selecting an STT provider implies dictation mode unless user set conversation/off explicitly in same patch
    if (next.stt.provider !== 'none' && next.mode === 'off' && !patch.mode) {
      next.mode = 'dictation';
    }
    if (next.stt.provider === 'none' && !patch.mode) {
      next.mode = 'off';
    }

    this.persist(next);
    return next;
  }

  public clear(): VoicePreference {
    const empty = createUnconfiguredVoicePreference(this.now);
    this.persist(empty);
    return empty;
  }

  /**
   * Resolve which STT providers may run.
   * Order of authority:
   * 1) Preference file (user sovereignty)
   * 2) Explicit env ZAVORTH_AUDIO_STT_PROVIDERS (ops sovereignty)
   * 3) Legacy cascade ONLY if ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE=true
   * 4) Otherwise refuse
   */
  public resolveStt(): VoiceSttResolveResult {
    if (this.env.ZAVORTH_AUDIO_STT_ENABLED === 'false' || this.env.ZAVORTH_AUDIO_STT_ENABLED === '0') {
      return {
        ok: false,
        code: 'stt_disabled',
        message: 'Audio STT is disabled (ZAVORTH_AUDIO_STT_ENABLED=false).',
        configureHint: VOICE_STT_CONFIGURE_HINT,
      };
    }

    const preference = this.get();
    if (isVoiceSttConfigured(preference)) {
      const provider = preference.stt.provider as Exclude<VoiceSttProviderId, 'none'>;
      return {
        ok: true,
        providers: [provider],
        model: preference.stt.model,
        language: preference.stt.language || 'auto',
        source: 'preference',
      };
    }

    const envList = this.parseEnvProviderList(this.env.ZAVORTH_AUDIO_STT_PROVIDERS);
    if (envList.length > 0) {
      return {
        ok: true,
        providers: envList,
        model: String(this.env.ZAVORTH_AUDIO_STT_MODEL || '').trim() || null,
        language: String(this.env.ZAVORTH_AUDIO_STT_LANGUAGE || 'auto').trim() || 'auto',
        source: 'env_explicit',
      };
    }

    const allowLegacy =
      this.env.ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE === '1' ||
      this.env.ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE === 'true';
    if (allowLegacy) {
      return {
        ok: true,
        providers: ['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp'],
        model: null,
        language: 'auto',
        source: 'legacy_cascade',
      };
    }

    return {
      ok: false,
      code: 'stt_not_configured',
      message: 'STT is not configured. Zavorth will not pick a default speech model for you.',
      configureHint: VOICE_STT_CONFIGURE_HINT,
    };
  }

  /**
   * Resolve whether TTS may run and which backend will be used.
   * Honest: TTS never auto-selects a voice — it is off until the user enables it.
   */
  public resolveTts(): VoiceTtsResolveResult {
    const preference = this.get();

    if (!preference.tts.enabled) {
      return {
        ok: false,
        enabled: false,
        code: 'tts_disabled',
        message: 'TTS is disabled. Enable it explicitly before the agent may speak.',
        configureHint: VOICE_TTS_CONFIGURE_HINT,
      };
    }

    if (preference.tts.provider === 'none') {
      return {
        ok: false,
        enabled: false,
        code: 'tts_not_configured',
        message: 'TTS is enabled but no provider is selected.',
        configureHint: VOICE_TTS_CONFIGURE_HINT,
      };
    }

    return {
      ok: true,
      enabled: true,
      provider: preference.tts.provider as Exclude<VoiceTtsProviderId, 'none'>,
      voiceId: preference.tts.voiceId,
      message: `TTS will use ${preference.tts.provider}${
        preference.tts.voiceId ? ` with voice ${preference.tts.voiceId}` : ''
      }.`,
    };
  }

  public describe(): string {
    const pref = this.get();
    const stt = this.resolveStt();
    const tts = this.resolveTts();
    const lines = [
      'Zavorth Voice Preference',
      `path: ${this.preferencePath}`,
      `mode: ${pref.mode}`,
      `stt.provider: ${pref.stt.provider}`,
      `stt.model: ${pref.stt.model || '(provider default after choose)'}`,
      `stt.language: ${pref.stt.language}`,
      `tts.enabled: ${pref.tts.enabled}`,
      `tts.provider: ${pref.tts.provider}`,
      `tts.voiceId: ${pref.tts.voiceId || '(none)'}`,
      stt.ok === true ? `stt.resolve: ok source=${stt.source} providers=${stt.providers.join(',')}`
        : `stt.resolve: FAIL ${stt.code} — ${stt.message}`,
      tts.ok === true ? `tts.resolve: ok provider=${tts.provider}${tts.voiceId ? ` voice=${tts.voiceId}` : ''}`
        : `tts.resolve: FAIL ${tts.code} — ${tts.message}`,
    ];
    if (stt.ok === false) {
      lines.push(`hint: ${stt.configureHint}`);
    }
    if (tts.ok === false) {
      lines.push(`hint: ${tts.configureHint}`);
    }
    return lines.join('\n');
  }

  private persist(preference: VoicePreference): void {
    const dir = path.dirname(this.preferencePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
    this.fs.writeFileSync(this.preferencePath, `${JSON.stringify(preference, null, 2)}\n`, 'utf8');
  }

  private normalizeStored(raw: Partial<VoicePreference>): VoicePreference {
    const base = createUnconfiguredVoicePreference(this.now);
    const sttProvider = normalizeVoiceSttProvider(raw.stt?.provider) || 'none';
    const ttsProvider = normalizeVoiceTtsProvider(raw.tts?.provider) || 'none';
    const modeRaw = String(raw.mode || base.mode).toLowerCase();
    const mode: VoiceInteractionMode =
      modeRaw === 'dictation' || modeRaw === 'conversation' || modeRaw === 'off' ? modeRaw : 'off';

    return {
      version: ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION,
      updatedAt: String(raw.updatedAt || base.updatedAt),
      userId: raw.userId ?? null,
      workspaceId: raw.workspaceId ?? null,
      mode,
      stt: {
        provider: sttProvider,
        model: raw.stt?.model != null && String(raw.stt.model).trim() ? String(raw.stt.model).trim() : null,
        language: String(raw.stt?.language || 'auto').trim() || 'auto',
      },
      tts: {
        enabled: Boolean(raw.tts?.enabled),
        provider: ttsProvider,
        voiceId: raw.tts?.voiceId != null && String(raw.tts.voiceId).trim() ? String(raw.tts.voiceId).trim() : null,
      },
    };
  }

  private parseEnvProviderList(raw: string | undefined): Exclude<VoiceSttProviderId, 'none'>[] {
    const parts = String(raw || '')
      .split(/[,|]/)
      .map((p) => normalizeVoiceSttProvider(p))
      .filter((p): p is Exclude<VoiceSttProviderId, 'none'> => Boolean(p) && p !== 'none');
    return [...new Set(parts)];
  }
}

let defaultService: VoicePreferenceService | null = null;

export function getVoicePreferenceService(options?: VoicePreferenceServiceOptions): VoicePreferenceService {
  if (options) return new VoicePreferenceService(options);
  if (!defaultService) defaultService = new VoicePreferenceService();
  return defaultService;
}

export function resetVoicePreferenceServiceForTests(): void {
  defaultService = null;
}
