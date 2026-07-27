import { createHash } from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION,
  type ZavorthCapabilityMeshCandidate,
  type ZavorthCapabilityMeshCandidateKind,
  type ZavorthCapabilityMeshCoverage,
  type ZavorthCapabilityMeshDecision,
  type ZavorthCapabilityMeshRisk,
  type ZavorthCapabilityMeshSnapshot,
  type ZavorthCapabilityMeshStatus,
} from '../contracts/ZavorthCapabilityMeshContract.js';
import type { ZavorthExternalAgentGatewayRegistrySnapshot } from '../contracts/ZavorthExternalAgentGatewayContract.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import { ZavorthExternalAgentGatewayService } from './ZavorthExternalAgentGatewayService.js';
import { logger } from '../logger.js';

export type ZavorthCapabilityMeshInput = {
  requestText?: string | null;
  requestedBy?: string | null;
  channel?: string | null;
  preferExternal?: boolean;
  allowExternalAgents?: boolean;
  allowSkillCreation?: boolean;
  allowExternalAdaptation?: boolean;
  maxCandidates?: number | null;
};

export type ZavorthCapabilityMeshRuntime = {
  now?: () => Date;
  projectRoot?: string;
  skillCatalogService?: Pick<SkillCatalogService, 'listEntries'>;
  externalAgentGatewayService?: Pick<ZavorthExternalAgentGatewayService, 'buildRegistrySnapshot'>;
};

type CandidateDraft = Omit<ZavorthCapabilityMeshCandidate, 'score' | 'coverage'> & {
  rawScore: number;
};

const DEFAULT_MAX_CANDIDATES = 8;
const STOP_WORDS = new Set([
  'a',
  'as',
  'ao',
  'aos',
  'de',
  'do',
  'dos',
  'da',
  'das',
  'e',
  'em',
  'na',
  'no',
  'nos',
  'nas',
  'o',
  'os',
  'para',
  'por',
  'que',
  'um',
  'uma',
  'use',
  'usar',
  'com',
  'me',
  'meu',
  'minha',
  'the',
  'and',
  'for',
  'with',
]);

export class ZavorthCapabilityMeshService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly skillCatalog: Pick<SkillCatalogService, 'listEntries'>;
  private readonly externalGateway: Pick<ZavorthExternalAgentGatewayService, 'buildRegistrySnapshot'>;

  public constructor(runtime: ZavorthCapabilityMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.skillCatalog = runtime.skillCatalogService || new SkillCatalogService();
    this.externalGateway = runtime.externalAgentGatewayService || new ZavorthExternalAgentGatewayService({
      projectRoot: this.projectRoot,
    });
  }

  public buildSnapshot(input: ZavorthCapabilityMeshInput = {}): ZavorthCapabilityMeshSnapshot {
    const requestText = cleanText(input.requestText) || 'available capability status';
    const tokens = tokenize(requestText);
    const skills = safeRead(() => this.skillCatalog.listEntries(), [] as SkillCatalogEntry[]);
    const externalRegistry = safeRead(
      () => this.externalGateway.buildRegistrySnapshot(),
      emptyExternalRegistry(this.now().toISOString()),
    );
    const allowExternal = input.allowExternalAgents !== false;
    const allowSkillCreation = input.allowSkillCreation !== false;
    const allowExternalAdaptation = input.allowExternalAdaptation !== false;
    const candidates = this.rankCandidates([
      ...this.buildInternalSkillCandidates(skills, requestText, tokens),
      ...this.buildCompositionCandidates(skills, requestText, tokens),
      ...(allowSkillCreation ? [this.buildSkillCreationCandidate(requestText, tokens)] : []),
      ...(allowExternal ? this.buildExternalAgentCandidates(externalRegistry, requestText, tokens, input.preferExternal === true) : []),
      ...(allowExternal && allowExternalAdaptation ? this.buildExternalAdaptationCandidates(externalRegistry, requestText, tokens) : []),
    ]).slice(0, clampMax(input.maxCandidates));
    const selected = this.selectDecision(candidates);
    const status = statusFor(selected.decision, candidates);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CAPABILITY_MESH_CONTRACT_VERSION,
      surface: 'capability-mesh',
      status,
      request: {
        text: requestText,
        requestedBy: cleanText(input.requestedBy) || 'operator',
        channel: cleanText(input.channel) || 'cli',
        normalizedTokens: tokens,
      },
      inventory: {
        internalSkills: skills.length,
        externalProfiles: externalRegistry.summary.total,
        enabledExternalProfiles: externalRegistry.summary.enabled,
        liveExternalProfiles: externalRegistry.summary.liveEnabled,
        stronglyIsolatedExternalProfiles: externalRegistry.summary.stronglyIsolated,
      },
      selected,
      candidates,
      orchestration: {
        checkedInternalSkillsFirst: true,
        consideredSkillComposition: true,
        consideredSkillCreation: true,
        consideredConnectedExternalAgents: true,
        consideredExternalAdaptation: true,
        noExternalAgentInvokedDuringArbitration: true,
        noSkillInstalledDuringArbitration: true,
      },
      policy: {
        zavorthNativePreferred: true,
        exactInternalSkillWinsByDefault: true,
        externalAgentRequiresConnectedProfile: true,
        externalDelegationRequiresApproval: true,
        skillCreationStartsAsDraft: true,
        externalCapabilityImportRequiresReview: true,
      },
      safety: {
        readOnlyInventory: true,
        noNetworkProbe: true,
        noProcessStarted: true,
        noCredentialSerialization: true,
        noToolExposure: true,
        perRunApprovalStillRequired: true,
      },
      commands: {
        inspect: 'zavorth capability-mesh --request "<request>"',
        json: 'npm run zavorth:capability-mesh:json -- --request "<request>"',
        check: 'npm run zavorth:capability-mesh:check --silent',
      },
    };
  }

  public renderText(snapshot: ZavorthCapabilityMeshSnapshot): string {
    const lines = [
      'Zavorth Capability Mesh',
      `Status: ${snapshot.status}`,
      `request: ${snapshot.request.text}`,
      `Inventory: skills=${snapshot.inventory.internalSkills}, agents=${snapshot.inventory.externalProfiles}, live=${snapshot.inventory.liveExternalProfiles}`,
      '',
      `Decision: ${snapshot.selected.decision}`,
      snapshot.selected.summary,
    ];
    if (snapshot.selected.nextCommand) {
      lines.push(`Suggested command: ${snapshot.selected.nextCommand}`);
    }
    lines.push('', 'Candidates');
    for (const candidate of snapshot.candidates) {
      lines.push(
        `- ${candidate.id}: ${candidate.kind} score=${candidate.score} coverage=${candidate.coverage} risk=${candidate.risk}`,
        `  ${candidate.label}`,
        `  approval=${candidate.requiresApproval ? 'yes' : 'no'} executeNow=${candidate.canExecuteNow ? 'yes' : 'no'}`,
        `  reason=${candidate.reasons.join(' ')}`,
      );
    }
    lines.push(
      '',
      'Garantias',
      '- inventario read-only',
      '- nenhum agente external invocado durante arbitragem',
      '- no skill installed during arbitration',
      '- external delegation and import still require approval',
    );
    return `${lines.join('\n')}\n`;
  }

  private buildInternalSkillCandidates(
    skills: SkillCatalogEntry[],
    requestText: string,
    tokens: string[],
  ): CandidateDraft[] {
    return skills
      .map((skill) => {
        const match = scoreText(tokens, [
          skill.name,
          skill.description,
          skill.searchText,
          skill.bundleTags.join(' '),
        ].join(' '));
        const trustBonus = skill.sourceTrust === 'trusted' || skill.sourceTrust === null ? 8 : skill.sourceTrust === 'review' ? 2 : -20;
        const localBonus = skill.imported ? 0 : 6;
        const rawScore = match.score + trustBonus + localBonus;
        return candidateDraft({
          kind: 'internal-skill',
          label: `Skill interna: ${skill.name}`,
          sourceRef: skill.id,
          rawScore,
          risk: skill.risk?.level === 'high' || skill.sourceTrust === 'blocked' ? 'high' : 'low',
          requiresApproval: skill.risk?.reviewRequired === true || skill.sourceTrust === 'review',
          canExecuteNow: skill.sourceTrust !== 'blocked',
          reasons: [
            match.overlaps.length > 0 ? `Combina com ${match.overlaps.join(', ')}.` : 'Skill interna candidata por catalog.',
            skill.imported ? 'Skill importada; manter provenance.' : 'Skill local Zavorth-native.',
          ],
          evidence: [skill.description, `tags=${skill.bundleTags.join(',') || 'none'}`],
          command: `zavorth skills use ${quoteArg(skill.name)} --intent ${quoteArg(requestText)}`,
          metadata: {
            skillName: skill.name,
            imported: skill.imported,
          },
        });
      })
      .filter((candidate) => candidate.rawScore >= 10)
      .sort((a, b) => b.rawScore - a.rawScore)
      .slice(0, 6);
  }

  private buildCompositionCandidates(
    skills: SkillCatalogEntry[],
    requestText: string,
    tokens: string[],
  ): CandidateDraft[] {
    const partials = this.buildInternalSkillCandidates(skills, requestText, tokens)
      .filter((candidate) => candidate.rawScore >= 16)
      .slice(0, 3);
    if (partials.length < 2 || !looksCompositional(requestText)) {
      return [];
    }
    const names = partials.map((candidate) => candidate.metadata.skillName || candidate.label);
    return [candidateDraft({
      kind: 'skill-composition',
      label: `Compor skills internas: ${names.join(' + ')}`,
      sourceRef: names.join('+'),
      rawScore: Math.min(88, partials.reduce((sum, candidate) => sum + candidate.rawScore, 0) / partials.length + 18),
      risk: partials.some((candidate) => candidate.risk !== 'low') ? 'medium' : 'low',
      requiresApproval: partials.some((candidate) => candidate.requiresApproval),
      canExecuteNow: partials.every((candidate) => candidate.canExecuteNow),
      reasons: ['Request appears multi-step; composition avoids creating an external dependency.', `Skills: ${names.join(', ')}.`],
      evidence: partials.flatMap((candidate) => candidate.evidence).slice(0, 5),
      command: `zavorth capability-mesh --request ${quoteArg(requestText)} --compose`,
      metadata: {
        skillNames: names.filter(Boolean) as string[],
      },
    })];
  }

  private buildSkillCreationCandidate(requestText: string, tokens: string[]): CandidateDraft {
    const rawScore = tokens.length >= 4 ? 46 : 28;
    return candidateDraft({
      kind: 'create-zavorth-skill',
      label: 'Create Zavorth-native skill draft',
      sourceRef: 'skill-evolution',
      rawScore,
      risk: 'medium',
      requiresApproval: true,
      canExecuteNow: false,
      reasons: [
        'Fallback when no exact capability wins through structured scoring.',
        'Creation starts as draft/sandbox; installation requires approval.',
      ],
      evidence: [`intent=${requestText}`],
      command: `zavorth capability-mesh --request ${quoteArg(requestText)} --create-skill-draft`,
      metadata: {},
    });
  }

  private buildExternalAgentCandidates(
    registry: ZavorthExternalAgentGatewayRegistrySnapshot,
    requestText: string,
    tokens: string[],
    preferExternal: boolean,
  ): CandidateDraft[] {
    return registry.profiles
      .map((profile) => {
        const match = scoreText(tokens, [
          profile.id,
          profile.label,
          profile.adapter,
          profile.command || '',
          profile.root || '',
          profile.allowedCapabilities.join(' '),
        ].join(' '));
        const liveBonus = profile.liveExecutionEnabled ? 12 : -8;
        const enabledBonus = profile.status === 'enabled' ? 8 : -25;
        const isolationBonus = profile.isolation.strongBoundary ? 7 : 0;
        const preferBonus = preferExternal ? 10 : 0;
        const rawScore = match.score + liveBonus + enabledBonus + isolationBonus + preferBonus + 4;
        return candidateDraft({
          kind: 'external-agent',
          label: `Agente external conectado: ${profile.label}`,
          sourceRef: profile.id,
          rawScore,
          risk: profile.isolation.strongBoundary ? 'medium' : 'high',
          requiresApproval: true,
          canExecuteNow: profile.status === 'enabled' && profile.liveExecutionEnabled,
          reasons: [
            match.overlaps.length > 0 ? `Perfil combina com ${match.overlaps.join(', ')}.` : 'Perfil external approved pode ajudar como braco governado.',
            profile.isolation.strongBoundary ? `Isolamento forte: ${profile.isolation.kind}.` : 'without sandbox forte; usar com cautela.',
            'External delegation requires approval for each call.',
          ],
          evidence: [`adapter=${profile.adapter}`, `capabilities=${profile.allowedCapabilities.join(',')}`],
          command: `zavorth external-agent run --id ${profile.id} --prompt ${quoteArg(requestText)}`,
          metadata: {
            externalProfileId: profile.id,
            externalAdapter: profile.adapter,
            liveEnabled: profile.liveExecutionEnabled,
            isolationKind: profile.isolation.kind,
          },
        });
      })
      .filter((candidate) => candidate.rawScore >= 10)
      .sort((a, b) => b.rawScore - a.rawScore)
      .slice(0, 5);
  }

  private buildExternalAdaptationCandidates(
    registry: ZavorthExternalAgentGatewayRegistrySnapshot,
    requestText: string,
    tokens: string[],
  ): CandidateDraft[] {
    return registry.profiles
      .filter((profile) => profile.status === 'enabled')
      .map((profile) => {
        const match = scoreText(tokens, `${profile.label} ${profile.command || ''} ${profile.allowedCapabilities.join(' ')}`);
        return candidateDraft({
          kind: 'adapt-external-capability',
          label: `Adaptar capacidade de ${profile.label} para skill Zavorth-native`,
          sourceRef: profile.id,
          rawScore: match.score + 18,
          risk: 'medium',
          requiresApproval: true,
          canExecuteNow: false,
          reasons: [
            'Pode reduzir dependencia futura de agente external.',
            'import/adaptation requires source, policy, and test review.',
          ],
          evidence: [`profile=${profile.id}`, `adapter=${profile.adapter}`],
          command: `zavorth capability-mesh --request ${quoteArg(requestText)} --adapt-from-agent ${profile.id}`,
          metadata: {
            externalProfileId: profile.id,
            externalAdapter: profile.adapter,
            liveEnabled: profile.liveExecutionEnabled,
            isolationKind: profile.isolation.kind,
          },
        });
      })
      .filter((candidate) => candidate.rawScore >= 22)
      .sort((a, b) => b.rawScore - a.rawScore)
      .slice(0, 3);
  }

  private rankCandidates(drafts: CandidateDraft[]): ZavorthCapabilityMeshCandidate[] {
    return drafts
      .map((draft) => {
        const score = clampScore(draft.rawScore);
        return {
          ...draft,
          score,
          coverage: coverageFor(score),
        };
      })
      .sort((a, b) => {
        const internalPreference = Number(b.kind === 'internal-skill') - Number(a.kind === 'internal-skill');
        return b.score - a.score || internalPreference || a.label.localeCompare(b.label);
      });
  }

  private selectDecision(candidates: ZavorthCapabilityMeshCandidate[]): ZavorthCapabilityMeshSnapshot['selected'] {
    const best = candidates[0] || null;
    if (!best) {
      return {
        decision: 'ask-for-more-context',
        candidateId: null,
        summary: 'I could not find enough capability. Request a skill, connect an agent, or provide more context.',
        nextCommand: 'zavorth external-agent-onboarding',
      };
    }
    const decision = decisionFor(best);
    return {
      decision,
      candidateId: best.id,
      summary: summaryFor(best, decision),
      nextCommand: best.command,
    };
  }
}

function candidateDraft(input: Omit<CandidateDraft, 'id'>): CandidateDraft {
  return {
    id: `${input.kind}-${stableId(`${input.sourceRef}:${input.label}`)}`,
    ...input,
  };
}

function decisionFor(candidate: ZavorthCapabilityMeshCandidate): ZavorthCapabilityMeshDecision {
  if (candidate.kind === 'internal-skill') return 'use-internal-skill';
  if (candidate.kind === 'skill-composition') return 'compose-internal-skills';
  if (candidate.kind === 'external-agent') return 'delegate-external-agent';
  if (candidate.kind === 'adapt-external-capability') return 'adapt-or-import-external-capability';
  return 'create-skill-draft';
}

function statusFor(
  decision: ZavorthCapabilityMeshDecision,
  candidates: ZavorthCapabilityMeshCandidate[],
): ZavorthCapabilityMeshStatus {
  if (decision === 'ask-for-more-context') return 'needs-capability';
  const selected = candidates[0];
  if (!selected) return 'needs-capability';
  if (selected.risk === 'high' || selected.requiresApproval) return 'approval-required';
  return 'ready';
}

function summaryFor(candidate: ZavorthCapabilityMeshCandidate, decision: ZavorthCapabilityMeshDecision): string {
  if (decision === 'use-internal-skill') {
    return `${candidate.label} is the best option now; it stays Zavorth-native and does not call an external agent.`;
  }
  if (decision === 'compose-internal-skills') {
    return `${candidate.label}; combinar skills internas cobre melhor o request without nova dependencia.`;
  }
  if (decision === 'delegate-external-agent') {
    return `${candidate.label}; using it as a governed external arm requires approval per call.`;
  }
  if (decision === 'adapt-or-import-external-capability') {
    return `${candidate.label}; bom path para transformar capacidade external em skill Zavorth-native revisada.`;
  }
  return `${candidate.label}; create a draft and test before installing.`;
}

function coverageFor(score: number): ZavorthCapabilityMeshCoverage {
  if (score >= 80) return 'exact';
  if (score >= 55) return 'strong';
  if (score >= 28) return 'partial';
  return 'fallback';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampMax(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(25, Math.floor(parsed))
    : DEFAULT_MAX_CANDIDATES;
}

function looksCompositional(value: string): boolean {
  return tokenize(value).length >= 2;
}

function scoreText(tokens: string[], haystack: string): { score: number; overlaps: string[] } {
  const normalized = normalize(haystack);
  const overlaps = tokens.filter((token) => normalized.includes(token));
  const uniqueOverlaps = [...new Set(overlaps)];
  const score = uniqueOverlaps.reduce((sum, token) => sum + Math.min(16, Math.max(4, token.length + 2)), 0);
  return { score, overlaps: uniqueOverlaps.slice(0, 6) };
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 32);
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._:-]+/g, ' ')
    .trim();
}

function quoteArg(value: string): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function cleanText(value: unknown): string {
  return String(value || '').trim().slice(0, 2000);
}

function stableId(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function safeRead<T>(reader: () => T, fallback: T): T {
  try {
    return reader();
  } catch (error: unknown) {logger.warn('[Zavorth Capability Mesh] creation failed', error); return fallback; }
}

function emptyExternalRegistry(generatedAt: string): ZavorthExternalAgentGatewayRegistrySnapshot {
  return {
    generatedAt,
    contractVersion: 'zavorth-external-agent-gateway/1',
    surface: 'external-agent-gateway',
    status: 'empty',
    registryFile: '',
    profiles: [],
    summary: {
      total: 0,
      enabled: 0,
      liveEnabled: 0,
      cli: 0,
      http: 0,
      acp: 0,
      mcp: 0,
      stronglyIsolated: 0,
    },
    safety: {
      noAgentUsedDuringRegistryRead: true,
      noToolExposure: true,
      noCredentialSerialization: true,
      liveUseRequiresApproval: true,
      strongIsolationAvailable: true,
      localCliDeclaredNonSandboxed: true,
    },
  };
}
