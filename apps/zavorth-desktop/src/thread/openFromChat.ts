/**
 * Extract openable file references from tool/message content.
 * Pure helpers — safe for unit tests.
 */

export type OpenTarget = {
  kind: 'file' | 'diff' | 'folder';
  path: string; // relative preferred
  line?: number;
  label: string;
};

const MAX_TARGETS = 20;

const CODE_EXTENSIONS =
  'ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|html|vue|svelte|py|rs|go|java|kt|swift|c|cc|cpp|h|hpp|cs|rb|php|sh|bash|zsh|yml|yaml|toml|xml|sql|graphql|gql|txt|env|gitignore|dockerfile|rsx|astro|vue|diff|patch';

/** Relative path with optional :line — no drive letter, no absolute Unix home/root user paths */
const REL_PATH_CORE =
  `(?:\\.\\.?/)?(?:[\\w.-]+/)*[\\w.-]+\\.(?:${CODE_EXTENSIONS})`;

const PATH_WITH_LINE_RE = new RegExp(
  `(?<![\\w@])(${REL_PATH_CORE})(?::(\\d{1,7}))?(?![\\w./-])`,
  'gi',
);

/** Host-like first segment (example.com/a.ts) — not a project path */
const DOMAINISH_PATH_RE = /^(?:[\w-]+\.)+(?:com|org|net|io|dev|app|co|ai|edu|gov|uk|br|info)(?:\/|$)/i;

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

const WROTE_RE =
  /(?:Wrote(?:\s+file)?|Created(?:\s+file)?|Modified|Updated|Saved|Deleted|Removed)\s*(?:file)?\s*:\s*[`']?([^\s`'"<>]+)/gi;

const DIFF_HINT_RE = /\bdiff\b|\.patch\b|unified\s+diff|git\s+diff/i;
const FOLDER_HINT_RE = /\b(?:directory|folder|dir)\b/i;

function isAbsoluteOrUnsafe(path: string): boolean {
  const p = path.trim();
  // Windows drive letter
  if (/^[a-zA-Z]:[\\/]/.test(p)) return true;
  // UNC
  if (/^\\\\/.test(p)) return true;
  // Absolute Unix / root or /Users /home /var etc. — reject absolute paths
  if (p.startsWith('/')) return true;
  // file:// URLs
  if (/^file:/i.test(p)) return true;
  // Escape-ish
  if (p.includes('..\\') || /(?:^|\/)\.\.(?:\/|$)/.test(p.replace(/\\/g, '/'))) {
    // Allow relative ../foo... Spec says relative preferred; allow single-segment relative only for safety
    // Reject path traversal
    return true;
  }
  return false;
}

function normalizePath(raw: string): string | null {
  let p = raw.trim();
  // strip wrapping quotes/backticks
  p = p.replace(/^['"`]+|['"`]+$/g, '');
  // strip trailing punctuation commonly glued on
  p = p.replace(/[.,;:!?)\]]+$/g, '');
  // normalize backslashes to forward for relative checks
  const forCheck = p.replace(/\\/g, '/');
  if (!forCheck || forCheck.length > 512) return null;
  if (isAbsoluteOrUnsafe(forCheck)) return null;
  // must look like a file path (has slash or extension)
  if (!/[./]/.test(forCheck)) return null;
  // reject pure URLs
  if (/^[a-z][a-z0-9+.-]*:/i.test(forCheck)) return null;
  // reject host-like paths extracted from URLs (example.com/a.ts)
  if (DOMAINISH_PATH_RE.test(forCheck)) return null;
  return forCheck;
}

function detectKind(path: string, context: string): OpenTarget['kind'] {
  if (DIFF_HINT_RE.test(context) || /\.(?:diff|patch)$/i.test(path)) return 'diff';
  if (FOLDER_HINT_RE.test(context) && !/\.\w+$/.test(path)) return 'folder';
  // trailing slash → folder
  if (path.endsWith('/')) return 'folder';
  return 'file';
}

function targetKey(t: OpenTarget): string {
  return `${t.path}::${t.line ?? ''}`;
}

function pushTarget(
  out: OpenTarget[],
  seen: Set<string>,
  partial: { path: string; line?: number; kind?: OpenTarget['kind']; label?: string; context?: string },
): void {
  if (out.length >= MAX_TARGETS) return;
  const path = normalizePath(partial.path);
  if (!path) return;
  // folders without extension may pass normalize if they have a slash
  let kind = partial.kind ?? detectKind(path, partial.context ?? '');
  // default files that look like paths with extension
  if (kind === 'folder' && /\.\w+$/.test(path) && !path.endsWith('/')) {
    kind = 'file';
  }
  const line =
    partial.line != null && Number.isFinite(partial.line) && partial.line > 0
      ? Math.floor(partial.line)
      : undefined;
  const target: OpenTarget = {
    kind,
    path,
    ...(line != null ? { line } : {}),
    label: partial.label?.trim() || (line != null ? `${path}:${line}` : path),
  };
  const key = targetKey(target);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(target);
}

/**
 * Detect relative paths, path:line, markdown links, "Wrote file: path" / "Modified: path".
 * Deduplicate by path+line. Relative only. Max 20 targets.
 */
export function extractOpenTargets(content: string): OpenTarget[] {
  if (typeof content !== 'string' || !content.trim()) return [];

  const out: OpenTarget[] = [];
  const seen = new Set<string>();
  const text = content.replace(/\r\n/g, '\n');

  // 1) Explicit wrote/modified lines (highest signal)
  WROTE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WROTE_RE.exec(text)) !== null) {
    let raw = m[1];
    let line: number | undefined;
    const withLine = raw.match(/^(.+):(\d{1,7})$/);
    if (withLine) {
      raw = withLine[1];
      line = Number(withLine[2]);
    }
    const ctx = text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20);
    pushTarget(out, seen, { path: raw, line, context: ctx });
  }

  // 2) Markdown links [label](path) or [label](path:line)
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((m = MARKDOWN_LINK_RE.exec(text)) !== null) {
    const label = m[1];
    let href = m[2].trim();
    // ignore http(s) and anchors
    if (/^(https?:|mailto:|#)/i.test(href)) continue;
    let line: number | undefined;
    const withLine = href.match(/^(.+):(\d{1,7})$/);
    if (withLine && !/^[a-zA-Z]:\\/.test(href)) {
      // careful: Windows paths aren't allowed anyway
      // path:line only when path has extension-like form
      const candidatePath = withLine[1];
      if (/\.\w+$/.test(candidatePath) || candidatePath.includes('/')) {
        href = candidatePath;
        line = Number(withLine[2]);
      }
    }
    pushTarget(out, seen, {
      path: href,
      line,
      label: label || undefined,
      context: m[0],
    });
  }

  // 3) Bare relative paths with optional :line
  PATH_WITH_LINE_RE.lastIndex = 0;
  while ((m = PATH_WITH_LINE_RE.exec(text)) !== null) {
    const path = m[1];
    const line = m[2] ? Number(m[2]) : undefined;
    // skip matches that are the path portion of a URL (https://…)
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/:\/\/$/.test(before) || /:\/\/[\w.-]*$/.test(before)) continue;
    const ctx = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    let kind: OpenTarget['kind'] | undefined;
    if (DIFF_HINT_RE.test(ctx)) kind = 'diff';
    pushTarget(out, seen, { path, line, kind, context: ctx });
  }

  // 4) Folder-like relative paths mentioned with directory language
  // e.g. "open folder src/components"
  const folderScan =
    /(?:open\s+)?(?:folder|directory|dir)\s+[`']?((?:\.\.\/)?(?:[\w.-]+\/)+[\w.-]+\/?)[`']?/gi;
  while ((m = folderScan.exec(text)) !== null) {
    pushTarget(out, seen, { path: m[1], kind: 'folder', context: m[0] });
  }

  return out.slice(0, MAX_TARGETS);
}

export function preferFileTarget(targets: OpenTarget[]): OpenTarget | null {
  if (!targets.length) return null;
  const file = targets.find((t) => t.kind === 'file');
  return file ?? null;
}

export function preferDiffTarget(targets: OpenTarget[]): OpenTarget | null {
  if (!targets.length) return null;
  const diff = targets.find((t) => t.kind === 'diff');
  return diff ?? null;
}
