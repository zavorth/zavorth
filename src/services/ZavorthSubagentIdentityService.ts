export type ZavorthSubagentRuntimeStatus =
  | 'queued'
  | 'claimed'
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
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'approval-required';

export type ZavorthSubagentIconMotion = {
  active: boolean;
  kind:
    | 'none'
    | 'research-scan'
    | 'audit-border'
    | 'debug-cursor'
    | 'orchestrator-ring'
    | 'general-orbit'
    | 'mascot-sprite';
  frameCount: number;
  intervalMs: number;
  delayMs: number;
  className: string;
};

export type ZavorthSubagentActivityMode =
  | 'research'
  | 'audit'
  | 'debug'
  | 'orchestrate'
  | 'general'
  | 'core';

export type ZavorthSubagentIdentitySurface = {
  className: string;
  i18nKey: string;
  ariaLabel: string;
  title: string;
  statusToken: string;
  activityToken: string;
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
  activityMode: ZavorthSubagentActivityMode;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  motionState: ZavorthSubagentMotionState;
  animationSeed: number;
  motion: ZavorthSubagentIconMotion;
  statusGlyph: string;
  surface: ZavorthSubagentIdentitySurface;
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

const ZAVORTH_MASCOT_SVG = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Zavorth mascot" class="zv-mascot-svg">
  <defs>
    <linearGradient id="zvMascotGreen" x1="64" y1="64" x2="448" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2A5E2F"/>
      <stop offset="100%" stop-color="#3F7A42"/>
    </linearGradient>
  </defs>
  <g class="zvd-mascot-frame zvd-mascot-frame-0">${mascotFrame(0)}</g>
  <g class="zvd-mascot-frame zvd-mascot-frame-1">${mascotFrame(1)}</g>
  <g class="zvd-mascot-frame zvd-mascot-frame-2">${mascotFrame(2)}</g>
  <g class="zvd-mascot-frame zvd-mascot-frame-3">${mascotFrame(3)}</g>
  <g class="zvd-mascot-frame zvd-mascot-frame-4">${mascotFrame(4)}</g>
  <g class="zvd-mascot-frame zvd-mascot-frame-5">${mascotFrame(5)}</g>
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
  const activityMode = isMascot ? 'core' : activityModeForRole(roleId, label);
  const motion = buildIconMotion(isMascot, motionState, seed, activityMode);
  const statusGlyph = statusGlyphForMotionState(motionState);
  const surface = buildIdentitySurface({
    activityMode,
    displayName: `${scientist} (${label})`,
    motionState,
    statusGlyph,
  });
  const iconSvg = isMascot
    ? ZAVORTH_MASCOT_SVG
    : minidenticon(seed, 36, activityMode, motionState, statusGlyph);

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
    activityMode,
    status,
    motionState,
    animationSeed: Math.abs(seed),
    motion,
    statusGlyph,
    surface,
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
  if (status === 'queued' || status === 'claimed') return 'queued';
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
  activityMode: ZavorthSubagentActivityMode,
): ZavorthSubagentIconMotion {
  const active = motionState === 'running';
  const kind: ZavorthSubagentIconMotion['kind'] = active
    ? isMascot ? 'mascot-sprite' : motionKindForActivity(activityMode)
    : 'none';
  const intervalMs = isMascot ? 1800 : activityMode === 'debug' ? 680 : 820;

  return {
    active,
    kind,
    frameCount: isMascot ? 6 : 8,
    intervalMs,
    delayMs: active ? Math.abs(seed) % intervalMs : 0,
    className: kind === 'none' ? 'zvd-motion-static' : `zvd-motion-${kind}`,
  };
}

function motionKindForActivity(activityMode: ZavorthSubagentActivityMode): ZavorthSubagentIconMotion['kind'] {
  if (activityMode === 'research') return 'research-scan';
  if (activityMode === 'audit') return 'audit-border';
  if (activityMode === 'debug') return 'debug-cursor';
  if (activityMode === 'orchestrate') return 'orchestrator-ring';
  return 'general-orbit';
}

function activityModeForRole(roleId: string, label: string): ZavorthSubagentActivityMode {
  const text = `${roleId} ${label}`.toLowerCase();
  if (/\b(research|docs?|knowledge|scan|read|discover|codebase)\b/.test(text)) return 'research';
  if (/\b(audit\w*|security|secure|review|risk|policy|compliance|guard)\b/.test(text)) return 'audit';
  if (/\b(debug|test|qa|fix|runner|bug|trace|repair)\b/.test(text)) return 'debug';
  if (/\b(orchestrat\w*|coordinat\w*|dispatch\w*|planner|swarm|board|manager|lead)\b/.test(text)) return 'orchestrate';
  return 'general';
}

function statusGlyphForMotionState(motionState: ZavorthSubagentMotionState): string {
  if (motionState === 'queued') return '…';
  if (motionState === 'running') return '>';
  if (motionState === 'completed') return '✓';
  if (motionState === 'blocked') return '!';
  if (motionState === 'failed') return 'x';
  if (motionState === 'approval-required') return '?';
  return '-';
}

function buildIdentitySurface(input: {
  activityMode: ZavorthSubagentActivityMode;
  displayName: string;
  motionState: ZavorthSubagentMotionState;
  statusGlyph: string;
}): ZavorthSubagentIdentitySurface {
  const statusToken = input.motionState.replace(/[^a-z0-9-]/g, '-');
  const activityToken = input.activityMode.replace(/[^a-z0-9-]/g, '-');
  const i18nKey = `subagent.status.${statusToken}`;
  const title = `${input.displayName} · ${statusToken} · ${input.activityMode}`;

  return {
    className: `zvd-activity-${activityToken} zvd-status-${statusToken}`,
    i18nKey,
    ariaLabel: `${input.displayName} ${statusToken} ${input.statusGlyph}`,
    title,
    statusToken,
    activityToken,
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

function minidenticon(
  seed: number,
  size = 36,
  activityMode: ZavorthSubagentActivityMode = 'general',
  motionState: ZavorthSubagentMotionState = 'idle',
  statusGlyph = '-',
): string {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" aria-label="identicon" shape-rendering="crispEdges" class="zvd-identicon-svg zvd-activity-${activityMode} zvd-status-${motionState}"><g class="zvd-identicon-core">${rects}</g>${buildActivityMark(activityMode, cell, pad, color)}${buildStatusMark(motionState, statusGlyph, cell, pad, color)}${buildIdenticonMotionFrames(seed, cell, pad, activeColor, activityMode)}</svg>`;
}

function buildIdenticonMotionFrames(
  seed: number,
  cell: number,
  pad: number,
  color: string,
  activityMode: ZavorthSubagentActivityMode,
): string {
  const track = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [4, 1], [4, 2], [4, 3], [4, 4],
    [3, 4], [2, 4], [1, 4], [0, 4],
    [0, 3], [0, 2], [0, 1],
  ] as const;
  const step = Math.abs(seed) % 2 === 0 ? 2 : 3;
  const direction = Math.abs(seed) % 3 === 0 ? -1 : 1;

  return Array.from({ length: 8 }, (_, frame) => {
    const points = motionPointsForActivity(activityMode, frame, seed, track, step, direction);
    const rects = points.map(([col, row]) => (
      `<rect x="${pad + col * cell}" y="${pad + row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
    )).join('');
    return `<g class="zvd-identicon-motion-frame zvd-frame-${frame}" visibility="hidden">${rects}</g>`;
  }).join('');
}

function motionPointsForActivity(
  activityMode: ZavorthSubagentActivityMode,
  frame: number,
  seed: number,
  track: readonly (readonly [number, number])[],
  step: number,
  direction: number,
): Array<readonly [number, number]> {
  if (activityMode === 'research') {
    const row = wrapTrack(Math.abs(seed) + frame, 5);
    const start = frame % 3;
    return [[start, row], [start + 1, row], [start + 2, row]];
  }
  if (activityMode === 'audit') {
    const corners = [
      [[0, 0], [1, 0], [0, 1]],
      [[4, 0], [3, 0], [4, 1]],
      [[4, 4], [3, 4], [4, 3]],
      [[0, 4], [1, 4], [0, 3]],
    ] as const;
    return [...corners[frame % corners.length]];
  }
  if (activityMode === 'debug') {
    const cursor = frame % 4;
    const anchors = [[0, 0], [1, 1], [2, 2], [3, 3]] as const;
    const [col, row] = anchors[cursor] || anchors[0];
    return [[col, row], [col + 1, row], [col + 1, Math.min(4, row + 1)]];
  }
  if (activityMode === 'orchestrate') {
    const start = wrapTrack(Math.abs(seed) + frame * direction, track.length);
    return [0, 4, 8, 12].map((shift) => track[wrapTrack(start + shift, track.length)] || track[0]);
  }
  const start = wrapTrack(Math.abs(seed) + frame * step * direction, track.length);
  return [0, 1, 2].map((shift) => track[wrapTrack(start - shift * direction, track.length)] || track[0]);
}

function buildActivityMark(
  activityMode: ZavorthSubagentActivityMode,
  cell: number,
  pad: number,
  color: string,
): string {
  const rect = (col: number, row: number) => (
    `<rect x="${pad + col * cell}" y="${pad + row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
  );
  const marks: Record<ZavorthSubagentActivityMode, string> = {
    research: rect(1, 0) + rect(2, 0) + rect(3, 0),
    audit: rect(0, 0) + rect(4, 0) + rect(0, 4) + rect(4, 4),
    debug: rect(0, 2) + rect(1, 2) + rect(1, 3) + rect(2, 3),
    orchestrate: rect(2, 0) + rect(0, 2) + rect(2, 2) + rect(4, 2) + rect(2, 4),
    general: rect(2, 1) + rect(1, 2) + rect(3, 2) + rect(2, 3),
    core: rect(2, 2),
  };
  return `<g class="zvd-activity-mark zvd-activity-${activityMode}">${marks[activityMode] || marks.general}</g>`;
}

function buildStatusMark(
  motionState: ZavorthSubagentMotionState,
  statusGlyph: string,
  cell: number,
  pad: number,
  color: string,
): string {
  const rect = (col: number, row: number) => (
    `<rect x="${pad + col * cell}" y="${pad + row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
  );
  const marks: Record<ZavorthSubagentMotionState, string> = {
    idle: rect(4, 4),
    queued: rect(3, 3) + rect(4, 3) + rect(3, 4) + rect(4, 4),
    running: rect(4, 2) + rect(3, 3) + rect(4, 4),
    completed: rect(2, 4) + rect(3, 3) + rect(4, 2),
    failed: rect(3, 3) + rect(4, 4) + rect(4, 3) + rect(3, 4),
    blocked: rect(4, 2) + rect(4, 3) + rect(4, 4),
    'approval-required': rect(3, 3) + rect(4, 2) + rect(4, 4),
  };
  return `<g class="zvd-status-mark zvd-status-${motionState}" data-status-glyph="${escapeAttribute(statusGlyph)}">${marks[motionState] || marks.idle}</g>`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapTrack(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function mascotFrame(frame: number): string {
  const bob = frame === 1 || frame === 4 ? -8 : 0;
  const armRightY = 256 + bob + (frame === 1 ? -16 : frame === 5 ? 8 : 0);
  const armLeftY = 256 + bob + (frame === 4 ? -16 : frame === 2 ? 8 : 0);
  const footLeftY = 416 + (frame === 1 ? -16 : 0);
  const footRightY = 416 + (frame === 4 ? -16 : 0);
  const antennaY = 64 + bob;
  const bridgeY = 192 + bob;
  const bodyY = 192 + bob;
  const torsoY = 320 + bob;
  const eyeY = 240 + bob;
  const eyeHeight = frame === 3 ? 16 : 64;

  return `<rect x="128" y="${antennaY}" width="64" height="128" fill="url(#zvMascotGreen)"/>` +
    `<rect x="320" y="${antennaY}" width="64" height="128" fill="url(#zvMascotGreen)"/>` +
    `<rect x="192" y="${bridgeY}" width="128" height="64" fill="url(#zvMascotGreen)"/>` +
    `<rect x="64" y="${bodyY}" width="384" height="128" fill="url(#zvMascotGreen)"/>` +
    `<rect x="0" y="${armLeftY}" width="64" height="64" fill="url(#zvMascotGreen)"/>` +
    `<rect x="448" y="${armRightY}" width="64" height="64" fill="url(#zvMascotGreen)"/>` +
    `<rect x="64" y="${torsoY}" width="384" height="96" fill="url(#zvMascotGreen)"/>` +
    `<rect x="128" y="${footLeftY}" width="96" height="64" fill="url(#zvMascotGreen)"/>` +
    `<rect x="288" y="${footRightY}" width="96" height="64" fill="url(#zvMascotGreen)"/>` +
    `<rect x="160" y="${eyeY}" width="32" height="${eyeHeight}" fill="#000000"/>` +
    `<rect x="320" y="${eyeY}" width="32" height="${eyeHeight}" fill="#000000"/>`;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return hash;
}
