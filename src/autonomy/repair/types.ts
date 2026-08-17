/**
 * Self-Healing Repair Pipeline Types.
 * Defines strictly typed structures for diagnostic findings, repair targets, attempts, and receipts.
 * Strictly typed (Zero any) and EN-First.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'fatal';

export interface DiagnosticFinding {
  filePath?: string;
  line?: number;
  column?: number;
  errorCode?: string;
  message: string;
  rawSnippet?: string;
  severity: DiagnosticSeverity;
}

export interface RepairTarget {
  id: string;
  command: string;
  cwd?: string;
  isolatedWorktree?: boolean;
  maxAttempts?: number;
}

export interface RepairAttempt {
  attemptNumber: number;
  diagnostics: DiagnosticFinding[];
  patchDescription?: string;
  filesModified: string[];
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface SelfRepairReceipt {
  id: string;
  targetCommand: string;
  status: 'resolved' | 'failed' | 'aborted';
  attempts: RepairAttempt[];
  totalDurationMs: number;
  finalOutput?: string;
  createdAt: string;
}

export type PatchApplier = (
  finding: DiagnosticFinding,
  attemptNumber: number,
) => Promise<{ modifiedFiles: string[]; description: string }>;
