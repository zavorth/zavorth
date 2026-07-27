export type GitLiteFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'
  | 'unchanged';

export type GitLiteChangedFile = {
  path: string;
  previousPath?: string;
  indexStatus: GitLiteFileStatus;
  worktreeStatus: GitLiteFileStatus;
  rawStatus: string;
};

export type GitLiteSnapshot = {
  branch: string;
  changedFiles: GitLiteChangedFile[];
  diffText: string;
  readOnly: true;
  summary: string;
  suggestions: string[];
};

const STATUS_LABELS: Record<string, GitLiteFileStatus> = {
  A: 'added',
  C: 'copied',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  U: 'conflicted',
  '...': 'untracked',
  '!': 'unchanged',
  ' ': 'unchanged',
};

export function parseGitStatusPorcelain(output: string): GitLiteChangedFile[] {
  return String(output || '')
    .split(/\r...\n/)
    .map(line => line.trimEnd())
    .filter(line => line && !line.startsWith('##'))
    .map(parseStatusLine)
    .filter((file): file is GitLiteChangedFile => Boolean(file));
}

export function parseGitBranch(output: string): string {
  const branchLine = String(output || '')
    .split(/\r...\n/)
    .find(line => line.startsWith('## '));
  if (branchLine) {
    const branch = branchLine
      .replace(/^##\s+/, '')
      .split('...')[0]
      .replace(/\[.*$/, '')
      .trim();
    return branch || 'unknown';
  }
  return String(output || '').trim() || 'unknown';
}

export function buildGitCommitSuggestions(files: GitLiteChangedFile[], diffText = ''): string[] {
  if (files.length === 0) {
    return ['chore: confirm clean working tree'];
  }

  const byTopLevel = groupByTopLevel(files);
  const firstScope = Array.from(byTopLevel.keys())[0] || 'workspace';
  const hasTests = files.some(file => /(^|[\\/])tests?([\\/]|$)|\.test\.|\.spec\./i.test(file.path));
  const hasStyles = files.some(file => /\.(css|scss|sass|less)$/i.test(file.path));
  const hasDocs = files.some(file => /\.(md|mdx|txt)$/i.test(file.path));
  const hasDeletes = files.some(file => file.indexStatus === 'deleted' || file.worktreeStatus === 'deleted');
  const diffLower = diffText.toLowerCase();
  const suggestions = new Set<string>();

  if (hasTests) {
    suggestions.add(`test(${firstScope}): cover updated desktop behavior`);
  }
  if (hasStyles) {
    suggestions.add(`style(${firstScope}): refine desktop shell polish`);
  }
  if (hasDocs) {
    suggestions.add(`docs(${firstScope}): update developer notes`);
  }
  if (hasDeletes) {
    suggestions.add(`refactor(${firstScope}): remove obsolete paths`);
  }
  if (diffLower.includes('permission') || diffLower.includes('approval')) {
    suggestions.add(`feat(${firstScope}): tighten approval-driven workflow`);
  }
  if (diffLower.includes('git') || files.some(file => file.path.toLowerCase().includes('git'))) {
    suggestions.add(`feat(${firstScope}): add Git workflow controls`);
  }
  suggestions.add(`feat(${firstScope}): update workspace experience`);

  return Array.from(suggestions).slice(0, 4);
}

export function buildGitLiteSnapshot(input: {
  branchOutput?: string;
  statusOutput?: string;
  diffText?: string;
  fallbackBranch?: string;
}): GitLiteSnapshot {
  const statusOutput = input.statusOutput || '';
  const changedFiles = parseGitStatusPorcelain(statusOutput);
  const branch = input.fallbackBranch || parseGitBranch(input.branchOutput || statusOutput);
  const summary = changedFiles.length === 0
    ? `Branch ${branch} has no changed files.`
    : `Branch ${branch} has ${changedFiles.length} changed file(s).`;
  return {
    branch,
    changedFiles,
    diffText: input.diffText || '',
    readOnly: true,
    summary,
    suggestions: buildGitCommitSuggestions(changedFiles, input.diffText),
  };
}

function parseStatusLine(line: string): GitLiteChangedFile | null {
  if (line.length < 3) {
    return null;
  }
  const rawStatus = line.slice(0, 2);
  const indexCode = rawStatus[0] || ' ';
  const worktreeCode = rawStatus[1] || ' ';
  const rawPath = line.slice(3).trim();
  if (!rawPath) {
    return null;
  }
  const renameParts = rawPath.split(/\s+->\s+/);
  const previousPath = renameParts.length > 1 ? unquoteGitPath(renameParts[0]) : undefined;
  const currentPath = unquoteGitPath(renameParts[renameParts.length - 1]);
  return {
    path: currentPath,
    previousPath,
    indexStatus: STATUS_LABELS[indexCode] || 'modified',
    worktreeStatus: STATUS_LABELS[worktreeCode] || 'modified',
    rawStatus,
  };
}

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function groupByTopLevel(files: GitLiteChangedFile[]): Map<string, GitLiteChangedFile[]> {
  const groups = new Map<string, GitLiteChangedFile[]>();
  for (const file of files) {
    const topLevel = file.path.split(/[\\/]/)[0] || 'workspace';
    const current = groups.get(topLevel) || [];
    current.push(file);
    groups.set(topLevel, current);
  }
  return groups;
}
