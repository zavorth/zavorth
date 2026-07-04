export type KaelPetState = 'idle' | 'thinking' | 'working' | 'finished' | 'sleeping' | 'celebrating';

export type KaelSkin = 'default' | 'shadow' | 'golden' | 'cyberpunk';

export type KaelScale = 'small' | 'medium' | 'large';

export type KaelMode = 'expressive' | 'discreet';

export type KaelAnimationConfig = {
  row: number;
  frames: number;
  fps: number;
  startFrame?: number;
};

export type KaelEventBehavior = {
  composing: KaelPetState;
  running: KaelPetState;
  completed: KaelPetState;
  approval: KaelPetState;
  error: KaelPetState;
  runtimeOffline: KaelPetState;
  focused: KaelPetState;
  idle: KaelPetState;
};

export type KaelBehaviorSettings = {
  scale: KaelScale;
  mode: KaelMode;
  reducedMotion: boolean;
  notifications: boolean;
  eventBehavior: KaelEventBehavior;
};

export type KaelDesktopPetLayout = {
  overlaySize: number;
  spriteStageSize: number;
  spriteScale: number;
  glowSize: number;
  bubbleBottom: number;
  bubbleMaxWidth: number;
  composerWidth: number;
  composerBottom: number;
  screenMarginX: number;
  screenMarginY: number;
};

export type KaelOverlayStatePayload = {
  state?: KaelPetState;
  bubbleText?: string | null;
  skin?: KaelSkin;
  behaviorSettings?: KaelBehaviorSettings;
  animationState?: KaelPetState;
  animationConfig?: KaelAnimationConfig;
  refreshConfig?: boolean;
};

type KaelStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const KAEL_SPRITE_SHEET = {
  columns: 8,
  rows: 9,
  frameWidth: 192,
  frameHeight: 208,
  width: 1536,
  height: 1872,
} as const;

export const KAEL_DESKTOP_PET_LAYOUT: KaelDesktopPetLayout = {
  overlaySize: 200,
  spriteStageSize: 104,
  spriteScale: 0.48,
  glowSize: 86,
  bubbleBottom: 112,
  bubbleMaxWidth: 164,
  composerWidth: 170,
  composerBottom: 4,
  screenMarginX: 220,
  screenMarginY: 230,
};

export const KAEL_SCALE_LAYOUTS: Record<KaelScale, KaelDesktopPetLayout> = {
  small: {
    overlaySize: 160,
    spriteStageSize: 84,
    spriteScale: 0.38,
    glowSize: 68,
    bubbleBottom: 92,
    bubbleMaxWidth: 146,
    composerWidth: 150,
    composerBottom: 2,
    screenMarginX: 180,
    screenMarginY: 190,
  },
  medium: KAEL_DESKTOP_PET_LAYOUT,
  large: {
    overlaySize: 232,
    spriteStageSize: 122,
    spriteScale: 0.54,
    glowSize: 104,
    bubbleBottom: 132,
    bubbleMaxWidth: 188,
    composerWidth: 194,
    composerBottom: 6,
    screenMarginX: 252,
    screenMarginY: 262,
  },
} as const;

export const KAEL_SKINS: readonly KaelSkin[] = ['default', 'shadow', 'golden', 'cyberpunk'];
export const KAEL_SCALES: readonly KaelScale[] = ['small', 'medium', 'large'];
export const KAEL_MODES: readonly KaelMode[] = ['expressive', 'discreet'];

export const DEFAULT_KAEL_ANIMATIONS: Record<KaelPetState, KaelAnimationConfig> = {
  idle: { row: 0, frames: 6, fps: 6 },
  thinking: { row: 8, frames: 6, fps: 6 },
  working: { row: 2, frames: 8, fps: 12 },
  sleeping: { row: 5, frames: 6, fps: 4 },
  celebrating: { row: 4, frames: 5, fps: 9 },
  finished: { row: 6, frames: 6, fps: 6 },
};

export const DEFAULT_KAEL_BEHAVIOR_SETTINGS: KaelBehaviorSettings = {
  scale: 'medium',
  mode: 'expressive',
  reducedMotion: false,
  notifications: true,
  eventBehavior: {
    composing: 'thinking',
    running: 'working',
    completed: 'finished',
    approval: 'thinking',
    error: 'sleeping',
    runtimeOffline: 'sleeping',
    focused: 'idle',
    idle: 'idle',
  },
};

export function kaelAnimationStorageKey(state: KaelPetState) {
  return `zvd:pet-anim:${state}`;
}

export function getDefaultKaelAnimationConfig(state: KaelPetState): KaelAnimationConfig {
  return DEFAULT_KAEL_ANIMATIONS[state] || DEFAULT_KAEL_ANIMATIONS.idle;
}

export function normalizeKaelSkin(value: unknown): KaelSkin {
  return KAEL_SKINS.includes(value as KaelSkin) ? (value as KaelSkin) : 'default';
}

export function sanitizeKaelAnimationConfig(
  value: Partial<KaelAnimationConfig> | null | undefined,
  fallback: KaelAnimationConfig = DEFAULT_KAEL_ANIMATIONS.idle,
): KaelAnimationConfig {
  const row = clampInteger(value?.row, 0, KAEL_SPRITE_SHEET.rows - 1, fallback.row);
  const startFrame = clampInteger(value?.startFrame, 0, KAEL_SPRITE_SHEET.columns - 1, fallback.startFrame || 0);
  const maxFrames = KAEL_SPRITE_SHEET.columns - startFrame;
  return {
    row,
    frames: clampInteger(value?.frames, 1, maxFrames, fallback.frames),
    fps: clampInteger(value?.fps, 1, 30, fallback.fps),
    ...(startFrame > 0 ? { startFrame } : {}),
  };
}

export function loadKaelAnimationConfig(
  state: KaelPetState,
  storage: KaelStorage | undefined = currentStorage(),
): KaelAnimationConfig {
  const fallback = getDefaultKaelAnimationConfig(state);
  if (!storage) {
    return fallback;
  }

  const saved = storage.getItem(kaelAnimationStorageKey(state));
  if (!saved) {
    return fallback;
  }

  try {
    return sanitizeKaelAnimationConfig(JSON.parse(saved), fallback);
  } catch {
    return fallback;
  }
}

export function saveKaelAnimationConfig(
  state: KaelPetState,
  config: KaelAnimationConfig,
  storage: KaelStorage | undefined = currentStorage(),
): KaelAnimationConfig {
  const sanitized = sanitizeKaelAnimationConfig(config, getDefaultKaelAnimationConfig(state));
  storage?.setItem(kaelAnimationStorageKey(state), JSON.stringify(sanitized));
  return sanitized;
}

export function removeKaelAnimationConfig(
  state: KaelPetState,
  storage: KaelStorage | undefined = currentStorage(),
) {
  storage?.removeItem(kaelAnimationStorageKey(state));
}

export function loadKaelSkin(storage: KaelStorage | undefined = currentStorage()): KaelSkin {
  return normalizeKaelSkin(storage?.getItem('zvd:kael-skin'));
}

export function saveKaelSkin(skin: KaelSkin, storage: KaelStorage | undefined = currentStorage()): KaelSkin {
  const normalized = normalizeKaelSkin(skin);
  storage?.setItem('zvd:kael-skin', normalized);
  return normalized;
}

export function sanitizeKaelBehaviorSettings(value: Partial<KaelBehaviorSettings> | null | undefined): KaelBehaviorSettings {
  const eventBehavior = value?.eventBehavior || DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior;
  return {
    scale: KAEL_SCALES.includes(value?.scale as KaelScale)
      ? value?.scale as KaelScale
      : DEFAULT_KAEL_BEHAVIOR_SETTINGS.scale,
    mode: KAEL_MODES.includes(value?.mode as KaelMode)
      ? value?.mode as KaelMode
      : DEFAULT_KAEL_BEHAVIOR_SETTINGS.mode,
    reducedMotion: typeof value?.reducedMotion === 'boolean'
      ? value.reducedMotion
      : DEFAULT_KAEL_BEHAVIOR_SETTINGS.reducedMotion,
    notifications: typeof value?.notifications === 'boolean'
      ? value.notifications
      : DEFAULT_KAEL_BEHAVIOR_SETTINGS.notifications,
    eventBehavior: {
      composing: normalizeKaelState(eventBehavior.composing, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.composing),
      running: normalizeKaelState(eventBehavior.running, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.running),
      completed: normalizeKaelState(eventBehavior.completed, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.completed),
      approval: normalizeKaelState(eventBehavior.approval, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.approval),
      error: normalizeKaelState(eventBehavior.error, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.error),
      runtimeOffline: normalizeKaelState(eventBehavior.runtimeOffline, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.runtimeOffline),
      focused: normalizeKaelState(eventBehavior.focused, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.focused),
      idle: normalizeKaelState(eventBehavior.idle, DEFAULT_KAEL_BEHAVIOR_SETTINGS.eventBehavior.idle),
    },
  };
}

export function loadKaelBehaviorSettings(storage: KaelStorage | undefined = currentStorage()): KaelBehaviorSettings {
  if (!storage) {
    return DEFAULT_KAEL_BEHAVIOR_SETTINGS;
  }

  const saved = storage.getItem('zvd:kael-behavior');
  if (!saved) {
    return DEFAULT_KAEL_BEHAVIOR_SETTINGS;
  }

  try {
    return sanitizeKaelBehaviorSettings(JSON.parse(saved));
  } catch {
    return DEFAULT_KAEL_BEHAVIOR_SETTINGS;
  }
}

export function saveKaelBehaviorSettings(
  settings: Partial<KaelBehaviorSettings>,
  storage: KaelStorage | undefined = currentStorage(),
): KaelBehaviorSettings {
  const sanitized = sanitizeKaelBehaviorSettings(settings);
  storage?.setItem('zvd:kael-behavior', JSON.stringify(sanitized));
  return sanitized;
}

export function kaelLayoutForBehavior(settings: Partial<KaelBehaviorSettings> | null | undefined) {
  const sanitized = sanitizeKaelBehaviorSettings(settings);
  return KAEL_SCALE_LAYOUTS[sanitized.scale];
}

export function kaelStateForDesktopEvent(
  input: {
    busy: boolean;
    input: string;
    transientState: KaelPetState | null;
    approvalsCount?: number;
    hasError?: boolean;
    runtimeRunning?: boolean;
    windowFocused?: boolean;
  },
  settings: Partial<KaelBehaviorSettings> | null | undefined = DEFAULT_KAEL_BEHAVIOR_SETTINGS,
): KaelPetState {
  const behavior = sanitizeKaelBehaviorSettings(settings);
  if (input.hasError) {
    return behavior.eventBehavior.error;
  }
  if (input.runtimeRunning === false) {
    return behavior.eventBehavior.runtimeOffline;
  }
  if ((input.approvalsCount || 0) > 0) {
    return behavior.eventBehavior.approval;
  }
  if (input.busy) {
    return behavior.eventBehavior.running;
  }
  if (input.transientState) {
    return normalizeKaelState(input.transientState, behavior.eventBehavior.completed);
  }
  if (input.input.trim()) {
    return behavior.eventBehavior.composing;
  }
  if (input.windowFocused) {
    return behavior.eventBehavior.focused;
  }
  return behavior.eventBehavior.idle;
}

export function buildKaelEventCue(input: {
  approvalsCount: number;
  hasError: boolean;
  runtimeRunning: boolean;
  windowFocused: boolean;
  mode: KaelMode;
}): { message: string; tone: 'approval' | 'error' | 'offline' | 'focus' } | null {
  if (input.mode === 'discreet' && !input.hasError && input.runtimeRunning && input.approvalsCount === 0) {
    return null;
  }
  if (input.hasError) {
    return { tone: 'error', message: 'Something needs attention.' };
  }
  if (!input.runtimeRunning) {
    return { tone: 'offline', message: 'Runtime offline.' };
  }
  if (input.approvalsCount > 0) {
    const suffix = input.approvalsCount === 1 ? 'Approval needed.' : `${input.approvalsCount} approvals needed.`;
    return { tone: 'approval', message: suffix };
  }
  if (input.windowFocused && input.mode === 'expressive') {
    return { tone: 'focus', message: 'Ready when you are.' };
  }
  return null;
}

export function buildKaelSyncPayload(input: {
  skin?: KaelSkin;
  behaviorSettings?: KaelBehaviorSettings;
  animationState?: KaelPetState;
  animationConfig?: KaelAnimationConfig;
}): KaelOverlayStatePayload {
  return {
    ...input,
    refreshConfig: true,
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function normalizeKaelState(value: unknown, fallback: KaelPetState): KaelPetState {
  return Object.prototype.hasOwnProperty.call(DEFAULT_KAEL_ANIMATIONS, String(value))
    ? value as KaelPetState
    : fallback;
}

function currentStorage(): KaelStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
