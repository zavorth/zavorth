import {
  ZAVORTH_GUIDED_MISSIONS_CONTRACT_VERSION,
  type ZavorthGuidedMissionCard,
  type ZavorthGuidedMissionCategory,
  type ZavorthGuidedMissionId,
  type ZavorthGuidedMissionSelection,
  type ZavorthGuidedMissionsContract,
} from '../contracts/ZavorthGuidedMissionsContract.js';
import type { ZavorthExperienceProfileId } from '../contracts/ZavorthExperienceProfileContract.js';
import { ZavorthExperienceProfileService } from './ZavorthExperienceProfileService.js';

export type ZavorthGuidedMissionsInput = {
  profile?: unknown;
  intent?: unknown;
  missionId?: unknown;
  category?: unknown;
};

const CATALOG: ZavorthGuidedMissionCard[] = [
  {
    id: 'organize-my-day',
    title: 'Organize my day',
    category: 'daily-life',
    audience: ['personal', 'creator', 'power'],
    summary: 'Build a practical day plan from approved context, reminders and user notes.',
    prompt: 'Help me organize my day from approved local context and ask before creating reminders.',
    defaultRisk: 'low',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['memory-recall', 'schedule-preview', 'receipt-issue'],
    expectedArtifacts: ['day-plan', 'source-list', 'receipt'],
    approvalSummary: 'Creating or sending reminders requires approval; planning stays read-only.',
    safeFirstStep: 'Read approved local context and draft a plan without changing calendars.',
    steps: [
      { id: 'read-context', label: 'Read context', mode: 'read_only', summary: 'Use only approved local notes and memory.' },
      { id: 'draft-plan', label: 'Draft plan', mode: 'preview', summary: 'Create a day plan preview.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Show what sources were used.' },
    ],
    naturalAliases: ['day', 'routine', 'schedule', 'organize my day', 'rotina', 'dia'],
  },
  {
    id: 'summarize-document',
    title: 'Summarize a document',
    category: 'documents',
    audience: ['personal', 'creator', 'business', 'power'],
    summary: 'Summarize a PDF or document with uncertainty, evidence and follow-up questions.',
    prompt: 'Summarize this document and separate facts, uncertainty and recommended follow-up.',
    defaultRisk: 'low',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['document-read', 'evidence-notes', 'receipt-issue'],
    expectedArtifacts: ['summary', 'evidence-notes', 'receipt'],
    approvalSummary: 'Reading an explicitly provided document is read-only; sharing externally requires approval.',
    safeFirstStep: 'Read the document locally and produce a summary preview.',
    steps: [
      { id: 'read-document', label: 'Read document', mode: 'read_only', summary: 'Inspect the provided file.' },
      { id: 'summarize', label: 'Summarize', mode: 'preview', summary: 'Produce a concise summary with evidence.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Record files read and output produced.' },
    ],
    naturalAliases: ['pdf', 'document', 'summarize', 'resumir', 'documento'],
  },
  {
    id: 'organize-files-preview',
    title: 'Organize files safely',
    category: 'daily-life',
    audience: ['personal', 'developer', 'business', 'power'],
    summary: 'Inspect a folder and propose a reversible organization plan before moving anything.',
    prompt: 'Inspect this folder and propose a safe organization plan before changing files.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['workspace-preview', 'rollback-plan', 'receipt-issue'],
    expectedArtifacts: ['preview-plan', 'rollback-plan', 'receipt'],
    approvalSummary: 'Moving, renaming or deleting files requires scoped approval.',
    safeFirstStep: 'List files and propose a plan without changing anything.',
    steps: [
      { id: 'scan-folder', label: 'Scan folder', mode: 'read_only', summary: 'List names, sizes and patterns.' },
      { id: 'preview-plan', label: 'Preview plan', mode: 'preview', summary: 'Show moves and rollback evidence.' },
      { id: 'approval', label: 'Approval', mode: 'approval_required', summary: 'Ask before any move or rename.' },
    ],
    naturalAliases: ['organize files', 'folder', 'files', 'arquivos', 'pasta'],
  },
  {
    id: 'review-this-repository',
    title: 'Review this repository',
    category: 'development',
    audience: ['developer', 'business', 'power'],
    summary: 'Read the repo and report risks, broken flows, tests to run and next actions.',
    prompt: 'Review this repository in read-only mode and list the highest-value risks.',
    defaultRisk: 'low',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['repo-map', 'code-review', 'subagents', 'receipt-issue'],
    expectedArtifacts: ['risk-summary', 'file-map', 'next-actions', 'receipt'],
    approvalSummary: 'Reading is allowed in scope; edits, installs, network and shell require approval.',
    safeFirstStep: 'Map the repository and identify the highest-value files without running commands.',
    steps: [
      { id: 'map-repo', label: 'Map repo', mode: 'read_only', summary: 'Inspect structure and key files.' },
      { id: 'analyze', label: 'Analyze', mode: 'preview', summary: 'Find risks and next actions.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Record files read and findings.' },
    ],
    naturalAliases: ['repo', 'repository', 'code review', 'review project', 'codigo', 'código', 'repositório'],
  },
  {
    id: 'fix-a-bug-safely',
    title: 'Fix a bug safely',
    category: 'development',
    audience: ['developer', 'power'],
    summary: 'Diagnose a bug, propose a patch, show diff and wait for approval before writing.',
    prompt: 'Diagnose this bug, propose a minimal fix and do not edit files until I approve the diff.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['repo-map', 'test-runner', 'apply-patch-preview', 'rollback-plan'],
    expectedArtifacts: ['diagnosis', 'patch-preview', 'test-plan', 'rollback-plan'],
    approvalSummary: 'Patches and test commands require scoped approval.',
    safeFirstStep: 'Read the relevant files and produce a diagnosis with a patch preview.',
    steps: [
      { id: 'diagnose', label: 'Diagnose', mode: 'read_only', summary: 'Find likely root cause.' },
      { id: 'patch-preview', label: 'Patch preview', mode: 'preview', summary: 'Show exact changes.' },
      { id: 'approval', label: 'Approval', mode: 'approval_required', summary: 'Ask before writing or running tests.' },
    ],
    naturalAliases: ['bug', 'fix', 'patch', 'corrigir', 'erro'],
  },
  {
    id: 'prepare-release-notes',
    title: 'Prepare release notes',
    category: 'development',
    audience: ['developer', 'creator', 'business', 'power'],
    summary: 'Turn recent changes into release notes with risk notes and omitted uncertainty.',
    prompt: 'Prepare release notes from the available project context and do not publish anything.',
    defaultRisk: 'low',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['git-read', 'summary', 'receipt-issue'],
    expectedArtifacts: ['release-notes-draft', 'evidence-notes'],
    approvalSummary: 'Publishing or tagging releases requires approval; drafting does not.',
    safeFirstStep: 'Read local project history/context and draft notes only.',
    steps: [
      { id: 'read-context', label: 'Read context', mode: 'read_only', summary: 'Inspect local changes and docs.' },
      { id: 'draft', label: 'Draft notes', mode: 'preview', summary: 'Create a release note draft.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Record sources used.' },
    ],
    naturalAliases: ['release', 'changelog', 'notes', 'release notes'],
  },
  {
    id: 'business-status-report',
    title: 'Business status report',
    category: 'business',
    audience: ['business', 'power'],
    summary: 'Create an operational report with sources, blockers, risk and next decisions.',
    prompt: 'Prepare a business status report from approved sources with blockers and next decisions.',
    defaultRisk: 'low',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['approved-source-read', 'receipt-issue', 'scheduler-preview'],
    expectedArtifacts: ['status-report', 'source-list', 'decision-list'],
    approvalSummary: 'Reading approved sources is safe; sending the report requires approval.',
    safeFirstStep: 'Draft a report from approved local or connected sources.',
    steps: [
      { id: 'collect', label: 'Collect sources', mode: 'read_only', summary: 'Use only approved inputs.' },
      { id: 'report', label: 'Build report', mode: 'preview', summary: 'Summarize status and decisions.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Record evidence and omissions.' },
    ],
    naturalAliases: ['status report', 'business report', 'relatório', 'empresa'],
  },
  {
    id: 'audit-sensitive-change',
    title: 'Audit a sensitive change',
    category: 'security',
    audience: ['business', 'developer', 'power'],
    summary: 'Review a proposed sensitive change with policy, risk, rollback and receipt evidence.',
    prompt: 'Audit this proposed sensitive change and produce policy, risk and rollback evidence.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['policy-broker', 'diff-review', 'rollback-plan', 'receipt-issue'],
    expectedArtifacts: ['audit-report', 'risk-decision', 'rollback-plan', 'receipt'],
    approvalSummary: 'Applying the change requires explicit scoped approval.',
    safeFirstStep: 'Review the change and produce an audit report without applying it.',
    steps: [
      { id: 'review', label: 'Review change', mode: 'read_only', summary: 'Inspect proposed change.' },
      { id: 'risk', label: 'Assess risk', mode: 'preview', summary: 'Classify policy and rollback needs.' },
      { id: 'approval', label: 'Approval', mode: 'approval_required', summary: 'Ask before any mutation.' },
    ],
    naturalAliases: ['audit', 'security', 'sensitive', 'risk', 'segurança', 'auditoria'],
  },
  {
    id: 'connect-a-channel',
    title: 'Connect a channel',
    category: 'automation',
    audience: ['personal', 'business', 'power'],
    summary: 'Guide the user through connecting Telegram, email or another channel safely.',
    prompt: 'Help me connect a channel and validate readiness without exposing the token.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['channel-readiness', 'secret-ref-guide', 'doctor'],
    expectedArtifacts: ['setup-guide', 'readiness-report'],
    approvalSummary: 'Tokens must be stored as SecretRefs; live sends require approval.',
    safeFirstStep: 'Explain the channel setup steps and check readiness without collecting raw secrets.',
    steps: [
      { id: 'choose-channel', label: 'Choose channel', mode: 'preview', summary: 'Pick the channel and setup path.' },
      { id: 'secretref', label: 'SecretRef guide', mode: 'preview', summary: 'Store credentials safely.' },
      { id: 'test', label: 'Readiness test', mode: 'approval_required', summary: 'Ask before live network test.' },
    ],
    naturalAliases: ['telegram', 'whatsapp', 'email', 'channel', 'connect', 'canal'],
  },
  {
    id: 'create-safe-routine',
    title: 'Create a safe routine',
    category: 'automation',
    audience: ['personal', 'business', 'power'],
    summary: 'Plan a scheduled task with scope, TTL, budget, kill switch and receipts.',
    prompt: 'Create a safe routine for this task with scope, renewal, budget and receipts.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['scheduler-preview', 'policy-broker', 'receipt-issue'],
    expectedArtifacts: ['schedule-preview', 'scope-envelope', 'receipt'],
    approvalSummary: 'Activating a recurring task requires scoped pre-approval.',
    safeFirstStep: 'Preview the schedule, scope and budget without creating the task.',
    steps: [
      { id: 'scope', label: 'Define scope', mode: 'preview', summary: 'Set exact allowed work.' },
      { id: 'budget', label: 'Set budget', mode: 'preview', summary: 'Add time/tool/token limits.' },
      { id: 'approval', label: 'Approval', mode: 'approval_required', summary: 'Ask before activation.' },
    ],
    naturalAliases: ['schedule', 'routine', 'cron', 'automation', 'rotina', 'agendar'],
  },
  {
    id: 'check-my-computer',
    title: 'Check my computer',
    category: 'device-help',
    audience: ['personal', 'developer', 'power'],
    summary: 'Inspect visible state or diagnostics with read-only perception before any control.',
    prompt: 'Check my computer visually or diagnostically and ask before controlling anything.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['screen-capture', 'doctor', 'receipt-issue'],
    expectedArtifacts: ['visual-artifact', 'diagnostic-summary', 'receipt'],
    approvalSummary: 'Screenshots can expose private data; control actions require approval.',
    safeFirstStep: 'Ask for/obtain a read-only screenshot or diagnostic summary.',
    steps: [
      { id: 'observe', label: 'Observe', mode: 'approval_required', summary: 'Request safe visual observation.' },
      { id: 'diagnose', label: 'Diagnose', mode: 'preview', summary: 'Explain what was seen.' },
      { id: 'receipt', label: 'Issue receipt', mode: 'receipt', summary: 'Record artifacts used.' },
    ],
    naturalAliases: ['computer', 'pc', 'screen', 'screenshot', 'computador', 'tela'],
  },
  {
    id: 'look-at-my-phone',
    title: 'Look at my phone',
    category: 'device-help',
    audience: ['personal', 'developer', 'power'],
    summary: 'Use Android ADB observation/zavorthControl only when configured and approved.',
    prompt: 'Look at my connected phone, explain what you see and ask before tapping or typing.',
    defaultRisk: 'medium',
    mutatesByDefault: false,
    requiresNetworkByDefault: false,
    likelyCapabilities: ['adb-observe', 'visual-artifact', 'policy-broker'],
    expectedArtifacts: ['phone-screenshot', 'diagnostic-summary', 'receipt'],
    approvalSummary: 'ADB observe/zavorthControl requires explicit approval and host readiness.',
    safeFirstStep: 'Check ADB readiness and request observation approval before capturing.',
    steps: [
      { id: 'adb-readiness', label: 'ADB readiness', mode: 'read_only', summary: 'Check whether device bridge is configured.' },
      { id: 'observe', label: 'Observe phone', mode: 'approval_required', summary: 'Capture/inspect only after approval.' },
      { id: 'control', label: 'Control', mode: 'approval_required', summary: 'Tap/type/install only after scoped approval.' },
    ],
    naturalAliases: ['phone', 'android', 'adb', 'cellphone', 'celular', 'telefone'],
  },
];

const CATEGORY_LABELS: Record<ZavorthGuidedMissionCategory, string> = {
  'daily-life': 'Daily life',
  documents: 'Documents',
  development: 'Development',
  business: 'Business',
  automation: 'Automation',
  security: 'Security',
  'device-help': 'Device help',
};

export class ZavorthGuidedMissionsService {
  private readonly experienceProfiles = new ZavorthExperienceProfileService();

  public buildContract(input: ZavorthGuidedMissionsInput = {}): ZavorthGuidedMissionsContract {
    const experience = this.experienceProfiles.buildContract({
      profile: input.profile,
      intent: input.intent,
    });
    const selectedProfile = experience.selected.profileId;
    const catalog = this.listMissions(input.category);
    const selection = this.resolveMission({
      missionId: input.missionId,
      intent: input.intent,
      selectedProfile,
      catalog,
    });
    const recommended = catalog.find((mission) => mission.id === selection.missionId) || catalog[0] || CATALOG[0];

    return {
      contractVersion: ZAVORTH_GUIDED_MISSIONS_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'guided-missions',
      selectedProfile,
      selection,
      recommended,
      catalog,
      categories: buildCategories(catalog),
      startProjection: {
        command: `zavorth missions start --template ${recommended.id} --preview`,
        previewOnlyByDefault: true,
        zavorthControlRoute: '/zavorthControl',
        policyBrokerRequired: true,
        zavorthControlCanExecute: false,
      },
      safety: {
        guidedDoesNotBypassPolicy: true,
        mutationRequiresApproval: true,
        receiptsRequired: true,
        rawSecretsSerialized: false,
      },
      invariants: [
        'Guided missions make the first action obvious without turning the zavorthControl into an execution authority.',
        'Every mission starts with a safe read-only or preview step unless the user approves a sensitive action.',
        'Mission cards explain risk, capabilities, artifacts and approvals before work begins.',
        'Personal, Developer and Business users see different recommendations over the same governed runtime.',
      ],
    };
  }

  public listMissions(category?: unknown): ZavorthGuidedMissionCard[] {
    const normalized = normalize(category);
    const cards = normalized
      ? CATALOG.filter((mission) => mission.category === normalized)
      : CATALOG;
    return cards.map((mission) => ({
      ...mission,
      audience: [...mission.audience],
      likelyCapabilities: [...mission.likelyCapabilities],
      expectedArtifacts: [...mission.expectedArtifacts],
      steps: mission.steps.map((step) => ({ ...step })),
      naturalAliases: [...mission.naturalAliases],
    }));
  }

  public renderText(contract: ZavorthGuidedMissionsContract): string {
    return [
      '[zavorth-guided-missions]',
      `profile=${contract.selectedProfile}`,
      `recommended=${contract.recommended.id} | risk=${contract.recommended.defaultRisk}`,
      `selection=${contract.selection.confidence} | ${contract.selection.reason}`,
      '',
      '[recommended]',
      `${contract.recommended.title}: ${contract.recommended.summary}`,
      `safe first step: ${contract.recommended.safeFirstStep}`,
      `approval: ${contract.recommended.approvalSummary}`,
      `artifacts: ${contract.recommended.expectedArtifacts.join(', ')}`,
      '',
      '[catalog]',
      ...contract.catalog.map((mission) =>
        `- ${mission.id}: ${mission.title} | ${mission.category} | risk=${mission.defaultRisk} | mutate=${mission.mutatesByDefault ? 'yes' : 'no'}`,
      ),
      '',
      `start=${contract.startProjection.command}`,
      '',
    ].join('\n');
  }

  private resolveMission(input: {
    missionId?: unknown;
    intent?: unknown;
    selectedProfile: ZavorthExperienceProfileId;
    catalog: ZavorthGuidedMissionCard[];
  }): ZavorthGuidedMissionSelection {
    const explicit = normalize(input.missionId) as ZavorthGuidedMissionId;
    if (explicit && input.catalog.some((mission) => mission.id === explicit)) {
      return {
        missionId: explicit,
        confidence: 'explicit',
        reason: `Mission "${explicit}" was explicitly selected.`,
        matchedSignals: [explicit],
      };
    }

    const intent = normalize(input.intent);
    if (intent) {
      const scored = input.catalog
        .map((mission) => {
          const matchedSignals = mission.naturalAliases.filter((alias) => intent.includes(normalize(alias)));
          return {
            mission,
            matchedSignals,
            score: matchedSignals.reduce((total, signal) => total + Math.max(1, normalize(signal).split(' ').length), 0),
          };
        })
        .sort((a, b) => b.score - a.score);
      const winner = scored[0];
      if (winner && winner.score > 0) {
        return {
          missionId: winner.mission.id,
          confidence: winner.score >= 2 ? 'high' : 'medium',
          reason: `Intent matched "${winner.mission.title}" mission signals.`,
          matchedSignals: winner.matchedSignals,
        };
      }
    }

    const fallback = input.catalog.find((mission) => mission.audience.includes(input.selectedProfile))
      || input.catalog[0]
      || CATALOG[0];
    return {
      missionId: fallback.id,
      confidence: 'fallback',
      reason: `Selected the first safe mission for the ${input.selectedProfile} experience.`,
      matchedSignals: [input.selectedProfile],
    };
  }
}

function buildCategories(catalog: ZavorthGuidedMissionCard[]): ZavorthGuidedMissionsContract['categories'] {
  const counts = new Map<ZavorthGuidedMissionCategory, number>();
  for (const mission of catalog) {
    counts.set(mission.category, (counts.get(mission.category) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([id, count]) => ({
    id,
    title: CATEGORY_LABELS[id],
    count,
  }));
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
