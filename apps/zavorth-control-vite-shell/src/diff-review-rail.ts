/**
 * Trust-rail UI for unified-diff hunk review (approve / reject per hunk).
 * Pure DOM — no React, no desktop imports.
 */

export type DiffHunkStatus = 'pending' | 'approved' | 'rejected';
export type HunkDecision = 'approve' | 'reject';

export type DiffHunk = {
  id: string;
  filePath: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
  addedLines: number;
  removedLines: number;
  status: DiffHunkStatus;
};

export type DiffReviewMeta = {
  file?: string;
  title?: string;
  runId?: string;
  sessionId?: string;
  artifactId?: string;
};

type DiffDecisionDetail = {
  decision: HunkDecision | 'approve-all';
  hunkId: string | null;
  filePath: string;
  header: string;
  prompt: string;
  meta: DiffReviewMeta;
  summary: { pending: number; approved: number; rejected: number; total: number };
};

const HUNK_HEADER_RE =
  /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

let railRoot: HTMLElement | null = null;
let hunks: DiffHunk[] = [];
let activeMeta: DiffReviewMeta = {};
let boundClick = false;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseHunkHeader(header: string) {
  const match = HUNK_HEADER_RE.exec(header);
  if (!match) return null;
  return {
    oldStart: Number(match[1]) || 0,
    oldLines: match[2] != null ? Number(match[2]) : 1,
    newStart: Number(match[3]) || 0,
    newLines: match[4] != null ? Number(match[4]) : 1,
  };
}

/** True when text looks like a unified or git diff with at least one hunk. */
export function looksLikeUnifiedDiff(text: string): boolean {
  if (typeof text !== 'string' || !text.includes('@@')) return false;
  return /(^|\n)(diff --git |@@\s+-|\+\+\+ b\/|--- a\/)/.test(text);
}

/**
 * Parse a unified / git diff into independent DiffHunk rows.
 * Empty or non-diff input returns [].
 */
export function parseUnifiedDiff(
  text: string,
  options?: { reviewId?: string; defaultFile?: string },
): DiffHunk[] {
  if (typeof text !== 'string' || !text.trim()) return [];

  const reviewId = (options?.reviewId && options.reviewId.trim()) || 'diff';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: DiffHunk[] = [];

  let filePath = String(options?.defaultFile || '').trim() || 'unknown';
  let fileIndex = 0;
  let hunkInFile = 0;
  let current: DiffHunk | null = null;
  let body: string[] = [];

  const finishHunk = () => {
    if (!current) return;
    current.lines = body.slice();
    out.push(current);
    current = null;
    body = [];
  };

  for (const line of lines) {
    const gitMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (gitMatch) {
      finishHunk();
      filePath = gitMatch[2] || gitMatch[1] || 'unknown';
      fileIndex += 1;
      hunkInFile = 0;
      continue;
    }

    const plusMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plusMatch) {
      filePath = plusMatch[1] || filePath;
      if (fileIndex === 0) fileIndex = 1;
      continue;
    }

    const minusMatch = /^--- a\/(.+)$/.exec(line);
    if (minusMatch && (filePath === 'unknown' || !filePath)) {
      filePath = minusMatch[1];
      if (fileIndex === 0) fileIndex = 1;
      continue;
    }

    if (line.startsWith('@@')) {
      finishHunk();
      const meta = parseHunkHeader(line) || {
        oldStart: 0,
        oldLines: 0,
        newStart: 0,
        newLines: 0,
      };
      hunkInFile += 1;
      const safeFile = Math.max(fileIndex, 1);
      current = {
        id: `${reviewId}:file-${safeFile}:hunk-${hunkInFile}`,
        filePath,
        header: line,
        oldStart: meta.oldStart,
        oldLines: meta.oldLines,
        newStart: meta.newStart,
        newLines: meta.newLines,
        lines: [],
        addedLines: 0,
        removedLines: 0,
        status: 'pending',
      };
      body = [];
      continue;
    }

    if (!current) continue;

    body.push(line);
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.addedLines += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.removedLines += 1;
    }
  }

  finishHunk();
  return out;
}

export function summarizeHunkDecisions(list: DiffHunk[]) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const hunk of list) {
    if (hunk.status === 'approved') approved += 1;
    else if (hunk.status === 'rejected') rejected += 1;
    else pending += 1;
  }
  return { pending, approved, rejected, total: list.length };
}

function draftDecisionPrompt(
  decision: HunkDecision | 'approve-all',
  hunk: DiffHunk | null,
  meta: DiffReviewMeta,
): string {
  const fileHint = hunk?.filePath || meta.file || 'the current file';
  if (decision === 'approve-all') {
    return `Approve all pending hunks in the current diff for ${fileHint}. Apply only the approved changes and keep rejected hunks out.`;
  }
  if (!hunk) {
    return decision === 'approve'
      ? `Approve the pending diff for ${fileHint}.`
      : `Reject the pending diff for ${fileHint}. Do not apply these changes.`;
  }
  const headerShort = hunk.header.length > 80 ? `${hunk.header.slice(0, 77)}...` : hunk.header;
  if (decision === 'approve') {
    return `Approve this hunk in ${hunk.filePath}: ${headerShort}. Keep other pending hunks unchanged until I decide.`;
  }
  return `Reject this hunk in ${hunk.filePath}: ${headerShort}. Do not apply this hunk; leave other pending hunks for review.`;
}

function emitToast(type: string, title: string, detail: string) {
  try {
    window.emitSignal?.(type, title, detail);
  } catch {
    // optional surface
  }
}

function dispatchDecision(detail: DiffDecisionDetail) {
  try {
    window.dispatchEvent(new CustomEvent('zavorth-diff-decision', { detail }));
  } catch {
    // ignore
  }

  const compose = document.getElementById('compose-input') as HTMLTextAreaElement | HTMLInputElement | null;
  if (compose && detail.prompt) {
    compose.value = detail.prompt;
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    try {
      compose.focus();
    } catch {
      // ignore
    }
  }

  const label =
    detail.decision === 'approve-all'
      ? 'All pending hunks approved'
      : detail.decision === 'approve'
        ? 'Hunk approved'
        : 'Hunk rejected';
  emitToast(
    detail.decision === 'reject' ? 'info' : 'success',
    label,
    detail.hunkId
      ? `${detail.filePath} · ${detail.header}`
      : `${detail.summary.approved} approved · ${detail.summary.rejected} rejected · ${detail.summary.pending} pending`,
  );
}

function lineClass(line: string) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-line diff-line--add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'diff-line diff-line--del';
  if (line.startsWith('\\')) return 'diff-line diff-line--meta';
  return 'diff-line diff-line--ctx';
}

function renderLine(line: string) {
  const display = line.length > 240 ? `${line.slice(0, 237)}...` : line;
  return `<div class="${lineClass(line)}"><code>${escapeHtml(display || ' ')}</code></div>`;
}

function renderHunkCard(hunk: DiffHunk) {
  const pending = hunk.status === 'pending';
  const statusLabel =
    hunk.status === 'approved' ? 'Approved' : hunk.status === 'rejected' ? 'Rejected' : 'Pending';
  const statusClass =
    hunk.status === 'approved'
      ? 'diff-hunk--approved'
      : hunk.status === 'rejected'
        ? 'diff-hunk--rejected'
        : 'diff-hunk--pending';
  const approvePrompt = draftDecisionPrompt('approve', hunk, activeMeta);
  const rejectPrompt = draftDecisionPrompt('reject', hunk, activeMeta);
  const body = hunk.lines.map(renderLine).join('') || `<div class="diff-line diff-line--meta"><code>(empty hunk)</code></div>`;

  return `
    <article class="diff-hunk ${statusClass}" data-hunk-id="${escapeHtml(hunk.id)}" data-hunk-status="${hunk.status}">
      <header class="diff-hunk__header">
        <div class="diff-hunk__meta">
          <span class="diff-hunk__file">${escapeHtml(hunk.filePath)}</span>
          <span class="diff-hunk__range">${escapeHtml(hunk.header)}</span>
        </div>
        <div class="diff-hunk__stats">
          <span class="diff-hunk__add">+${hunk.addedLines}</span>
          <span class="diff-hunk__del">−${hunk.removedLines}</span>
          <span class="diff-hunk__status" data-hunk-status-label>${statusLabel}</span>
        </div>
      </header>
      <div class="diff-hunk__body" role="region" aria-label="Hunk lines">
        ${body}
      </div>
      <footer class="diff-hunk__actions">
        <button
          type="button"
          class="diff-hunk__btn diff-hunk__btn--reject"
          data-diff-hunk-action="reject"
          data-hunk-id="${escapeHtml(hunk.id)}"
          data-prompt="${escapeHtml(rejectPrompt)}"
          ${pending ? '' : 'disabled'}
        >Reject hunk</button>
        <button
          type="button"
          class="diff-hunk__btn diff-hunk__btn--approve"
          data-diff-hunk-action="approve"
          data-hunk-id="${escapeHtml(hunk.id)}"
          data-prompt="${escapeHtml(approvePrompt)}"
          ${pending ? '' : 'disabled'}
        >Approve hunk</button>
      </footer>
    </article>
  `;
}

function renderRailHtml() {
  const summary = summarizeHunkDecisions(hunks);
  const title = activeMeta.title || activeMeta.file || 'Diff review';
  const fileLine = activeMeta.file
    ? `<div class="diff-review-rail__file">${escapeHtml(activeMeta.file)}</div>`
    : '';
  const pending = summary.pending;
  const approveAllPrompt = draftDecisionPrompt('approve-all', null, activeMeta);

  if (hunks.length === 0) {
    return `
      <div class="diff-review-rail__toolbar">
        <div class="diff-review-rail__heading">
          <span class="diff-review-rail__eyebrow">Trust rail</span>
          <strong class="diff-review-rail__title">${escapeHtml(title)}</strong>
          ${fileLine}
        </div>
      </div>
      <div class="diff-review-rail__empty" data-diff-empty>
        <div class="diff-review-rail__empty-title">No pending diff</div>
        <div class="diff-review-rail__empty-desc">Open a patch or artifact with unified-diff text to review hunks here.</div>
      </div>
    `;
  }

  return `
    <div class="diff-review-rail__toolbar">
      <div class="diff-review-rail__heading">
        <span class="diff-review-rail__eyebrow">Trust rail</span>
        <strong class="diff-review-rail__title">${escapeHtml(title)}</strong>
        ${fileLine}
        <div class="diff-review-rail__summary">
          <span>${summary.total} hunk${summary.total === 1 ? '' : 's'}</span>
          <span data-diff-pending-count>${pending} pending</span>
          <span>${summary.approved} approved</span>
          <span>${summary.rejected} rejected</span>
        </div>
      </div>
      <div class="diff-review-rail__toolbar-actions">
        <button
          type="button"
          class="diff-hunk__btn diff-hunk__btn--approve-all"
          data-diff-hunk-action="approve-all"
          data-prompt="${escapeHtml(approveAllPrompt)}"
          ${pending === 0 ? 'disabled' : ''}
        >Approve all pending</button>
      </div>
    </div>
    <div class="diff-review-rail__list">
      ${hunks.map(renderHunkCard).join('')}
    </div>
  `;
}

function paint() {
  const root = ensureRailMount();
  if (!root) return;
  root.innerHTML = renderRailHtml();
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  root.classList.add('is-active');
}

function applyDecision(hunkId: string | null, decision: HunkDecision | 'approve-all') {
  if (decision === 'approve-all') {
    hunks = hunks.map((hunk) =>
      hunk.status === 'pending' ? { ...hunk, status: 'approved' as const } : hunk,
    );
  } else if (hunkId) {
    const status: DiffHunkStatus = decision === 'approve' ? 'approved' : 'rejected';
    hunks = hunks.map((hunk) => (hunk.id === hunkId ? { ...hunk, status } : hunk));
  }

  const hunk = hunkId ? hunks.find((entry) => entry.id === hunkId) || null : null;
  const summary = summarizeHunkDecisions(hunks);
  const prompt = draftDecisionPrompt(decision, hunk, activeMeta);

  paint();

  dispatchDecision({
    decision,
    hunkId,
    filePath: hunk?.filePath || activeMeta.file || 'unknown',
    header: hunk?.header || '',
    prompt,
    meta: { ...activeMeta },
    summary,
  });
}

function onRailClick(event: Event) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest?.('[data-diff-hunk-action]') as HTMLElement | null;
  if (!button || button.hasAttribute('disabled')) return;
  event.preventDefault();
  event.stopPropagation();

  const action = String(button.getAttribute('data-diff-hunk-action') || '').trim();
  if (action === 'approve-all') {
    applyDecision(null, 'approve-all');
    return;
  }
  if (action !== 'approve' && action !== 'reject') return;
  const hunkId = String(button.getAttribute('data-hunk-id') || '').trim();
  if (!hunkId) return;
  applyDecision(hunkId, action);
}

function ensureRailMount(): HTMLElement | null {
  if (railRoot && document.contains(railRoot)) return railRoot;

  let existing = document.getElementById('trust-diff-rail') as HTMLElement | null;
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'trust-diff-rail';
    existing.className = 'diff-review-rail';
    existing.setAttribute('role', 'region');
    existing.setAttribute('aria-label', 'Diff trust rail');
    existing.hidden = true;

    const artifactBody = document.getElementById('artifact-body');
    const artifactPane = document.getElementById('artifact-pane');
    const terminalSplit = document.querySelector('.terminal-split') as HTMLElement | null;

    if (artifactBody?.parentElement) {
      // Prefer sitting above the artifact body inside the pane.
      artifactBody.parentElement.insertBefore(existing, artifactBody);
    } else if (artifactPane) {
      artifactPane.appendChild(existing);
    } else if (terminalSplit) {
      terminalSplit.appendChild(existing);
    } else {
      document.body.appendChild(existing);
    }
  }

  railRoot = existing;
  if (!boundClick) {
    railRoot.addEventListener('click', onRailClick);
    boundClick = true;
  }
  return railRoot;
}

function showArtifactPane(title?: string) {
  const pane = document.getElementById('artifact-pane');
  const titleNode = document.getElementById('artifact-title');
  if (titleNode && title) titleNode.textContent = title;
  pane?.classList.remove('hidden');
}

/**
 * Ensure the rail mount exists and is ready for content.
 * Safe to call multiple times.
 */
export function initDiffReviewRail(): HTMLElement | null {
  const root = ensureRailMount();
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = renderRailHtml();
  }
  return root;
}

/**
 * Parse unified-diff text, render hunk cards, and open the trust rail.
 */
export function setDiffReviewContent(diffText: string, meta: DiffReviewMeta = {}): DiffHunk[] {
  initDiffReviewRail();
  // Mobile: surface the trust sheet when a diff lands
  try {
    // Lazy require pattern via dynamic import without blocking render
    void import('./trust-rail-mobile').then((mod) => {
      if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
        mod.openTrustRailSheet();
      }
    });
  } catch {
    // ignore
  }
  activeMeta = {
    file: meta.file || undefined,
    title: meta.title || meta.file || 'Diff review',
    runId: meta.runId || undefined,
    sessionId: meta.sessionId || undefined,
    artifactId: meta.artifactId || undefined,
  };

  const reviewId = String(meta.artifactId || meta.runId || 'review').trim() || 'review';
  const text = String(diffText || '');
  hunks = parseUnifiedDiff(text, {
    reviewId,
    defaultFile: meta.file || undefined,
  });

  // Fallback: non-unified patch body as a single reviewable card.
  if (hunks.length === 0 && text.trim() && !looksLikeUnifiedDiff(text)) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    hunks = [{
      id: `${reviewId}:file-1:hunk-1`,
      filePath: meta.file || 'patch',
      header: '@@ patch @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 0,
      newLines: 0,
      lines,
      addedLines: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length,
      removedLines: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
      status: 'pending',
    }];
  }

  paint();
  showArtifactPane(activeMeta.title || 'Diff review');
  return hunks.slice();
}

/** Clear hunks and show the empty state (rail stays visible). */
export function clearDiffReview(): void {
  hunks = [];
  activeMeta = {};
  const root = ensureRailMount();
  if (!root) return;
  root.innerHTML = renderRailHtml();
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  root.classList.add('is-active');
}

/** Hide the rail entirely (used when closing the pane / non-diff artifacts). */
export function hideDiffReviewRail(): void {
  const root = document.getElementById('trust-diff-rail') || railRoot;
  if (!root) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  root.classList.remove('is-active');
}

export function getDiffReviewHunks(): DiffHunk[] {
  return hunks.slice();
}

declare global {
  interface Window {
    emitSignal?: (type: string, title: string, detail: string) => void;
    ZavorthDiffReview?: {
      initDiffReviewRail: typeof initDiffReviewRail;
      setDiffReviewContent: typeof setDiffReviewContent;
      clearDiffReview: typeof clearDiffReview;
      hideDiffReviewRail: typeof hideDiffReviewRail;
      getDiffReviewHunks: typeof getDiffReviewHunks;
      parseUnifiedDiff: typeof parseUnifiedDiff;
      looksLikeUnifiedDiff: typeof looksLikeUnifiedDiff;
    };
  }
}
