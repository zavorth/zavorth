import {
  EXPERIENCE_DIFF_REVIEW_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceDiffFile,
  type ExperienceDiffHunk,
  type ExperienceDiffReview,
} from './ExperienceContracts.js';
import type {
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type DiffReviewBuildInput = {
  activeRun?: UniversalAgentRun | null;
  runs?: UniversalAgentRun[];
};

type DiffSource = {
  run: UniversalAgentRun;
  text: string;
};

function makeAction(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  risk?: UniversalToolRiskLevel;
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasDiffShape(text: string): boolean {
  return /(^|\n)(diff --git |@@\s+-|\+\+\+ b\/|--- a\/)/.test(text);
}

function safePreview(lines: string[]): string[] {
  return lines
    .filter((line) => line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))
    .slice(0, 12)
    .map((line) => line.length > 180 ? `${line.slice(0, 177)}...` : line);
}

export class DiffReviewService {
  public build(input: DiffReviewBuildInput = {}): ExperienceDiffReview[] {
    const sources = this.findSources(input);
    return sources.map((source, index) => this.parseSource(source, index));
  }

  private findSources(input: DiffReviewBuildInput): DiffSource[] {
    const runs = input.activeRun
      ? [input.activeRun]
      : (input.runs || []).slice(0, 5);
    return runs.flatMap((run) => {
      const text = this.findDiffText(run);
      return text ? [{ run, text }] : [];
    }).slice(0, 3);
  }

  private findDiffText(run: UniversalAgentRun): string | null {
    const metadata = run.metadata || {};
    const directKeys = [
      'diff',
      'patch',
      'unifiedDiff',
      'sandboxDiff',
      'mutationDiff',
      'diffPreview',
      'finalDiff',
    ];
    for (const key of directKeys) {
      const value = metadata[key];
      if (typeof value === 'string' && hasDiffShape(value)) return value;
    }

    for (const key of ['sandbox', 'mutation', 'speculative', 'validation']) {
      const nested = recordOrNull(metadata[key]);
      if (!nested) continue;
      for (const nestedKey of directKeys) {
        const value = nested[nestedKey];
        if (typeof value === 'string' && hasDiffShape(value)) return value;
      }
    }

    const artifactDiff = run.artifacts.find((artifact) => artifact.kind === 'diff');
    if (artifactDiff && typeof metadata[artifactDiff.id] === 'string' && hasDiffShape(String(metadata[artifactDiff.id]))) {
      return String(metadata[artifactDiff.id]);
    }
    return null;
  }

  private parseSource(source: DiffSource, index: number): ExperienceDiffReview {
    const reviewId = `diff-review:${source.run.id}:${index + 1}`;
    const files = this.parseFiles(reviewId, source.text);
    const totals = files.reduce((acc, file) => ({
      added: acc.added + file.addedLines,
      removed: acc.removed + file.removedLines,
      hunkCount: acc.hunkCount + file.hunks.length,
    }), { added: 0, removed: 0, hunkCount: 0 });
    const risk = this.riskFor(files, source.run);
    const status: ExperienceDiffReview['status'] = files.length > 0 ? 'pending' : 'empty';

    return {
      contractVersion: EXPERIENCE_DIFF_REVIEW_CONTRACT_VERSION,
      id: reviewId,
      runId: source.run.id,
      title: files.length > 0 ? `Diff governado de ${source.run.title}` : 'Diff vazio',
      summary: files.length > 0
        ? `${files.length} arquivo(s), ${totals.hunkCount} hunk(s), +${totals.added}/-${totals.removed}.`
        : 'Nenhuma alteracao revisavel foi encontrada no sandbox.',
      status,
      risk,
      files,
      actions: [
        makeAction({
          id: `diff:approve-plan:${reviewId}`,
          label: 'Aprovar plano inteiro',
          kind: 'diff',
          command: `zavorth diff approve ${reviewId}`,
          risk,
          requiresApproval: true,
          reason: 'A selecao recomposta volta para policy antes de tocar o host.',
        }),
        makeAction({
          id: `diff:retry:${reviewId}`,
          label: 'Nova tentativa sem hunks rejeitados',
          kind: 'diff',
          command: `zavorth diff retry ${reviewId}`,
          risk: 'attention',
          requiresApproval: true,
          reason: 'Reabre o sandbox com escopo reduzido.',
        }),
      ],
    };
  }

  private parseFiles(reviewId: string, diffText: string): ExperienceDiffFile[] {
    const lines = diffText.replace(/\r\n/g, '\n').split('\n');
    const files: ExperienceDiffFile[] = [];
    let currentFile: ExperienceDiffFile | null = null;
    let currentHunk: ExperienceDiffHunk | null = null;
    let hunkLines: string[] = [];

    const finishHunk = () => {
      if (!currentFile || !currentHunk) return;
      currentHunk.preview = safePreview(hunkLines);
      currentFile.hunks.push(currentHunk);
      currentHunk = null;
      hunkLines = [];
    };
    const finishFile = () => {
      finishHunk();
      if (currentFile) files.push(currentFile);
      currentFile = null;
    };

    for (const line of lines) {
      const gitMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      if (gitMatch) {
        finishFile();
        currentFile = this.newFile(reviewId, files.length, gitMatch[2]);
        continue;
      }

      const plusMatch = /^\+\+\+ b\/(.+)$/.exec(line);
      if (plusMatch && !currentFile) {
        currentFile = this.newFile(reviewId, files.length, plusMatch[1]);
        continue;
      }

      if (line.startsWith('@@')) {
        if (!currentFile) currentFile = this.newFile(reviewId, files.length, 'unknown');
        finishHunk();
        currentHunk = {
          id: `${currentFile.id}:hunk-${currentFile.hunks.length + 1}`,
          header: line,
          status: 'pending',
          addedLines: 0,
          removedLines: 0,
          preview: [],
          risk: 'safe',
        };
        continue;
      }

      if (currentFile && currentHunk) {
        hunkLines.push(line);
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.addedLines += 1;
          currentFile.addedLines += 1;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.removedLines += 1;
          currentFile.removedLines += 1;
        }
      }
    }
    finishFile();

    return files.map((file) => ({
      ...file,
      hunks: file.hunks.map((hunk) => ({
        ...hunk,
        risk: this.hunkRisk(file.path, hunk),
      })),
    }));
  }

  private newFile(reviewId: string, index: number, path: string): ExperienceDiffFile {
    const id = `${reviewId}:file-${index + 1}`;
    return {
      id,
      path: path.replace(/^b\//, ''),
      status: 'pending',
      addedLines: 0,
      removedLines: 0,
      hunks: [],
    };
  }

  private riskFor(files: ExperienceDiffFile[], run: UniversalAgentRun): UniversalToolRiskLevel {
    const risks = files.flatMap((file) => file.hunks.map((hunk) => this.hunkRisk(file.path, hunk)));
    if (run.approvals.some((approval) => approval.risk === 'danger')) return 'danger';
    if (risks.includes('danger')) return 'danger';
    if (run.approvals.some((approval) => approval.risk === 'attention')) return 'attention';
    if (risks.includes('attention')) return 'attention';
    return 'safe';
  }

  private hunkRisk(path: string, hunk: ExperienceDiffHunk): UniversalToolRiskLevel {
    const lowerPath = path.toLowerCase();
    const preview = hunk.preview.join('\n').toLowerCase();
    if (/(^|\/)(\.env|secrets?|credentials?|private[-_]?key)/.test(lowerPath)) return 'danger';
    if (/(password|api[_-]?key|token|secret|private key)/.test(preview)) return 'danger';
    if (/(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|package\.json)$/.test(lowerPath)) return 'attention';
    if (hunk.addedLines + hunk.removedLines > 80) return 'attention';
    return 'safe';
  }
}
