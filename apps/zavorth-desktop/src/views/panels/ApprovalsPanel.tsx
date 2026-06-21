import { useMemo, useState } from 'react';
import type { ApprovalItem } from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame, SearchBox, TextTabs } from './panelPrimitives';
import type { DetailRowTone } from './panelPrimitives';

// ---------------------------------------------------------------------------
// Safe display type — never includes summary / description / diff / patch /
// content / prompt / details.  Only structural metadata.
// ---------------------------------------------------------------------------
export type SafeApprovalRecord = {
  id: string;
  title: string;
  action: string;
  risk: 'low' | 'medium' | 'high' | 'unknown';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/g;
const MAX_TEXT_LENGTH = 80;

/**
 * Patterns that indicate an absolute or traversal path.
 * Matches Windows drive letters, common Unix roots, and traversal sequences.
 */
const SUSPICIOUS_PATH_RE =
  /(?:[A-Za-z]:[/\\]|\/(?:Users|home|root|etc|var|tmp|proc|sys)\b|\.\.[\\/])/;

/** Also catches bare ".." as the entire string */
function isSuspiciousText(value: string): boolean {
  return SUSPICIOUS_PATH_RE.test(value) || value === '..';
}

function sanitizeText(raw: string): string {
  return raw.replace(CONTROL_CHAR_RE, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

const SAFE_RISK = new Set<string>(['low', 'medium', 'high', 'unknown']);
const SAFE_STATUS = new Set<string>(['pending', 'approved', 'rejected', 'expired']);

/**
 * Pure function. Converts a raw ApprovalItem into a SafeApprovalRecord.
 * Returns null if the item contains suspicious data (absolute paths / traversal).
 * Never reads, renders, or propagates: summary, description, details, diff,
 * patch, content, prompt.
 */
export function sanitizeApproval(
  item: ApprovalItem,
  index: number,
): SafeApprovalRecord | null {
  const rawTitle = String(item.title ?? item.action ?? '').trim();
  const rawAction = String(item.action ?? '').trim();

  if (isSuspiciousText(rawTitle) || isSuspiciousText(rawAction)) {
    return null;
  }

  const title = sanitizeText(rawTitle) || 'Revisão pendente';
  const action = sanitizeText(rawAction);
  const risk: SafeApprovalRecord['risk'] = SAFE_RISK.has(String(item.risk))
    ? (item.risk as SafeApprovalRecord['risk'])
    : 'unknown';
  const status: SafeApprovalRecord['status'] = SAFE_STATUS.has(String(item.status))
    ? (item.status as SafeApprovalRecord['status'])
    : 'pending';
  // Only keep the date portion (at most 24 chars) — never free text
  const createdAt = item.createdAt ? String(item.createdAt).slice(0, 24) : '';
  const id = itemId(item, `approval-${index}`);

  return { id, title, action, risk, status, createdAt };
}

// ---------------------------------------------------------------------------
// Tone mapping
// ---------------------------------------------------------------------------
function riskTone(risk: SafeApprovalRecord['risk']): DetailRowTone {
  if (risk === 'high') return 'danger';
  if (risk === 'medium') return 'warning';
  return 'muted';
}

// ---------------------------------------------------------------------------
// Props — read-only; no approve/deny callbacks
// ---------------------------------------------------------------------------
type ApprovalsPanelProps = {
  approvals: ApprovalItem[];
  recentApprovals?: ApprovalItem[];
};

type TabValue = 'pending' | 'recent';

const TAB_ITEMS: Array<{ value: TabValue; label: string }> = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'recent', label: 'Recentes' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ApprovalsPanel(props: ApprovalsPanelProps) {
  const [tab, setTab] = useState<TabValue>('pending');
  const [query, setQuery] = useState('');

  // Sanitize upfront — never touch summary/description/content/diff/patch/prompt
  const sanitizedPending = useMemo(
    () =>
      props.approvals
        .map((item, i) => sanitizeApproval(item, i))
        .filter((r): r is SafeApprovalRecord => r !== null),
    [props.approvals],
  );

  const sanitizedRecent = useMemo(
    () =>
      (props.recentApprovals ?? [])
        .map((item, i) => sanitizeApproval(item, i))
        .filter((r): r is SafeApprovalRecord => r !== null),
    [props.recentApprovals],
  );

  // Active records depend on tab
  const activeRecords = tab === 'pending' ? sanitizedPending : sanitizedRecent;

  // Filter only the already-sanitized records — never raw array, never summary
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeRecords
      .filter(record => {
        if (!q) return true;
        return (record.title + ' ' + record.action).toLowerCase().includes(q);
      })
      .map(record => ({
        id: record.id,
        title: record.title,
        // action is shown as description only if it differs from title
        description: record.action && record.action !== record.title ? record.action : undefined,
        meta: [
          record.risk,
          record.status,
          record.createdAt ? record.createdAt.slice(0, 10) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        tone: riskTone(record.risk),
        // no actions — read-only, no approve/deny buttons
      }));
  }, [activeRecords, query]);

  const tabsWithCount = TAB_ITEMS.map(t => ({
    ...t,
    count: t.value === 'pending' ? sanitizedPending.length : sanitizedRecent.length,
  }));

  return (
    <PageFrame
      description="Operações aguardando revisão explícita antes de serem executadas."
      meta={`${sanitizedPending.length} pendente${sanitizedPending.length !== 1 ? 's' : ''}`}
      title={panelLabels.approvals}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Buscar aprovações" />}
    >
      <div className="zavorth-approvals-panel">
        <TextTabs value={tab} items={tabsWithCount} onChange={setTab} />
        <div className="zavorth-approvals-list">
          <DetailRows
            rows={rows}
            empty={
              tab === 'pending'
                ? 'Nenhuma aprovação pendente.'
                : 'Nenhuma aprovação recente.'
            }
          />
        </div>
      </div>
    </PageFrame>
  );
}
