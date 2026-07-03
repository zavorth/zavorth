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

export type ZavorthSubagentIconMotion = {
  active: boolean;
  kind: 'none' | 'identicon-frames' | 'mascot-sprite';
  frameCount: number;
  intervalMs: number;
  delayMs: number;
  className: string;
};

export type ZavorthSubagentVisualIdentity = {
  id: string;
  roleId: string;
  sessionId: string;
  label: string;
  displayName: string;
  identiconSeed: string;
  glyph: string;
  iconSvg: string;
  isMascot: boolean;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  motionState: ZavorthSubagentMotionState;
  animationSeed: number;
  motion: ZavorthSubagentIconMotion;
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
const ZAVORTH_NAMES = new Set(['zavorth', 'zvd', 'zv', 'zavorth-desktop', 'zavorth-agent']);

const ZAVORTH_MASCOT_SVG = `<svg width="36" height="36" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Zavorth mascot" class="zv-mascot-svg">
  <defs>
    <linearGradient id="zvMascotGreen" x1="64" y1="64" x2="448" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2A5E2F"/>
      <stop offset="100%" stop-color="#3F7A42"/>
    </linearGradient>
  </defs>
  ${mascotFrame(0)}
</svg>`;

export function getSubagentScientistName(roleId: string, sessionId: string): string {
  const index = Math.abs(stableHash(`${roleId}:${sessionId}`) % SCIENTISTS.length);
  return SCIENTISTS[index] || 'Turing';
}

export function buildSubagentIdentity(input: ZavorthSubagentIdentityInput): ZavorthSubagentVisualIdentity {
  const roleId = normalizePart(input.roleId, 'agent');
  const sessionId = normalizePart(input.sessionId, 'session');
  const label = normalizeLabel(input.label, roleId);
  const identiconSeed = `${sessionId}:${roleId}`;
  const seed = stableHash(identiconSeed);
  const scientist = getSubagentScientistName(roleId, sessionId);
  const palette = PALETTES[Math.abs(seed % PALETTES.length)] || PALETTES[0];
  const glyph = buildGlyph(seed);
  const status = input.status || 'idle';
  const motionState = motionStateForStatus(status);
  const iconFrames = buildIconFrames(glyph, seed);
  const isMascot = isZavorthMascotName(roleId)
    || isZavorthMascotName(label)
    || isZavorthMascotName(sessionId);
  const motion = buildIconMotion(isMascot, motionState, seed);
  const iconSvg = isMascot ? ZAVORTH_MASCOT_SVG : minidenticon(seed);

  return {
    id: `${sessionId}:${roleId}`,
    roleId,
    sessionId,
    label,
    displayName: `${scientist} (${label})`,
    identiconSeed,
    glyph,
    iconSvg,
    isMascot,
    status,
    motionState,
    animationSeed: Math.abs(seed),
    motion,
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
  const offset = frame + identity.animationSeed;
  return identity.iconFrames[Math.abs(offset) % identity.iconFrames.length] || identity.glyph;
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
  if (status === 'running') return 'running';
  if (status === 'ready') return 'idle';
  if (status === 'completed' || status === 'cancelled') return 'completed';
  if (status === 'failed' || status === 'denied' || status === 'not-found') return 'failed';
  if (status === 'approval-required') return 'approval-required';
  if (status === 'blocked') return 'blocked';
  return 'idle';
}

function buildIconMotion(
  isMascot: boolean,
  motionState: ZavorthSubagentMotionState,
  seed: number,
): ZavorthSubagentIconMotion {
  const active = motionState === 'running';
  const kind: ZavorthSubagentIconMotion['kind'] = active
    ? isMascot ? 'mascot-sprite' : 'identicon-frames'
    : 'none';
  const intervalMs = isMascot ? 1800 : 760;

  return {
    active,
    kind,
    frameCount: 4,
    intervalMs,
    delayMs: active ? Math.abs(seed) % intervalMs : 0,
    className: kind === 'none' ? 'zvd-motion-static' : `zvd-motion-${kind}`,
  };
}

function isZavorthMascotName(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return ZAVORTH_NAMES.has(normalized) || ZAVORTH_NAMES.has(compact);
}

function buildGlyph(seed: number): string {
  const a = GLYPH_ALPHABET[Math.abs(seed) % GLYPH_ALPHABET.length] || 'Z';
  const b = GLYPH_ALPHABET[Math.abs(Math.floor(seed / GLYPH_ALPHABET.length)) % GLYPH_ALPHABET.length] || 'V';
  return `${a}${b}`;
}

function buildIconFrames(glyph: string, seed: number): string[] {
  const left = glyph[0] || 'Z';
  const right = glyph[1] || 'V';
  const spark = Math.abs(seed) % 2 === 0 ? '.' : '*';
  return [
    `[${left}${right}]`,
    `{${left}${spark}}`,
    `<${spark}${right}>`,
    `{${left}${right}}`,
  ];
}

function minidenticon(seed: number, size = 36): string {
  const hue = Math.abs(seed) % 360;
  const sat = 58 + (Math.abs(seed >> 8) % 28);
  const lit = 44 + (Math.abs(seed >> 16) % 16);
  const color = `hsl(${hue},${sat}%,${lit}%)`;
  const activeColor = color;
  const cells = 5;
  const cell = 6;
  const pad = 3;
  const total = cells * cell + pad * 2;

  let rects = '';
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col <= Math.floor(cells / 2); col += 1) {
      const bit = (Math.abs(seed) >> (row * 3 + col)) & 1;
      if (bit) {
        const x1 = pad + col * cell;
        const x2 = pad + (cells - 1 - col) * cell;
        const y = pad + row * cell;
        rects += `<rect x="${x1}" y="${y}" width="${cell}" height="${cell}" fill="${color}"/>`;
        if (x1 !== x2) {
          rects += `<rect x="${x2}" y="${y}" width="${cell}" height="${cell}" fill="${color}"/>`;
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="identicon" shape-rendering="crispEdges" class="zvd-identicon-svg"><g class="zvd-identicon-core">${rects}</g>${buildIdenticonMotionFrames(seed, cell, pad, activeColor)}</svg>`;
}

function buildIdenticonMotionFrames(seed: number, cell: number, pad: number, color: string): string {
  const track = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [4, 1], [4, 2], [4, 3], [4, 4],
    [3, 4], [2, 4], [1, 4], [0, 4],
    [0, 3], [0, 2], [0, 1],
  ] as const;
  const frameStep = 3 + (Math.abs(seed) % 3);

  return Array.from({ length: 4 }, (_, frame) => {
    const points = [0, 6, 11].map((shift) => track[(Math.abs(seed) + frame * frameStep + shift) % track.length]);
    const rects = points
      .map(([col, row]) => `<rect x="${pad + col * cell}" y="${pad + row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`)
      .join('');
    return `<g class="zvd-identicon-motion-frame zvd-frame-${frame}" opacity="0">${rects}</g>`;
  }).join('');
}

function mascotFrame(frame: number): string {
  const armRightY = frame === 1 ? 224 : 256;
  const armLeftY = frame === 2 ? 224 : 256;
  const footLeftY = frame === 1 ? 384 : 416;
  const footRightY = frame === 2 ? 384 : 416;
  const eyeHeight = frame === 3 ? 16 : 64;

  return `<rect x="128" y="64" width="64" height="128" fill="url(#zvMascotGreen)"/><rect x="320" y="64" width="64" height="128" fill="url(#zvMascotGreen)"/><rect x="192" y="192" width="128" height="64" fill="url(#zvMascotGreen)"/><rect x="64" y="192" width="384" height="128" fill="url(#zvMascotGreen)"/><rect x="0" y="${armLeftY}" width="64" height="64" fill="url(#zvMascotGreen)"/><rect x="448" y="${armRightY}" width="64" height="64" fill="url(#zvMascotGreen)"/><rect x="64" y="320" width="384" height="96" fill="url(#zvMascotGreen)"/><rect x="128" y="${footLeftY}" width="96" height="64" fill="url(#zvMascotGreen)"/><rect x="288" y="${footRightY}" width="96" height="64" fill="url(#zvMascotGreen)"/><rect x="160" y="240" width="32" height="${eyeHeight}" fill="#000000"/><rect x="320" y="240" width="32" height="${eyeHeight}" fill="#000000"/>`;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash;
}
