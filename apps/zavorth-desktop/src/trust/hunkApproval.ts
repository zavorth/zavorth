/**
 * Unified-diff hunk parsing and per-hunk approve/reject receipts.
 */

export type HunkDecision = 'pending' | 'approve' | 'reject';

export type DiffHunk = {
  id: string;
  path: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
  decision: HunkDecision;
};

export type HunkReceipt = {
  id: string;
  hunkId: string;
  path: string;
  decision: 'approve' | 'reject';
  at: string;
  summary: string;
};

const HUNK_HEADER_RE =
  /^@@\s+-(\d+)(?:,(\d+))...\s+\+(\d+)(?:,(\d+))...\s+@@(.*)$/;

function stripPathPrefix(raw: string): string {
  return raw.replace(/^[ab]\//, '').trim() || 'unknown';
}

function makeHunkId(path: string, newStart: number, newLines: number): string {
  return `${path}#${newStart}-${newStart + newLines}`;
}

function countSignedLines(lines: string[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
    else if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
  }
  return { added, removed };
}

/**
 * Parse a unified / git diff into independent DiffHunk rows.
 */
export function parseUnifiedDiff(text: string): DiffHunk[] {
  if (typeof text !== 'string' || !text.trim()) return [];

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const hunks: DiffHunk[] = [];

  let path = 'unknown';
  let pendingMinusPath: string | null = null;
  let current: DiffHunk | null = null;
  let body: string[] = [];

  const finishHunk = () => {
    if (!current) return;
    current.lines = body.slice();
    hunks.push(current);
    current = null;
    body = [];
  };

  for (const line of lines) {
    const gitMatch = /^diff --git a\/(.+...) b\/(.+)$/.exec(line);
    if (gitMatch) {
      finishHunk();
      path = stripPathPrefix(gitMatch[2] || gitMatch[1] || 'unknown');
      pendingMinusPath = null;
      continue;
    }

    const plusMatch = /^\+\+\+\s+(?:b\/)...(.+)$/.exec(line);
    if (plusMatch) {
      const candidate = plusMatch[1].trim();
      if (candidate === '/dev/null') {
        if (pendingMinusPath) path = pendingMinusPath;
      } else {
        path = stripPathPrefix(candidate);
      }
      continue;
    }

    const minusMatch = /^---\s+(?:a\/)...(.+)$/.exec(line);
    if (minusMatch) {
      const candidate = minusMatch[1].trim();
      if (candidate !== '/dev/null') {
        pendingMinusPath = stripPathPrefix(candidate);
        if (path === 'unknown') path = pendingMinusPath;
      }
      continue;
    }

    if (line.startsWith('@@')) {
      finishHunk();
      const match = HUNK_HEADER_RE.exec(line);
      const oldStart = match ? Number(match[1]) || 0 : 0;
      const oldLines = match && match[2] != null ? Number(match[2]) : 1;
      const newStart = match ? Number(match[3]) || 0 : 0;
      const newLines = match && match[4] != null ? Number(match[4]) : 1;
      current = {
        id: makeHunkId(path, newStart, newLines),
        path,
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
        decision: 'pending',
      };
      body = [];
      continue;
    }

    if (!current) continue;

    // Hunk body: context, add, remove, or no-newline markers
    if (
      line.startsWith('+') ||
      line.startsWith('-') ||
      line.startsWith(' ') ||
      line.startsWith('\\') ||
      line === ''
    ) {
      body.push(line);
    }
  }

  finishHunk();
  return hunks;
}

export function looksLikeUnifiedDiff(text: string): boolean {
  if (typeof text !== 'string' || !text.includes('@@')) return false;
  return /(^|\n)(diff --git |@@\s+-|\+\+\+ |\-\-\- )/.test(text);
}

export function applyHunkDecision(
  hunks: DiffHunk[],
  hunkId: string,
  decision: 'approve' | 'reject',
): DiffHunk[] {
  return hunks.map(hunk =>
    hunk.id === hunkId ? { ...hunk, decision } : hunk,
  );
}

export function applyAllPending(
  hunks: DiffHunk[],
  decision: 'approve' | 'reject',
): DiffHunk[] {
  return hunks.map(hunk =>
    hunk.decision === 'pending' ? { ...hunk, decision } : hunk,
  );
}

export function pendingHunkCount(hunks: DiffHunk[]): number {
  return hunks.filter(hunk => hunk.decision === 'pending').length;
}

export function summarizeHunkDecisions(hunks: DiffHunk[]): {
  approved: number;
  rejected: number;
  pending: number;
} {
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  for (const hunk of hunks) {
    if (hunk.decision === 'approve') approved += 1;
    else if (hunk.decision === 'reject') rejected += 1;
    else pending += 1;
  }
  return { approved, rejected, pending };
}

export function filterDiffByDecisions(
  hunks: DiffHunk[],
  filter: HunkDecision | 'decided',
): DiffHunk[] {
  if (filter === 'decided') {
    return hunks.filter(h => h.decision === 'approve' || h.decision === 'reject');
  }
  return hunks.filter(h => h.decision === filter);
}

export function buildHunkReceipt(
  hunk: DiffHunk,
  decision: 'approve' | 'reject',
  now: Date = new Date(),
): HunkReceipt {
  const { added, removed } = countSignedLines(hunk.lines);
  const verb = decision === 'approve' ? 'Approved' : 'Rejected';
  return {
    id: `receipt:${hunk.id}:${decision}`,
    hunkId: hunk.id,
    path: hunk.path,
    decision,
    at: now.toISOString(),
    summary: `${verb} ${hunk.path} (+${added}/-${removed})`,
  };
}
