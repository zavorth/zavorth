/**
 * Review rail model: diff tree + ship bar derived from git status and receipts.
 */

export type ReviewFileRow = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'unknown';
  additions?: number;
  deletions?: number;
};

export type ReviewShipBar = {
  canShip: boolean;
  dirty: boolean;
  branch: string;
  fileCount: number;
  receiptCount: number;
  primaryAction: 'commit' | 'review' | 'clean';
  label: string;
};

export type ReviewRailModel = {
  files: ReviewFileRow[];
  ship: ReviewShipBar;
  selectedPath: string | null;
};

const STATUS_FROM_CODE: Record<string, ReviewFileRow['status']> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'added',
  '...': 'added',
  U: 'modified',
};

function normalizeStatus(raw: string | undefined): ReviewFileRow['status'] {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (value === 'modified' || value === 'm' || value === 'changed') return 'modified';
  if (value === 'added' || value === 'a' || value === 'new' || value === 'untracked') return 'added';
  if (value === 'deleted' || value === 'd' || value === 'removed') return 'deleted';
  if (value === 'renamed' || value === 'r') return 'renamed';
  if (value === 'unknown') return 'unknown';
  // porcelain-ish short codes
  const code = value.toUpperCase()[0];
  return STATUS_FROM_CODE[code] || 'unknown';
}

function statusFromPorcelainXY(xy: string): ReviewFileRow['status'] {
  const index = xy[0] || ' ';
  const worktree = xy[1] || ' ';
  // Prefer the more "severe" / informative side
  const candidates = [index, worktree].filter(c => c && c !== ' ');
  if (candidates.includes('D')) return 'deleted';
  if (candidates.includes('R')) return 'renamed';
  if (candidates.includes('A') || candidates.includes('...') || candidates.includes('C')) return 'added';
  if (candidates.includes('M') || candidates.includes('U')) return 'modified';
  if (candidates.length > 0) {
    return STATUS_FROM_CODE[candidates[0]] || 'unknown';
  }
  return 'unknown';
}

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parsePorcelainLine(line: string): ReviewFileRow | null {
  const raw = line.trimEnd();
  if (!raw || raw.startsWith('##')) {
    return null;
  }
  // Porcelain v1: XY<path> where XY are two status chars and path starts at index 3
  if (raw.length < 4) {
    return null;
  }
  const xy = raw.slice(0, 2);
  const rest = raw.slice(3).trim();
  if (!rest) {
    return null;
  }
  const renameParts = rest.split(/\s+->\s+/);
  const path = unquoteGitPath(renameParts[renameParts.length - 1] || '');
  if (!path) {
    return null;
  }
  return {
    path,
    status: statusFromPorcelainXY(xy),
  };
}

function parseGitStatusText(text: string | null | undefined): ReviewFileRow[] {
  if (!text) {
    return [];
  }
  const rows: ReviewFileRow[] = [];
  const seen = new Set<string>();
  for (const line of String(text).split(/\r...\n/)) {
    const row = parsePorcelainLine(line);
    if (!row || seen.has(row.path)) continue;
    seen.add(row.path);
    rows.push(row);
  }
  return rows;
}

function mapChangedFiles(
  files: Array<{ path: string; status?: string; additions?: number; deletions?: number }>,
): ReviewFileRow[] {
  const rows: ReviewFileRow[] = [];
  const seen = new Set<string>();
  for (const file of files || []) {
    const path = String(file?.path || '').trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const row: ReviewFileRow = {
      path,
      status: normalizeStatus(file.status),
    };
    if (typeof file.additions === 'number' && Number.isFinite(file.additions)) {
      row.additions = file.additions;
    }
    if (typeof file.deletions === 'number' && Number.isFinite(file.deletions)) {
      row.deletions = file.deletions;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Prefer structured `changedFiles` when present; otherwise parse porcelain `gitStatusText`.
 * When both are provided, structured files win and porcelain fills gaps for unknown paths.
 */
export function buildReviewFileRows(input: {
  changedFiles?: Array<{ path: string; status?: string; additions?: number; deletions?: number }>;
  gitStatusText?: string | null;
}): ReviewFileRow[] {
  const fromStructured = mapChangedFiles(input.changedFiles || []);
  if (fromStructured.length > 0) {
    if (!input.gitStatusText) {
      return fromStructured;
    }
    const fromPorcelain = parseGitStatusText(input.gitStatusText);
    const seen = new Set(fromStructured.map(r => r.path));
    const merged = fromStructured.slice();
    for (const row of fromPorcelain) {
      if (!seen.has(row.path)) {
        seen.add(row.path);
        merged.push(row);
      }
    }
    return merged;
  }
  return parseGitStatusText(input.gitStatusText);
}

export function buildReviewShipBar(input: {
  branch?: string;
  dirty?: boolean;
  files: ReviewFileRow[];
  recentReceiptCount?: number;
}): ReviewShipBar {
  const files = input.files || [];
  const fileCount = files.length;
  const receiptCount = Math.max(0, Math.floor(Number(input.recentReceiptCount) || 0));
  const branch = String(input.branch || '').trim() || 'HEAD';
  const dirty = typeof input.dirty === 'boolean' ? input.dirty : fileCount > 0;

  if (!dirty && fileCount === 0) {
    return {
      canShip: false,
      dirty: false,
      branch,
      fileCount: 0,
      receiptCount,
      primaryAction: 'clean',
      label: 'Working tree clean',
    };
  }

  if (receiptCount > 0 && fileCount > 0) {
    return {
      canShip: true,
      dirty: true,
      branch,
      fileCount,
      receiptCount,
      primaryAction: 'review',
      label: `Review ${fileCount} file${fileCount === 1 ? '' : 's'}`,
    };
  }

  if (fileCount > 0) {
    return {
      canShip: true,
      dirty: true,
      branch,
      fileCount,
      receiptCount,
      primaryAction: 'commit',
      label: `Commit ${fileCount} file${fileCount === 1 ? '' : 's'}`,
    };
  }

  // Dirty without listed files (e.g. index-only dirtiness)
  return {
    canShip: true,
    dirty: true,
    branch,
    fileCount: 0,
    receiptCount,
    primaryAction: 'commit',
    label: 'Commit changes',
  };
}

export function buildReviewRailModel(input: {
  branch?: string;
  dirty?: boolean;
  changedFiles?: Array<{ path: string; status?: string; additions?: number; deletions?: number }>;
  gitStatusText?: string | null;
  recentReceiptCount?: number;
  selectedPath?: string | null;
}): ReviewRailModel {
  const files = buildReviewFileRows({
    changedFiles: input.changedFiles,
    gitStatusText: input.gitStatusText,
  });
  const ship = buildReviewShipBar({
    branch: input.branch,
    dirty: input.dirty,
    files,
    recentReceiptCount: input.recentReceiptCount,
  });

  const requested = input.selectedPath == null ? null : String(input.selectedPath);
  let selectedPath: string | null = null;
  if (requested && files.some(f => f.path === requested)) {
    selectedPath = requested;
  } else if (files.length > 0) {
    selectedPath = files[0].path;
  }

  return { files, ship, selectedPath };
}
