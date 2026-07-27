export type ExperienceProfileId = 'personal' | 'creator' | 'developer' | 'business' | 'power';

export type ExperienceProfileUiContract = {
  id: ExperienceProfileId;
  label: string;
  audience: string;
  summary: string;
  autonomy: 'balanced' | 'advanced' | 'business';
  detailMode: 'simple' | 'advanced';
  explanation: 'plain' | 'guided' | 'technical' | 'audit';
  approvalTone: string;
  riskBoundary: string;
  firstMissionIds: string[];
  suggestedChannels: string[];
  suggestedCapabilities: string[];
  checklist: string[];
  naturalPrompts: string[];
};

export const EXPERIENCE_PROFILE_STORAGE_KEY = 'zavorth.control.experienceProfile';

export const EXPERIENCE_PROFILE_CATALOG: ExperienceProfileUiContract[] = [
  {
    id: 'personal',
    label: 'Personal',
    audience: 'Daily users who want help with routine, files, documents, messages and reminders.',
    summary: 'Simple daily help, friendly wording and safe defaults.',
    autonomy: 'balanced',
    detailMode: 'simple',
    explanation: 'plain',
    approvalTone: 'Short and human: ask before changing, sending or spending.',
    riskBoundary: 'Planning and summaries can stay quiet; changes, external sends and memory writes need confirmation.',
    firstMissionIds: ['daily-assistant', 'pdf-summary', 'file-organization'],
    suggestedChannels: ['dashboard', 'satellite', 'telegram'],
    suggestedCapabilities: ['reminders', 'documents', 'files', 'channel approvals'],
    checklist: ['Pick one useful first task', 'Keep wording simple', 'Show what can be undone'],
    naturalPrompts: ['Use Personal mode', 'Help me organize my day', 'Summarize a document safely'],
  },
  {
    id: 'creator',
    label: 'Creator',
    audience: 'Creators who research, draft, polish and prepare posts, pages, scripts or notes.',
    summary: 'Research and drafts with source-aware previews before publishing.',
    autonomy: 'balanced',
    detailMode: 'simple',
    explanation: 'guided',
    approvalTone: 'Preview content and sources before posting, publishing or contacting people.',
    riskBoundary: 'Drafting and research are fine; publishing, account access and network actions need approval.',
    firstMissionIds: ['web-research-governed', 'pdf-summary', 'daily-assistant'],
    suggestedChannels: ['dashboard', 'satellite', 'telegram'],
    suggestedCapabilities: ['web research', 'document analysis', 'media analysis', 'drafting'],
    checklist: ['Collect sources', 'Draft before publishing', 'Keep account actions approval-bound'],
    naturalPrompts: ['Use Creator mode', 'Research this topic', 'Draft a post with sources'],
  },
  {
    id: 'developer',
    label: 'Developer',
    audience: 'Developers and solo builders working with repositories, tests, patches and local tools.',
    summary: 'Code-aware help with repo review, diffs, tests and guarded execution.',
    autonomy: 'advanced',
    detailMode: 'advanced',
    explanation: 'technical',
    approvalTone: 'Show diffs and commands before mutation; explain rollback and test impact.',
    riskBoundary: 'Inspecting and patch previews are safe; writes, installs, network and shell execution remain gated.',
    firstMissionIds: ['dev-repo-review', 'safe-audit', 'file-organization'],
    suggestedChannels: ['dashboard', 'cli', 'satellite'],
    suggestedCapabilities: ['repo map', 'code review', 'subagents', 'sandbox shell', 'test runner'],
    checklist: ['Read before editing', 'Show patch preview', 'Run focused verification'],
    naturalPrompts: ['Use Developer mode', 'Review this workspace', 'Show a patch preview first'],
  },
  {
    id: 'business',
    label: 'Business',
    audience: 'Teams and companies that need approvals, receipts, policy and operational evidence.',
    summary: 'Audit-ready operation with stricter approvals and evidence-first outputs.',
    autonomy: 'business',
    detailMode: 'advanced',
    explanation: 'audit',
    approvalTone: 'Precise and scoped: who, what, why, TTL, rollback and receipt.',
    riskBoundary: 'Sensitive actions require scoped approval, policy evidence and receipt before execution.',
    firstMissionIds: ['safe-audit', 'daily-assistant', 'dev-repo-review'],
    suggestedChannels: ['dashboard', 'cli', 'telegram', 'email'],
    suggestedCapabilities: ['approval inbox', 'receipts', 'provider readiness', 'channel readiness', 'scheduler'],
    checklist: ['Show scope and TTL', 'Record evidence', 'Keep every sensitive action reviewable'],
    naturalPrompts: ['Use Business mode', 'Show approvals and receipts', 'Run a readiness audit'],
  },
  {
    id: 'power',
    label: 'Power',
    audience: 'Advanced operators who want runtime visibility without bypassing control.',
    summary: 'Full-depth visibility for providers, channels, scheduler, subagents and device control.',
    autonomy: 'advanced',
    detailMode: 'advanced',
    explanation: 'technical',
    approvalTone: 'Dense but clear: expose runtime choices, budgets, receipts and blocked actions.',
    riskBoundary: 'Advanced visibility never means hidden execution; sensitive actions stay behind policy.',
    firstMissionIds: ['safe-audit', 'dev-repo-review', 'daily-assistant'],
    suggestedChannels: ['dashboard', 'cli', 'satellite', 'telegram'],
    suggestedCapabilities: ['provider mesh', 'channel mesh', 'sandbox lifecycle', 'perception device', 'scheduler'],
    checklist: ['Expose runtime state', 'Keep budgets visible', 'Separate inspection from execution'],
    naturalPrompts: ['Use Power mode', 'Show runtime readiness', 'Inspect channels and providers'],
  },
];

export function resolveExperienceProfile(input: unknown, fallback: ExperienceProfileId = 'personal'): ExperienceProfileUiContract {
  const normalized = normalizeText(input);
  const explicit = EXPERIENCE_PROFILE_CATALOG.find((profile) => profile.id === normalized);
  if (explicit) return explicit;
  return getExperienceProfile(fallback, 'personal');
}

export function getExperienceProfile(profileId: unknown, fallback: ExperienceProfileId = 'personal'): ExperienceProfileUiContract {
  const normalized = normalizeText(profileId);
  return EXPERIENCE_PROFILE_CATALOG.find((profile) => profile.id === normalized)
    || EXPERIENCE_PROFILE_CATALOG.find((profile) => profile.id === fallback)
    || EXPERIENCE_PROFILE_CATALOG[0];
}

export function readStoredExperienceProfile(storage: Storage | null | undefined): ExperienceProfileId {
  try {
    const stored = String(storage?.getItem(EXPERIENCE_PROFILE_STORAGE_KEY) || '').trim();
    return getExperienceProfile(stored).id;
  } catch {
    return 'personal';
  }
}

export function persistExperienceProfile(storage: Storage | null | undefined, profileId: ExperienceProfileId) {
  try {
    storage?.setItem(EXPERIENCE_PROFILE_STORAGE_KEY, profileId);
  } catch {
    // local profile selection is best-effort and must not block chat.
  }
}

export function buildExperienceProfilePayload(profile: ExperienceProfileUiContract) {
  return {
    id: profile.id,
    label: profile.label,
    autonomy: profile.autonomy,
    detailMode: profile.detailMode,
    explanation: profile.explanation,
    approvalTone: profile.approvalTone,
    riskBoundary: profile.riskBoundary,
    suggestedChannels: profile.suggestedChannels,
    suggestedCapabilities: profile.suggestedCapabilities,
    firstMissionIds: profile.firstMissionIds,
    source: 'zavorth-control-experience-profile',
  };
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
