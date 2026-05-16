import type {
  GovernedReviewContext,
  GovernedReviewContextFile,
  GovernedReviewRequest,
} from './GovernedReviewTypes.js';

export class ReviewContextCollector {
  public collect(request: GovernedReviewRequest): GovernedReviewContext {
    const files = normalizeFiles(request.files);
    const instructions = normalizeStringList(request.instructions);
    const diffSummary = normalizeText(request.diffSummary)
      || summarizeFiles(files)
      || 'No diff summary was provided for this governed review.';

    return {
      source: files.length > 0 || normalizeText(request.diffSummary) || instructions.length > 0
        ? 'provided'
        : 'empty',
      workspace: normalizeNullable(request.workspace),
      targetRef: normalizeNullable(request.targetRef),
      baseRef: normalizeNullable(request.baseRef),
      diffSummary,
      files,
      instructions,
      metadata: request.metadata ? { ...request.metadata } : {},
    };
  }
}

function normalizeFiles(files?: GovernedReviewContextFile[] | null): GovernedReviewContextFile[] {
  if (!Array.isArray(files)) {
    return [];
  }
  return files
    .map((file) => ({
      path: normalizeText(file.path),
      status: normalizeFileStatus(file.status),
      additions: normalizeOptionalCount(file.additions),
      deletions: normalizeOptionalCount(file.deletions),
      language: normalizeOptionalText(file.language),
      summary: normalizeOptionalText(file.summary),
    }))
    .filter((file) => file.path)
    .slice(0, 200);
}

function summarizeFiles(files: GovernedReviewContextFile[]): string {
  if (files.length === 0) {
    return '';
  }
  const byStatus = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.status] = (acc[file.status] || 0) + 1;
    return acc;
  }, {});
  const statusSummary = Object.entries(byStatus)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
  return `Review context includes ${files.length} file(s): ${statusSummary}.`;
}

function normalizeFileStatus(value: unknown): GovernedReviewContextFile['status'] {
  return value === 'added'
    || value === 'modified'
    || value === 'deleted'
    || value === 'renamed'
    || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeOptionalCount(value: unknown): number | undefined {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined;
}

function normalizeStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).slice(0, 50);
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}
