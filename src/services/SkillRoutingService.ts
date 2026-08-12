import { logger } from '../logger.js';
import {
  SkillCatalogService,
} from '../skills/SkillCatalogService.js';
import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from './WorkspaceTaskKind.js';
import type { ExecutionModeHint } from './ExecutionIntentClassifierService.js';

export type SkillRoutingDecision = {
  primarySkill: SkillCatalogEntry | null;
  supportingSkills: SkillCatalogEntry[];
  matchedBundleTags: string[];
  rationale: string[];
};

type RecommendSkillsInput = {
  taskGoal: string;
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  modeHint?: ExecutionModeHint;
  maxSupportingSkills?: number;
};

type SkillRoutingRuntime = {
  skillCatalogService?: Pick<SkillCatalogService, 'listEntries'>;
};

type ScoredSkill = {
  entry: SkillCatalogEntry;
  score: number;
  matchedBundleTags: string[];
  reasons: string[];
};

const SECURITY_HINTS = ['security', 'secure', 'threat', 'auth', 'permission', 'risk', 'abuse', 'vulnerab'];
const BROWSER_HINTS = ['browser', 'chrome', 'devtools', 'screenshot', 'console', 'network', 'page', 'site', 'seo', 'accessibility', 'performance', 'lighthouse', 'web'];
const DOCUMENTATION_HINTS = ['spec', 'design', 'doc', 'document', 'rfc', 'proposal', 'arquitetura', 'architecture'];

export class SkillRoutingService {
  private readonly skillCatalogService: Pick<SkillCatalogService, 'listEntries'>;

  constructor(runtime: SkillRoutingRuntime = {}) {
    this.skillCatalogService = runtime.skillCatalogService || new SkillCatalogService();
  }

  public recommend(input: RecommendSkillsInput): SkillRoutingDecision {
    const entries = this.skillCatalogService.listEntries();
    if (entries.length === 0) {
      return {
        primarySkill: null,
        supportingSkills: [],
        matchedBundleTags: [],
        rationale: ['No skill loaded in the current catalog.'],
      };
    }

    const scoredSkills = entries
      .map((entry) => this.scoreSkill(entry, input))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }
        return left.entry.name.localeCompare(right.entry.name, 'en-US');
      });

    const threshold = input.taskKind === 'unknown' ? 5 : 4;
    const routedSkills = scoredSkills.filter((entry) => entry.score >= threshold);
    const primarySkill = routedSkills[0] || null;
    const supportingSkills = routedSkills
      .slice(1, 1 + Math.max(0, input.maxSupportingSkills || 2))
      .map((entry) => entry.entry);

    if (!primarySkill) {
      return {
        primarySkill: null,
        supportingSkills: [],
        matchedBundleTags: [],
        rationale: [`No skill had enough adherence for ${input.taskKind}/${input.taskSubtype}.`],
      };
    }

    // Registrar telemetria assincrona
    this.logTelemetryAsync(primarySkill.entry.name);
    for (const skill of supportingSkills) {
      this.logTelemetryAsync(skill.name);
    }

    return {
      primarySkill: primarySkill.entry,
      supportingSkills,
      matchedBundleTags: Array.from(
        new Set([
          ...primarySkill.matchedBundleTags,
          ...supportingSkills.flatMap((entry) => entry.bundleTags),
        ]),
      ).sort((left, right) => left.localeCompare(right, 'en-US')),
      rationale: [
        `Skill principal sugerida: @${primarySkill.entry.name}.`,
        ...primarySkill.reasons.slice(0, 3),
        ...(supportingSkills.length > 0
          ? [`Skills de apoio: ${supportingSkills.map((entry) => `@${entry.name}`).join(', ')}.`]
          : []),
      ],
    };
  }

  private logTelemetryAsync(skillId: string): void {
    import('../storage/Database.js')
      .then(async ({ Database }) => {
        const db = await Database.getInstance();
        db.run(`
          INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
          VALUES (?, 1, datetime('now'), 'active', 0)
          ON CONFLICT(skill_id) DO UPDATE SET
            use_count = use_count + 1,
            last_executed_at = datetime('now')
        `, [skillId]);
      })
      .catch((error) => {
        logger.warn(`[SkillRoutingService] error ao salvar telemetria para a skill ${skillId}:`, error);
      });
  }

  private scoreSkill(entry: SkillCatalogEntry, input: RecommendSkillsInput): ScoredSkill {
    const normalizedGoal = this.normalize(input.taskGoal);
    const tokens = this.tokenize(normalizedGoal);
    const bundleTags = new Set((entry.bundleTags || []).map((tag) => this.normalize(tag)));
    const searchText = this.normalize(entry.searchText || `${entry.name} ${entry.description}`);
    const reasons: string[] = [];
    const matchedBundleTags = new Set<string>();
    let score = 0;

    if (input.modeHint === 'planner' && bundleTags.has('planning')) {
      score += 2;
      matchedBundleTags.add('planning');
      reasons.push(`A skill ${entry.name} already traz uma cadencia de planejamento reutilizavel.`);
    }

    for (const tag of this.getTaskBundleTags(input.taskKind, input.taskSubtype, normalizedGoal)) {
      if (bundleTags.has(tag)) {
        score += tag === 'security' || tag === 'browser' ? 4 : 3;
        matchedBundleTags.add(tag);
        reasons.push(`O bundle ${tag} combina com ${input.taskKind}/${input.taskSubtype}.`);
      }
    }

    const namedSkillBias = this.resolveNamedSkillBias(entry, input, normalizedGoal);
    if (namedSkillBias.score > 0) {
      score += namedSkillBias.score;
      for (const tag of namedSkillBias.matchedBundleTags) {
        matchedBundleTags.add(tag);
      }
      reasons.push(...namedSkillBias.reasons);
    }

    for (const token of tokens) {
      if (entry.name.toLowerCase().includes(token)) {
        score += 2;
      } else if (searchText.includes(token)) {
        score += 1;
      }
    }

    if (entry.sourceTrust === 'trusted') {
      score += 1;
    } else if (entry.sourceTrust === 'review') {
      score += 0.5;
    }

    return {
      entry,
      score,
      matchedBundleTags: Array.from(matchedBundleTags).sort((left, right) => left.localeCompare(right, 'en-US')),
      reasons: Array.from(new Set(reasons)),
    };
  }

  private getTaskBundleTags(
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
    normalizedGoal: string,
  ): string[] {
    const tags = new Set<string>(['skill']);

    if (taskKind === 'code') {
      tags.add('coding');
      tags.add('planning');
      if (taskSubtype === 'review' || taskSubtype === 'testing' || taskSubtype === 'debugging') {
        tags.add('debugging');
      }
      if (taskSubtype === 'implementation') {
        tags.add('requirements');
      }
    } else if (taskKind === 'research') {
      tags.add('research');
      tags.add('planning');
      if (taskSubtype === 'comparison' || taskSubtype === 'summarization') {
        tags.add('documentation');
        tags.add('requirements');
      }
    } else if (taskKind === 'design') {
      tags.add('architecture');
      tags.add('documentation');
    } else if (taskKind === 'automation') {
      tags.add('planning');
      if (BROWSER_HINTS.some((hint) => normalizedGoal.includes(hint))) {
        tags.add('browser');
      }
    }

    if (SECURITY_HINTS.some((hint) => normalizedGoal.includes(hint))) {
      tags.add('security');
    }
    if (BROWSER_HINTS.some((hint) => normalizedGoal.includes(hint))) {
      tags.add('browser');
    }
    if (DOCUMENTATION_HINTS.some((hint) => normalizedGoal.includes(hint))) {
      tags.add('documentation');
      tags.add('architecture');
      tags.add('requirements');
    }

    return Array.from(tags);
  }

  private resolveNamedSkillBias(
    entry: SkillCatalogEntry,
    input: RecommendSkillsInput,
    normalizedGoal: string,
  ): { score: number; matchedBundleTags: string[]; reasons: string[] } {
    const normalizedName = this.normalize(entry.name);

    if (
      normalizedName === 'codenavi'
      && input.taskKind === 'code'
      && ['review', 'testing', 'debugging', 'implementation', 'general'].includes(input.taskSubtype)
    ) {
      return {
        score: 6,
        matchedBundleTags: ['coding'],
        reasons: ['CodeNavi recebe prioridade extra para navegar, review e alterar codebases existentes com baixo blast radius.'],
      };
    }

    if (
      normalizedName === 'security-threat-model'
      && SECURITY_HINTS.some((hint) => normalizedGoal.includes(hint))
    ) {
      return {
        score: 2,
        matchedBundleTags: ['security'],
        reasons: ['The task mentions risk, auth, or permission; threat modeling enters as specialized support.'],
      };
    }

    if (
      normalizedName === 'chrome-devtools'
      && BROWSER_HINTS.some((hint) => normalizedGoal.includes(hint))
    ) {
      return {
        score: 4,
        matchedBundleTags: ['browser'],
        reasons: ['A task pede browser/network/console; Chrome DevTools vira workflow principal.'],
      };
    }

    if (
      normalizedName === 'technical-design-doc-creator'
      && DOCUMENTATION_HINTS.some((hint) => normalizedGoal.includes(hint))
    ) {
      return {
        score: 3,
        matchedBundleTags: ['documentation', 'requirements'],
        reasons: ['Ha um sinal claro de RFC, design doc ou especificaction tecnica.'],
      };
    }

    if (
      normalizedName === 'tlc-spec-driven'
      && input.taskKind === 'code'
      && ['implementation', 'general'].includes(input.taskSubtype)
    ) {
      return {
        score: 2,
        matchedBundleTags: ['planning', 'requirements'],
        reasons: ['Spec-driven development combina bem com implementation e continuidade de feature.'],
      };
    }

    return {
      score: 0,
      matchedBundleTags: [],
      reasons: [],
    };
  }

  private tokenize(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/[^a-z0-9]+/i)
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry) => entry.length >= 4),
      ),
    );
  }

  private normalize(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
