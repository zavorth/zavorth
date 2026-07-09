import type {
  ZavorthExperienceProfile,
  ZavorthExperienceProfileContract,
  ZavorthExperienceProfileId,
  ZavorthExperienceProfileResolution,
} from '../contracts/ZavorthExperienceProfileContract.js';
import {
  ZAVORTH_EXPERIENCE_PROFILE_IDS,
} from '../contracts/ZavorthExperienceProfileContract.js';
import {
  normalizeZavorthProductDailyMode,
  normalizeZavorthProductDetailMode,
} from '../contracts/ZavorthProductModeContract.js';

export type ZavorthExperienceProfileInput = {
  profile?: unknown;
  intent?: unknown;
  dailyMode?: unknown;
  detailMode?: unknown;
};

const PROFILE_CATALOG: ZavorthExperienceProfile[] = [
  {
    id: 'personal',
    label: 'Personal',
    audience: 'Daily users who want a fast, autonomous agent for routine tasks, messages, files and reminders.',
    summary: 'Maximum autonomy with plain language. Applies improvements instantly, only blocks security-sensitive actions.',
    defaultDailyMode: 'personal',
    defaultDetailMode: 'simple',
    autonomy: 'full',
    explanation: 'plain',
    firstMissionIds: ['daily-assistant', 'pdf-summary', 'file-organization'],
    suggestedChannels: ['zavorthControl', 'satellite', 'telegram'],
    suggestedCapabilities: ['reminders', 'documents', 'files', 'channel-approvals'],
    approvalTone: 'Minimal interruptions: only ask for security, external sends and destructive actions.',
    riskBoundary: 'Can read, write, research and apply low-risk improvements freely. Security, external sends and destructive actions require approval.',
    naturalAliases: [
      'personal',
      'daily',
      'home',
      'routine',
      'dona maria',
      'simple user',
      'day to day',
      'dia a dia',
      'pessoal',
      'rotina',
      'casa',
    ],
  },
  {
    id: 'creator',
    label: 'Creator',
    audience: 'People creating content, pages, posts, scripts, research notes and lightweight automations.',
    summary: 'Research, draft, polish and publish-ready preparation with clear source and approval boundaries.',
    defaultDailyMode: 'personal',
    defaultDetailMode: 'simple',
    autonomy: 'balanced',
    explanation: 'guided',
    firstMissionIds: ['web-research-governed', 'pdf-summary', 'daily-assistant'],
    suggestedChannels: ['zavorthControl', 'satellite', 'telegram'],
    suggestedCapabilities: ['web-research', 'document-analysis', 'media-analysis', 'drafting'],
    approvalTone: 'Preview content and sources before publishing, posting or contacting people.',
    riskBoundary: 'Can draft and research; publishing, network actions and account access require approval.',
    naturalAliases: [
      'creator',
      'content',
      'writer',
      'research',
      'marketing',
      'post',
      'script',
      'criador',
      'conteudo',
      'pesquisa',
      'roteiro',
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    audience: 'Developers, solo builders and vibe coders working with repositories, tests, patches and local tools.',
    summary: 'Code-aware assistance with repo review, subagents, tests, diffs, receipts and guarded execution.',
    defaultDailyMode: 'personal',
    defaultDetailMode: 'advanced',
    autonomy: 'advanced',
    explanation: 'technical',
    firstMissionIds: ['dev-repo-review', 'safe-audit', 'file-organization'],
    suggestedChannels: ['zavorthControl', 'cli', 'satellite'],
    suggestedCapabilities: ['repo-map', 'code-review', 'subagents', 'sandbox-shell', 'test-runner'],
    approvalTone: 'Show diffs and commands before mutation; explain rollback and test impact.',
    riskBoundary: 'Can inspect code and propose patches; writes, installs, network and shell execution require policy gates.',
    naturalAliases: [
      'developer',
      'dev',
      'coding',
      'code',
      'repo',
      'vibe coding',
      'programming',
      'programador',
      'desenvolvedor',
      'codigo',
      'repositório',
      'vibe coder',
    ],
  },
  {
    id: 'business',
    label: 'Business',
    audience: 'Teams and companies that need approvals, audit trails, policy, receipts and operational evidence.',
    summary: 'Audit-heavy operation with stricter approvals, business-safe wording and evidence-first outputs.',
    defaultDailyMode: 'governed',
    defaultDetailMode: 'advanced',
    autonomy: 'business',
    explanation: 'audit',
    firstMissionIds: ['safe-audit', 'daily-assistant', 'dev-repo-review'],
    suggestedChannels: ['zavorthControl', 'cli', 'telegram', 'email'],
    suggestedCapabilities: ['approval-inbox', 'receipts', 'provider-readiness', 'channel-readiness', 'scheduler'],
    approvalTone: 'Precise, auditable and scoped: who, what, why, TTL, rollback and receipt.',
    riskBoundary: 'No sensitive action proceeds without scoped approval, policy evidence and a receipt.',
    naturalAliases: [
      'business',
      'company',
      'enterprise',
      'team',
      'audit',
      'compliance',
      'operator',
      'empresa',
      'equipe',
      'auditoria',
      'governado',
      'compliance',
    ],
  },
  {
    id: 'power',
    label: 'Power',
    audience: 'Advanced operators who want maximum runtime visibility without bypassing governance.',
    summary: 'Full-depth operation for people who want providers, channels, subagents, scheduler and device control visible.',
    defaultDailyMode: 'governed',
    defaultDetailMode: 'advanced',
    autonomy: 'advanced',
    explanation: 'technical',
    firstMissionIds: ['safe-audit', 'dev-repo-review', 'daily-assistant'],
    suggestedChannels: ['zavorthControl', 'cli', 'satellite', 'telegram'],
    suggestedCapabilities: ['provider-mesh', 'channel-mesh', 'sandbox-lifecycle', 'perception-device', 'scheduler'],
    approvalTone: 'Dense but clear: expose runtime choices, budgets, receipts and blocked actions.',
    riskBoundary: 'Advanced visibility never means hidden execution; Policy Broker remains the authority.',
    naturalAliases: [
      'power',
      'advanced',
      'expert',
      'full control',
      'operator mode',
      'runtime',
      'avancado',
      'avançado',
      'especialista',
      'controle total',
      'operador',
    ],
  },
];

const FALLBACK_PROFILE_ID: ZavorthExperienceProfileId = 'personal';

export class ZavorthExperienceProfileService {
  public listProfiles(): ZavorthExperienceProfile[] {
    return PROFILE_CATALOG.map((profile) => ({
      ...profile,
      firstMissionIds: [...profile.firstMissionIds],
      suggestedChannels: [...profile.suggestedChannels],
      suggestedCapabilities: [...profile.suggestedCapabilities],
      naturalAliases: [...profile.naturalAliases],
    }));
  }

  public buildContract(input: ZavorthExperienceProfileInput = {}): ZavorthExperienceProfileContract {
    const profiles = this.listProfiles();
    const resolution = this.resolve(input);
    const selectedProfile = profiles.find((profile) => profile.id === resolution.profileId) || profiles[0];
    const dailyMode = normalizeZavorthProductDailyMode(input.dailyMode, selectedProfile.defaultDailyMode);
    const detailMode = normalizeZavorthProductDetailMode(input.detailMode, selectedProfile.defaultDetailMode);

    return {
      schemaVersion: 1,
      surface: 'experience-profile',
      selected: {
        profileId: selectedProfile.id,
        dailyMode,
        detailMode,
        autonomy: selectedProfile.autonomy,
        explanation: selectedProfile.explanation,
      },
      resolution,
      profiles,
      naturalSwitchExamples: [
        'use personal mode for daily life',
        'switch to developer mode for this repository',
        'make this more business/governed',
        'I am doing vibe coding',
        'quero algo simples para meu dia a dia',
        'quero modo empresa com auditoria',
      ],
      invariants: [
        'Experience profiles change defaults, language and surfaces, not execution authority.',
        'Personal/Governed remains the security posture beneath every experience profile.',
        'Every sensitive action still passes through Policy Broker, scoped approval and receipts.',
        'The user can switch profile through natural language without knowing internal commands.',
      ],
    };
  }

  public resolve(input: ZavorthExperienceProfileInput = {}): ZavorthExperienceProfileResolution {
    const explicit = normalizeProfileId(input.profile);
    if (explicit) {
      return {
        profileId: explicit,
        confidence: 'explicit',
        reason: `Profile "${explicit}" was explicitly requested.`,
        matchedSignals: [explicit],
      };
    }

    const intent = normalizeText(input.intent);
    if (!intent) {
      return fallbackResolution('No profile or intent was provided.');
    }

    const scored = PROFILE_CATALOG
      .map((profile) => {
        const matchedSignals = profile.naturalAliases.filter((alias) =>
          intent.includes(normalizeText(alias)),
        );
        return {
          profile,
          matchedSignals,
          score: matchedSignals.reduce((total, signal) => total + Math.max(1, normalizeText(signal).split(' ').length), 0),
        };
      })
      .sort((a, b) => b.score - a.score);

    const winner = scored[0];
    if (!winner || winner.score <= 0) {
      return fallbackResolution('No strong experience signal was detected.');
    }

    return {
      profileId: winner.profile.id,
      confidence: winner.score >= 2 ? 'high' : 'medium',
      reason: `Intent matched ${winner.profile.label} experience signals.`,
      matchedSignals: winner.matchedSignals,
    };
  }

  public renderText(contract: ZavorthExperienceProfileContract): string {
    const selectedProfile = contract.profiles.find((profile) => profile.id === contract.selected.profileId);
    const lines = [
      '[zavorth-experience] profile system',
      `selected: ${contract.selected.profileId} | posture: ${contract.selected.dailyMode}/${contract.selected.detailMode}`,
      `autonomy: ${contract.selected.autonomy} | explanation: ${contract.selected.explanation}`,
      `resolution: ${contract.resolution.confidence} | ${contract.resolution.reason}`,
    ];

    if (selectedProfile) {
      lines.push(
        '',
        `[${selectedProfile.label}]`,
        selectedProfile.summary,
        `audience: ${selectedProfile.audience}`,
        `first missions: ${selectedProfile.firstMissionIds.join(', ')}`,
        `channels: ${selectedProfile.suggestedChannels.join(', ')}`,
        `capabilities: ${selectedProfile.suggestedCapabilities.join(', ')}`,
        `risk: ${selectedProfile.riskBoundary}`,
      );
    }

    lines.push(
      '',
      '[profiles]',
      ...contract.profiles.map((profile) =>
        `- ${profile.id}: ${profile.summary} (${profile.defaultDailyMode}/${profile.defaultDetailMode})`,
      ),
    );

    return `${lines.join('\n')}\n`;
  }
}

function normalizeProfileId(value: unknown): ZavorthExperienceProfileId | null {
  const normalized = normalizeText(value);
  return ZAVORTH_EXPERIENCE_PROFILE_IDS.includes(normalized as ZavorthExperienceProfileId)
    ? normalized as ZavorthExperienceProfileId
    : null;
}

function fallbackResolution(reason: string): ZavorthExperienceProfileResolution {
  return {
    profileId: FALLBACK_PROFILE_ID,
    confidence: 'fallback',
    reason,
    matchedSignals: [],
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
