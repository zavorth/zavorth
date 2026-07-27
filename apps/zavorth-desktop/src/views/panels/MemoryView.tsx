import { useState } from 'react';
import type {
  LearningItem,
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
} from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';
import { t } from '../../i18n';
import { MemoryGraphPanel } from './MemoryGraphPanel';

import { DetailRows, PageFrame, SearchBox, TextTabs } from '../panelChrome';

export function MemoryView(props: {
  busy: boolean;
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  items: MemoryItem[];
  learning: LearningItem[];
  onEncryptionAction(action: 'preview' | 'apply' | 'rollback'): void | Promise<void>;
  onLearningDecision(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
  onMemoryControlAction(input: {
    action: 'forget' | 'updatePreference';
    id: string;
    content?: string;
  }): void | Promise<void>;
}) {
  const [mode, setMode] = useState<'learned' | 'candidates' | 'protection' | 'graph'>('learned');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const protection = props.encryptionStatus;
  const canRollback = Boolean(props.encryptionReceipt?.backupPath && props.encryptionReceipt.status === 'applied');

  const learnedRows = props.items
    .filter(
      (item) =>
        !q ||
        `${item.title || ''} ${item.summary || ''} ${item.kind || ''} ${item.key || ''} ${item.content || ''} ${item.contentPreview || ''}`
          .toLowerCase()
          .includes(q),
    )
    .map((item, index) => {
      const id = item.id || itemId(item, `memory-${index}`);
      const canEdit = item.editable === true;
      return {
        id,
        title: item.title || item.key || item.kind || item.type || 'Memory receipt',
        description: item.summary || item.contentPreview || item.content || item.receiptId || 'Stored with provenance.',
        meta: canEdit ? 'editable preference' : item.type || item.expiry || item.receiptId || 'read-only',
        tone: canEdit ? ('ready' as const) : ('muted' as const),
        actions: (
          <div className="zvd-row-actions">
            {canEdit && (
              <button
                disabled={props.busy}
                onClick={() => {
                  const content = window.prompt(
                    'Update preference',
                    item.content || item.contentPreview || item.summary || '',
                  );
                  if (content !== null) {
                    void props.onMemoryControlAction({ action: 'updatePreference', id, content });
                  }
                }}
                type="button"
              >
                Edit
              </button>
            )}
            <button
              disabled={props.busy}
              onClick={() => void props.onMemoryControlAction({ action: 'forget', id })}
              type="button"
            >
              Forget
            </button>
          </div>
        ),
      };
    });

  const candidateRows = props.learning
    .filter(
      (candidate) =>
        !q || `${candidate.title || ''} ${candidate.summary || ''} ${candidate.kind || ''}`.toLowerCase().includes(q),
    )
    .map((candidate, index) => {
      const id = itemId(candidate, `learning-${index}`);
      return {
        id,
        title: candidate.title || candidate.kind || 'Learning candidate',
        description: candidate.summary || `${candidate.lane || 'lane'} ? ${candidate.risk || 'risk unknown'}`,
        meta: candidate.risk || candidate.status || 'candidate',
        tone: candidate.lane === 'green' ? ('ready' as const) : ('warning' as const),
        actions: (
          <div className="zvd-row-actions">
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'approve')} type="button">
              Approve
            </button>
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'reject')} type="button">
              Reject
            </button>
            <button disabled={props.busy} onClick={() => void props.onLearningDecision(id, 'forget')} type="button">
              Forget
            </button>
          </div>
        ),
      };
    });

  const protectionRows = [
    {
      id: 'memory-protection',
      title: protection?.fullFileEncrypted ? 'Advanced protection active'
        : protection?.contentEncrypted ? 'Standard protection active'
          : 'Memory protection unavailable',
      description: protection?.guidance || 'Memory protection status is not available yet.',
      meta: protection?.atRestEncryptionMode || 'unknown',
      tone: protection?.safeForDailyUse ? ('ready' as const) : ('warning' as const),
      actions: (
        <div className="zvd-row-actions">
          <button disabled={props.busy} onClick={() => void props.onEncryptionAction('preview')} type="button">
            Preview
          </button>
          <button
            disabled={props.busy || protection?.fullFileEncrypted}
            onClick={() => void props.onEncryptionAction('apply')}
            type="button"
          >
            Enable advanced
          </button>
          <button
            disabled={props.busy || !canRollback}
            onClick={() => void props.onEncryptionAction('rollback')}
            type="button"
          >
            Rollback
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      description="Learned context, reversible candidates, and local memory protection."
      meta={`${props.items.length} memories`}
      title={panelLabels.memory}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search memory" />}
    >
      <TextTabs<'learned' | 'candidates' | 'protection' | 'graph'>
        value={mode}
        onChange={setMode}
        items={[
          { value: 'learned', label: 'Learned', count: props.items.length },
          { value: 'candidates', label: 'Candidates', count: props.learning.length },
          { value: 'protection', label: 'Protection' },
          { value: 'graph', label: t('memoryGraph.tab') },
        ]}
      />
      {mode === 'learned' && <DetailRows rows={learnedRows} empty="No learned memories are projected yet." />}
      {mode === 'candidates' && <DetailRows rows={candidateRows} empty="No learning candidates are waiting." />}
      {mode === 'protection' && <DetailRows rows={protectionRows} empty="Memory protection status is unavailable." />}
      {mode === 'graph' && <MemoryGraphPanel memoryItems={props.items} />}
    </PageFrame>
  );
}
