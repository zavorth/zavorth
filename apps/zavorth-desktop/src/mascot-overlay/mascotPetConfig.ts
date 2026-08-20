export type MascotPetState = 'idle' | 'thinking' | 'working' | 'finished' | 'sleeping' | 'celebrating';

export type MascotSkin = 'default' | 'shadow' | 'golden' | 'cyberpunk';

export type MascotScale = 'small' | 'medium' | 'large';

export type MascotMode = 'expressive' | 'discreet';

export type MascotAnimationConfig = {
  row: number;
  frames: number;
  fps: number;
  startFrame?: number;
};

export type MascotEventBehavior = {
  composing: MascotPetState;
  running: MascotPetState;
  completed: MascotPetState;
  approval: MascotPetState;
  error: MascotPetState;
  runtimeOffline: MascotPetState;
  focused: MascotPetState;
  idle: MascotPetState;
};

export type MascotBehaviorSettings = {
  scale: MascotScale;
  mode: MascotMode;
  reducedMotion: boolean;
  notifications: boolean;
  eventBehavior: MascotEventBehavior;
};

export type MascotDesktopPetLayout = {
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

export type MascotOverlayStatePayload = {
  state?: MascotPetState;
  bubbleText?: string | null;
  skin?: MascotSkin;
  behaviorSettings?: MascotBehaviorSettings;
  animationState?: MascotPetState;
  animationConfig?: MascotAnimationConfig;
  refreshConfig?: boolean;
};

type MascotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const MASCOT_SPRITE_SHEET = {
  columns: 8,
  rows: 9,
  frameWidth: 192,
  frameHeight: 208,
  width: 1536,
  height: 1872,
} as const;

export const MASCOT_DESKTOP_PET_LAYOUT: MascotDesktopPetLayout = {
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

export const MASCOT_SCALE_LAYOUTS: Record<MascotScale, MascotDesktopPetLayout> = {
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
  medium: MASCOT_DESKTOP_PET_LAYOUT,
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

export const MASCOT_SKINS: readonly MascotSkin[] = ['default', 'shadow', 'golden', 'cyberpunk'];
export const MASCOT_SCALES: readonly MascotScale[] = ['small', 'medium', 'large'];
export const MASCOT_MODES: readonly MascotMode[] = ['expressive', 'discreet'];

export const DEFAULT_MASCOT_ANIMATIONS: Record<MascotPetState, MascotAnimationConfig> = {
  idle: { row: 0, frames: 6, fps: 6 },
  thinking: { row: 8, frames: 6, fps: 6 },
  working: { row: 2, frames: 8, fps: 12 },
  sleeping: { row: 5, frames: 6, fps: 4 },
  celebrating: { row: 4, frames: 5, fps: 9 },
  finished: { row: 6, frames: 6, fps: 6 },
};

export const DEFAULT_MASCOT_BEHAVIOR_SETTINGS: MascotBehaviorSettings = {
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

export function mascotAnimationStorageKey(state: MascotPetState) {
  return `zvd:pet-anim:${state}`;
}

export function getDefaultMascotAnimationConfig(state: MascotPetState): MascotAnimationConfig {
  return DEFAULT_MASCOT_ANIMATIONS[state] || DEFAULT_MASCOT_ANIMATIONS.idle;
}

export function normalizeMascotSkin(value: unknown): MascotSkin {
  return MASCOT_SKINS.includes(value as MascotSkin) ? (value as MascotSkin) : 'default';
}

export function sanitizeMascotAnimationConfig(
  value: Partial<MascotAnimationConfig> | null | undefined,
  fallback: MascotAnimationConfig = DEFAULT_MASCOT_ANIMATIONS.idle,
): MascotAnimationConfig {
  const row = clampInteger(value?.row, 0, MASCOT_SPRITE_SHEET.rows - 1, fallback.row);
  const startFrame = clampInteger(value?.startFrame, 0, MASCOT_SPRITE_SHEET.columns - 1, fallback.startFrame || 0);
  const maxFrames = MASCOT_SPRITE_SHEET.columns - startFrame;
  return {
    row,
    frames: clampInteger(value?.frames, 1, maxFrames, fallback.frames),
    fps: clampInteger(value?.fps, 1, 30, fallback.fps),
    ...(startFrame > 0 ? { startFrame } : {}),
  };
}

export function loadMascotAnimationConfig(
  state: MascotPetState,
  storage: MascotStorage | undefined = currentStorage(),
): MascotAnimationConfig {
  const fallback = getDefaultMascotAnimationConfig(state);
  if (!storage) {
    return fallback;
  }

  const saved = storage.getItem(mascotAnimationStorageKey(state));
  if (!saved) {
    return fallback;
  }

  try {
    return sanitizeMascotAnimationConfig(JSON.parse(saved), fallback);
  } catch {
    return fallback;
  }
}

export function saveMascotAnimationConfig(
  state: MascotPetState,
  config: MascotAnimationConfig,
  storage: MascotStorage | undefined = currentStorage(),
): MascotAnimationConfig {
  const sanitized = sanitizeMascotAnimationConfig(config, getDefaultMascotAnimationConfig(state));
  storage?.setItem(mascotAnimationStorageKey(state), JSON.stringify(sanitized));
  return sanitized;
}

export function removeMascotAnimationConfig(
  state: MascotPetState,
  storage: MascotStorage | undefined = currentStorage(),
) {
  storage?.removeItem(mascotAnimationStorageKey(state));
}

export function loadMascotSkin(storage: MascotStorage | undefined = currentStorage()): MascotSkin {
  return normalizeMascotSkin(storage?.getItem('zvd:mascot-skin'));
}

export function saveMascotSkin(skin: MascotSkin, storage: MascotStorage | undefined = currentStorage()): MascotSkin {
  const normalized = normalizeMascotSkin(skin);
  storage?.setItem('zvd:mascot-skin', normalized);
  return normalized;
}

export function sanitizeMascotBehaviorSettings(value: Partial<MascotBehaviorSettings> | null | undefined): MascotBehaviorSettings {
  const eventBehavior = value?.eventBehavior || DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior;
  return {
    scale: MASCOT_SCALES.includes(value?.scale as MascotScale)
      ? value?.scale as MascotScale
      : DEFAULT_MASCOT_BEHAVIOR_SETTINGS.scale,
    mode: MASCOT_MODES.includes(value?.mode as MascotMode)
      ? value?.mode as MascotMode
      : DEFAULT_MASCOT_BEHAVIOR_SETTINGS.mode,
    reducedMotion: typeof value?.reducedMotion === 'boolean'
      ? value.reducedMotion
      : DEFAULT_MASCOT_BEHAVIOR_SETTINGS.reducedMotion,
    notifications: typeof value?.notifications === 'boolean'
      ? value.notifications
      : DEFAULT_MASCOT_BEHAVIOR_SETTINGS.notifications,
    eventBehavior: {
      composing: normalizeMascotState(eventBehavior.composing, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.composing),
      running: normalizeMascotState(eventBehavior.running, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.running),
      completed: normalizeMascotState(eventBehavior.completed, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.completed),
      approval: normalizeMascotState(eventBehavior.approval, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.approval),
      error: normalizeMascotState(eventBehavior.error, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.error),
      runtimeOffline: normalizeMascotState(eventBehavior.runtimeOffline, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.runtimeOffline),
      focused: normalizeMascotState(eventBehavior.focused, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.focused),
      idle: normalizeMascotState(eventBehavior.idle, DEFAULT_MASCOT_BEHAVIOR_SETTINGS.eventBehavior.idle),
    },
  };
}

export function loadMascotBehaviorSettings(storage: MascotStorage | undefined = currentStorage()): MascotBehaviorSettings {
  if (!storage) {
    return DEFAULT_MASCOT_BEHAVIOR_SETTINGS;
  }

  const saved = storage.getItem('zvd:mascot-behavior');
  if (!saved) {
    return DEFAULT_MASCOT_BEHAVIOR_SETTINGS;
  }

  try {
    return sanitizeMascotBehaviorSettings(JSON.parse(saved));
  } catch {
    return DEFAULT_MASCOT_BEHAVIOR_SETTINGS;
  }
}

export function saveMascotBehaviorSettings(
  settings: Partial<MascotBehaviorSettings>,
  storage: MascotStorage | undefined = currentStorage(),
): MascotBehaviorSettings {
  const sanitized = sanitizeMascotBehaviorSettings(settings);
  storage?.setItem('zvd:mascot-behavior', JSON.stringify(sanitized));
  return sanitized;
}

export function mascotLayoutForBehavior(settings: Partial<MascotBehaviorSettings> | null | undefined) {
  const sanitized = sanitizeMascotBehaviorSettings(settings);
  return MASCOT_SCALE_LAYOUTS[sanitized.scale];
}

export function mascotStateForDesktopEvent(
  input: {
    busy: boolean;
    input: string;
    transientState: MascotPetState | null;
    approvalsCount?: number;
    hasError?: boolean;
    runtimeRunning?: boolean;
    windowFocused?: boolean;
  },
  settings: Partial<MascotBehaviorSettings> | null | undefined = DEFAULT_MASCOT_BEHAVIOR_SETTINGS,
): MascotPetState {
  const behavior = sanitizeMascotBehaviorSettings(settings);
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
    return normalizeMascotState(input.transientState, behavior.eventBehavior.completed);
  }
  if (input.input.trim()) {
    return behavior.eventBehavior.composing;
  }
  if (input.windowFocused) {
    return behavior.eventBehavior.focused;
  }
  return behavior.eventBehavior.idle;
}

export function buildMascotEventCue(input: {
  approvalsCount: number;
  hasError: boolean;
  runtimeRunning: boolean;
  windowFocused: boolean;
  mode: MascotMode;
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

export function buildMascotSyncPayload(input: {
  skin?: MascotSkin;
  behaviorSettings?: MascotBehaviorSettings;
  animationState?: MascotPetState;
  animationConfig?: MascotAnimationConfig;
}): MascotOverlayStatePayload {
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

function normalizeMascotState(value: unknown, fallback: MascotPetState): MascotPetState {
  return Object.prototype.hasOwnProperty.call(DEFAULT_MASCOT_ANIMATIONS, String(value))
    ? value as MascotPetState
    : fallback;
}

function currentStorage(): MascotStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
