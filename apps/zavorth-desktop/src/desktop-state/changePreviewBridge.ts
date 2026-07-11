/**
 * Desktop bridge for Change Preview / counterfactual product UX.
 *
 * Pure types + formatters mirroring monorepo ChangePreviewCard.
 * No Node filesystem I/O — safe for renderer.
 */

export type DesktopChangePreviewConfidence =
  | 'full'
  | 'partial'
  | 'limited'
  | 'unavailable';

export type DesktopChangePreviewBullet = {
  id: string;
  text: string;
  severity: 'info' | 'warning' | 'risk';
  dimension?: 'disk' | 'shell' | 'network' | 'memory' | 'other';
};

export type DesktopChangePreviewDiffLine = {
  path: string;
  kind: 'create' | 'edit' | 'delete' | 'exec' | 'network' | 'unknown';
  note?: string;
};

/** Mirrors monorepo ChangePreviewCard for approval-card UI. */
export type DesktopChangePreviewCard = {
  contractVersion: string;
  id: string;
  title: string;
  confidence: DesktopChangePreviewConfidence | string;
  confidenceReason: string;
  bullets: DesktopChangePreviewBullet[];
  diffs: DesktopChangePreviewDiffLine[];
  requiresApproval: boolean;
  requiresSandbox: boolean;
  rollbackAvailable: boolean | null;
  sourceServices: string[];
  generatedAt: string;
  runId: string | null;
  approvalCardId: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Bullet lines for approval cards / review hub.
 * Returns plain strings (severity prefix for non-info).
 */
export function formatChangePreviewBullets(
  card: DesktopChangePreviewCard | null | undefined,
): string[] {
  if (!card) return [];
  if (!Array.isArray(card.bullets) || card.bullets.length === 0) {
    return card.confidence === 'unavailable'
      ? ['No simulated change available']
      : [];
  }
  return card.bullets.map((b) => {
    const text = String(b?.text || '').trim();
    if (!text) return '';
    if (b.severity === 'risk') return `⚠ ${text}`;
    if (b.severity === 'warning') return `• ${text}`;
    return text;
  }).filter(Boolean);
}

export function isLimitedChangePreview(
  card: DesktopChangePreviewCard | null | undefined,
): boolean {
  if (!card) return true;
  const c = String(card.confidence || '').toLowerCase();
  return c === 'limited' || c === 'unavailable' || c === 'partial';
}

export function changePreviewConfidenceLabel(
  confidence: string | null | undefined,
): string {
  const c = String(confidence || '').trim().toLowerCase();
  if (c === 'full') return 'Full';
  if (c === 'partial') return 'Partial';
  if (c === 'limited') return 'Limited';
  if (c === 'unavailable') return 'Unavailable';
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Unavailable';
}
