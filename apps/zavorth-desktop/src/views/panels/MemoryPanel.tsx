import { useState } from 'react';
import type {
  MemoryEncryptionMigrationReceipt,
  MemoryEncryptionStatus,
  MemoryItem,
  LearningItem,
} from '../../apiClient';
import { itemId, panelLabels } from '../../primitives/desktopPrimitives';

import { DetailRows, PageFrame, SearchBox, TextTabs } from './panelPrimitives';

function sanitizeText(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Replace absolute Windows/Unix paths
  cleaned = cleaned.replace(/[A-Za-z]:\\[^:\n\r]+/g, '[local path]');
  cleaned = cleaned.replace(/\/\w+\/\w+\/[^:\n\r\s]+/g, '[local path]');
  
  // Redact secrets/tokens/keys
  cleaned = cleaned.replace(/\b[a-fA-F0-9]{32,}\b/g, '[redacted token]');
  cleaned = cleaned.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[redacted API key]');
  cleaned = cleaned.replace(/-----BEGIN[ A-Z]+PRIVATE KEY-----[^-]+-----END[ A-Z]+PRIVATE KEY-----/g, '[redacted private key]');
  
  // Remove control characters/newlines
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
  
  if (cleaned.length > 120) {
    cleaned = cleaned.slice(0, 117) + '...';
  }
  return cleaned;
}

export function MemoryPanel(props: {
  encryptionReceipt: MemoryEncryptionMigrationReceipt | null;
  encryptionStatus: MemoryEncryptionStatus | null;
  items: MemoryItem[];
  learning: LearningItem[];
}) {
  const [mode, setMode] = useState<'learned' | 'candidates' | 'protection'>('learned');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const protection = props.encryptionStatus;

  const learnedRows = props.items
    .filter(item => !q || `${item.title || ''} ${item.kind || ''}`.toLowerCase().includes(q))
    .map((item, index) => ({
      id: itemId(item, `memory-${index}`),
      title: sanitizeText(item.title || item.kind || 'Memory receipt'),
      description: 'Governed context memory.',
      meta: sanitizeText(item.kind || 'local'),
      tone: 'ready' as const,
    }));

  const candidateRows = props.learning
    .filter(candidate => !q || `${candidate.title || ''} ${candidate.kind || ''}`.toLowerCase().includes(q))
    .map((candidate, index) => {
      const id = itemId(candidate, `learning-${index}`);
      return {
        id,
        title: sanitizeText(candidate.title || candidate.kind || 'Learning candidate'),
        description: 'Governed learning candidate.',
        meta: sanitizeText(candidate.lane || 'lane'),
        tone: candidate.lane === 'green' ? 'ready' as const : 'warning' as const,
      };
    });

  const protectionRows = [
    {
      id: 'memory-protection',
      title: protection?.fullFileEncrypted
        ? 'Advanced protection active'
        : protection?.contentEncrypted
          ? 'Standard protection active'
          : 'Memory protection unavailable',
      description: 'Memory encryption at-rest is enforced by the local node policy.',
      meta: sanitizeText(protection?.atRestEncryptionMode || 'unknown'),
      tone: protection?.safeForDailyUse ? 'ready' as const : 'warning' as const,
    },
  ];

  return (
    <PageFrame
      description="Learned context, candidates, and local memory protection."
      meta={`${props.items.length} memories`}
      title={panelLabels.memory}
      actions={<SearchBox value={query} onChange={setQuery} placeholder="Search memory" />}
    >
      <div className="zavorth-memory-panel">
        <TextTabs<'learned' | 'candidates' | 'protection'>
          value={mode}
          onChange={setMode}
          items={[
            { value: 'learned', label: 'Learned', count: props.items.length },
            { value: 'candidates', label: 'Candidates', count: props.learning.length },
            { value: 'protection', label: 'Protection' },
          ]}
        />
        {mode === 'learned' && <DetailRows rows={learnedRows} empty="No learned memories are projected yet." />}
        {mode === 'candidates' && <DetailRows rows={candidateRows} empty="No learning candidates are waiting." />}
        {mode === 'protection' && <DetailRows rows={protectionRows} empty="Memory protection status is unavailable." />}
      </div>
    </PageFrame>
  );
}
