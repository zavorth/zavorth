export type ZavorthSubagentRuntimeStatus =
  | 'ready'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'approval-required'
  | 'denied'
  | 'blocked'
  | 'not-found';

export type ZavorthSubagentMotionState =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'approval-required';

export type ZavorthSubagentVisualIdentity = {
  id: string;
  roleId: string;
  sessionId: string;
  label: string;
  displayName: string;
  glyph: string;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  motionState: ZavorthSubagentMotionState;
  animationSeed: number;
  palette: {
    accent: string;
    muted: string;
    glow: string;
  };
  iconFrames: string[];
};

export type ZavorthSubagentIdentityInput = {
  roleId: string;
  sessionId: string;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  label?: string | null;
};

export type ZavorthDecoratedSubagentRole = {
  id: string;
  label: string;
  identity: ZavorthSubagentVisualIdentity;
};

const SCIENTISTS = [
  'Ohm', 'Peirce', 'Boyle', 'Turing', 'Noether',
  'Curie', 'Planck', 'Faraday', 'Tesla', 'Darwin',
  'Euler', 'Gauss', 'Newton', 'Kepler', 'Hubble',
  'Maxwell', 'Dirac', 'Feynman', 'Lovelace', 'Hopper',
] as const;

const PALETTES = [
  { accent: '#f16a21', muted: '#7c3f20', glow: '#ffb86b' },
  { accent: '#38bdf8', muted: '#155e75', glow: '#a5f3fc' },
  { accent: '#a78bfa', muted: '#4c1d95', glow: '#ddd6fe' },
  { accent: '#22c55e', muted: '#14532d', glow: '#bbf7d0' },
  { accent: '#eab308', muted: '#713f12', glow: '#fef08a' },
  { accent: '#fb7185', muted: '#881337', glow: '#ffe4e6' },
] as const;

const GLYPH_ALPHABET = 'ZVHRTMXKQ7';

export function getSubagentScientistName(roleId: string, sessionId: string): string {
  const index = Math.abs(stableHash(`${roleId}:${sessionId}`) % SCIENTISTS.length);
  return SCIENTISTS[index] || 'Turing';
}

export function buildSubagentIdentity(input: ZavorthSubagentIdentityInput): ZavorthSubagentVisualIdentity {
  const roleId = normalizePart(input.roleId, 'agent');
  const sessionId = normalizePart(input.sessionId, 'session');
  const label = normalizeLabel(input.label, roleId);
  const seed = stableHash(`${sessionId}:${roleId}`);
  const scientist = getSubagentScientistName(roleId, sessionId);
  const palette = PALETTES[Math.abs(seed % PALETTES.length)] || PALETTES[0];
  const glyph = buildGlyph(seed);
  const status = input.status || 'idle';
  const motionState = motionStateForStatus(status);
  const iconFrames = buildIconFrames(glyph, seed);

  return {
    id: `${sessionId}:${roleId}`,
    roleId,
    sessionId,
    label,
    displayName: `${scientist} (${label})`,
    glyph,
    status,
    motionState,
    animationSeed: Math.abs(seed),
    palette: { ...palette },
    iconFrames,
  };
}

export function decorateSubagentRole(input: ZavorthSubagentIdentityInput): ZavorthDecoratedSubagentRole {
  const identity = buildSubagentIdentity(input);
  return {
    id: identity.roleId,
    label: identity.displayName,
    identity,
  };
}

export function buildSubagentIconFrame(identity: ZavorthSubagentVisualIdentity, frame: number): string {
  if (identity.motionState !== 'running') {
    return identity.iconFrames[0] || identity.glyph;
  }
  return identity.iconFrames[Math.abs(frame) % identity.iconFrames.length] || identity.glyph;
}

function normalizePart(value: string, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeLabel(value: string | null | undefined, roleId: string): string {
  const label = String(value || '').trim();
  if (label) return label;
  return roleId
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Agent';
}

function motionStateForStatus(status: ZavorthSubagentRuntimeStatus | 'idle'): ZavorthSubagentMotionState {
  if (status === 'running' || status === 'ready') return 'running';
  if (status === 'completed' || status === 'cancelled') return 'completed';
  if (status === 'failed' || status === 'denied' || status === 'not-found') return 'failed';
  if (status === 'approval-required') return 'approval-required';
  if (status === 'blocked') return 'blocked';
  return 'idle';
}

function buildGlyph(seed: number): string {
  const a = GLYPH_ALPHABET[Math.abs(seed) % GLYPH_ALPHABET.length] || 'Z';
  const b = GLYPH_ALPHABET[Math.abs(Math.floor(seed / GLYPH_ALPHABET.length)) % GLYPH_ALPHABET.length] || 'V';
  return `${a}${b}`;
}

function buildIconFrames(glyph: string, seed: number): string[] {
  const left = glyph[0] || 'Z';
  const right = glyph[1] || 'V';
  const spark = Math.abs(seed) % 2 === 0 ? '·' : '•';
  return [
    `▟${left}${right}▙`,
    `▙${left}${spark}▟`,
    `▜${spark}${right}▛`,
    `▛${left}${right}▜`,
  ];
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash;
}
