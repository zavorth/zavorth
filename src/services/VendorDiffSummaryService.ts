import type {
  VendorDiffSummary,
  VendorReleaseIndexStatus,
} from '../contracts/VendorPlaneContract.js';

type VendorDiffSummaryInput = {
  vendorId: string;
  displayName: string;
  lockedCommit: string | null;
  worktreeCommit: string | null;
  sourceHead: string | null;
  lastActionType?: 'update' | 'rollback' | null;
  lastActionAt?: string | null;
  trimmed?: string | null;
};

export class VendorDiffSummaryService {
  public buildSummary(input: VendorDiffSummaryInput): VendorDiffSummary {
    const currentCommit = input.lockedCommit || input.worktreeCommit || null;
    const targetCommit = input.sourceHead || input.lockedCommit || input.worktreeCommit || null;
    const status = this.resolveStatus(input);
    const changed = Boolean(currentCommit && targetCommit && currentCommit !== targetCommit);

    return {
      vendorId: input.vendorId,
      displayName: input.displayName,
      status,
      changed,
      lockedCommit: input.lockedCommit,
      worktreeCommit: input.worktreeCommit,
      sourceHead: input.sourceHead,
      currentCommit,
      targetCommit,
      currentShort: this.shorten(currentCommit),
      targetShort: this.shorten(targetCommit),
      lastActionType: input.lastActionType || null,
      lastActionAt: input.lastActionAt || null,
      trimmed: input.trimmed || null,
      summary: this.buildNarrative({
        displayName: input.displayName,
        status,
        currentCommit,
        targetCommit,
        lastActionType: input.lastActionType || null,
        trimmed: input.trimmed || null,
      }),
    };
  }

  private resolveStatus(input: VendorDiffSummaryInput): VendorReleaseIndexStatus {
    if (!input.lockedCommit && !input.worktreeCommit) {
      return 'missing_worktree';
    }
    if (!input.lockedCommit) {
      return 'unlocked';
    }
    if (input.sourceHead && input.lockedCommit !== input.sourceHead) {
      return 'update_available';
    }
    return 'aligned';
  }

  private buildNarrative(input: {
    displayName: string;
    status: VendorReleaseIndexStatus;
    currentCommit: string | null;
    targetCommit: string | null;
    lastActionType: 'update' | 'rollback' | null;
    trimmed: string | null;
  }): string {
    const current = this.shorten(input.currentCommit) || 'n/d';
    const target = this.shorten(input.targetCommit) || 'n/d';

    if (input.status === 'missing_worktree') {
      return `${input.displayName} does not have lock or worktree ready for local audit yet.`;
    }
    if (input.status === 'unlocked') {
      return `${input.displayName} exists locally but has not been promoted to the official vendor-plane lock yet.`;
    }
    if (input.status === 'update_available') {
      return `${input.displayName} is em ${current}, com upstream em ${target}; existe update pending para review.`;
    }

    if (input.lastActionType === 'rollback') {
      return `${input.displayName} is alinhado em ${target} after do latest rollback conhecido.`;
    }
    if (input.lastActionType === 'update' && input.trimmed) {
      return `${input.displayName} is alinhado em ${target} e a ultima promotion limpou ${input.trimmed} de cache local.`;
    }
    return `${input.displayName} is alinhado em ${target}.`;
  }

  private shorten(commit: string | null | undefined): string | null {
    const normalized = String(commit || '').trim();
    return normalized ? normalized.slice(0, 8) : null;
  }
}
