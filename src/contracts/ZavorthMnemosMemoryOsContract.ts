export const ZAVORTH_MNEMOS_MEMORY_OS_VERSION = 'mnemos-memory-os-v3-phase-0-1';

export const ZAVORTH_MNEMOS_WIKI_ROOT = '.zavorth/wiki';
export const ZAVORTH_MNEMOS_RAW_ROOT = '.zavorth/raw';
export const ZAVORTH_MNEMOS_SCHEMA_PATH = '.zavorth/SCHEMA.md';

export const ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS = 60 * 60 * 1000;
export const ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER = 15000;
export const ZAVORTH_MNEMOS_RECENT_VERBATIM_TURNS = 5;

export type ZavorthMnemosMemoryTier =
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'procedural';

export type ZavorthMnemosCompactionMode =
  | 'none'
  | 'time-based-microcompact'
  | 'incremental-anchored-compaction'
  | 'handoff-envelope-preview';

export type ZavorthMnemosWikiLoop =
  | 'ingest'
  | 'query'
  | 'lint';

export type ZavorthMnemosMemoryTierContract = {
  tier: ZavorthMnemosMemoryTier;
  storage: string;
  purpose: string;
  governance: string[];
};

export type ZavorthMnemosCompactionContract = {
  mode: ZavorthMnemosCompactionMode;
  trigger: string;
  preserves: string[];
  removesOrCondenses: string[];
  requiresLlm: boolean;
  mutatesDurableMemory: boolean;
};

export type ZavorthMnemosWikiContract = {
  root: string;
  rawRoot: string;
  schemaPath: string;
  loops: Array<{
    loop: ZavorthMnemosWikiLoop;
    command: string;
    status: 'planned' | 'contracted' | 'implemented';
    governance: string[];
  }>;
};

export type ZavorthMnemosMemoryOsContractSnapshot = {
  version: string;
  generatedAt: string;
  summary: {
    tiers: number;
    compactionModes: number;
    wikiLoops: number;
    defaultIdleMicrocompactMinutes: number;
    reservedTokenBuffer: number;
    recentVerbatimTurns: number;
  };
  tiers: ZavorthMnemosMemoryTierContract[];
  compaction: ZavorthMnemosCompactionContract[];
  wiki: ZavorthMnemosWikiContract;
  hardRules: string[];
  nextPhases: string[];
};

export function buildZavorthMnemosMemoryOsContractSnapshot(now: Date = new Date()): ZavorthMnemosMemoryOsContractSnapshot {
  const tiers: ZavorthMnemosMemoryTierContract[] = [
    {
      tier: 'working',
      storage: 'active gateway context',
      purpose: 'Keep recent conversational and tool state available to the next model call.',
      governance: [
        'volatile by default',
        'eligible for microcompaction',
        'never treated as durable truth',
      ],
    },
    {
      tier: 'episodic',
      storage: 'data receipts and session run summaries',
      purpose: 'Remember what happened, when it happened, which tool/provider/channel was used, and what failed.',
      governance: [
        'receipt-backed',
        'timestamped',
        'redacted before recall',
      ],
    },
    {
      tier: 'semantic',
      storage: ZAVORTH_MNEMOS_WIKI_ROOT,
      purpose: 'Store consolidated project facts, architecture decisions, rules, and stable lessons.',
      governance: [
        'human-readable markdown',
        'source-linked',
        'linted for contradictions',
      ],
    },
    {
      tier: 'procedural',
      storage: 'governed policy and operator preference memory',
      purpose: 'Capture safe habits, repeated operator decisions, and workflow preferences without storing secrets.',
      governance: [
        'no raw secrets',
        'revocable',
        'policy-scoped',
      ],
    },
  ];

  const compaction: ZavorthMnemosCompactionContract[] = [
    {
      mode: 'time-based-microcompact',
      trigger: `idle >= ${ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS}ms`,
      preserves: [
        'verbatim user directives',
        'recent conversational turns',
        'tool identity and status',
      ],
      removesOrCondenses: [
        'large stale tool stdout',
        'old grep/read/bash payloads',
        'repeated logs that already have receipts',
      ],
      requiresLlm: false,
      mutatesDurableMemory: false,
    },
    {
      mode: 'incremental-anchored-compaction',
      trigger: `estimated tokens > usable context - ${ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER}`,
      preserves: [
        'recent 3-5 turns verbatim',
        'active intent',
        'discarded paths',
        'modified path map',
        'pending checklist',
      ],
      removesOrCondenses: [
        'older conversational filler',
        'duplicated command output',
        'long historical context already represented in the anchor',
      ],
      requiresLlm: false,
      mutatesDurableMemory: false,
    },
    {
      mode: 'handoff-envelope-preview',
      trigger: 'model/session migration or explicit resume request',
      preserves: [
        'active mandate',
        'architecture decisions',
        'security approvals',
        'verbatim user directives',
        'next prescribed action',
      ],
      removesOrCondenses: [
        'non-actionable logs',
        'obsolete local exploration',
      ],
      requiresLlm: false,
      mutatesDurableMemory: false,
    },
  ];

  const wiki: ZavorthMnemosWikiContract = {
    root: ZAVORTH_MNEMOS_WIKI_ROOT,
    rawRoot: ZAVORTH_MNEMOS_RAW_ROOT,
    schemaPath: ZAVORTH_MNEMOS_SCHEMA_PATH,
    loops: [
      {
        loop: 'ingest',
        command: 'npm run mnemos:ingest',
        status: 'planned',
        governance: ['dry-run first', 'source-linked', 'operator approval for broad writes'],
      },
      {
        loop: 'query',
        command: 'npm run mnemos:query',
        status: 'planned',
        governance: ['hybrid ranking', 'untrusted context wrapper', 'top-k only'],
      },
      {
        loop: 'lint',
        command: 'npm run mnemos:lint',
        status: 'planned',
        governance: ['contradiction detection', 'broken link checks', 'operator decision for critical conflicts'],
      },
    ],
  };

  return {
    version: ZAVORTH_MNEMOS_MEMORY_OS_VERSION,
    generatedAt: now.toISOString(),
    summary: {
      tiers: tiers.length,
      compactionModes: compaction.length,
      wikiLoops: wiki.loops.length,
      defaultIdleMicrocompactMinutes: ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS / 60000,
      reservedTokenBuffer: ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER,
      recentVerbatimTurns: ZAVORTH_MNEMOS_RECENT_VERBATIM_TURNS,
    },
    tiers,
    compaction,
    wiki,
    hardRules: [
      'Compaction never grants tool authority.',
      'Compaction never serializes raw secrets.',
      'Microcompaction never mutates durable memory.',
      'Semantic wiki updates are source-linked and lintable.',
      'Procedural memory stores habits and policy, not credentials.',
    ],
    nextPhases: [
      'Phase 2: Zavorth Handoff Envelope',
      'Phase 3: .zavorth/wiki baseline',
      'Phase 4: mnemos:ingest',
      'Phase 5: mnemos:query with hybrid RRF',
      'Phase 6: mnemos:lint',
      'Phase 7: procedural memory',
      'Phase 8: dashboard/CLI/Telegram UX',
      'Phase 9: certification/security',
    ],
  };
}
