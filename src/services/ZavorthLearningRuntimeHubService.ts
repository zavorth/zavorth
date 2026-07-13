import {
  resolveLearningRuntimePolicy,
  setLearningRuntimeMode,
  type LearningRuntimeMode,
  type LearningRuntimePolicySnapshot,
} from './ZavorthLearningRuntimePolicy.js';
import {
  ZavorthAutonomousLearningWriteService,
  type AutonomousLearningWriteResult,
} from './ZavorthAutonomousLearningWriteService.js';
import type {
  ZavorthExperienceLearningDaemonSnapshot,
  ZavorthSkillForgeRuntimeSnapshot,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import { wrapUntrustedContent } from '../security/UntrustedContent.js';

export type LearnedRuntimeItem = {
  id: string;
  kind: 'preference' | 'skill-draft';
  title: string;
  summary: string;
  reversible: true;
  createdAt: string;
  sourceSurface?: string;
};

export type LearningRuntimeHubSnapshot = {
  contractVersion: 'zavorth-learning-runtime-hub/1';
  generatedAt: string;
  policy: LearningRuntimePolicySnapshot;
  items: LearnedRuntimeItem[];
  promptBlock: string;
  noticeLines: string[];
};

type HubDeps = {
  projectRoot?: string | null;
  userId?: string | null;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  writer?: ZavorthAutonomousLearningWriteService;
};

export class ZavorthLearningRuntimeHubService {
  private readonly projectRoot: string;
  private readonly userId: string | null;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly writer: ZavorthAutonomousLearningWriteService;

  public constructor(deps: HubDeps = {}) {
    this.projectRoot = String(deps.projectRoot || process.cwd());
    this.userId = deps.userId == null ? null : String(deps.userId);
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.writer = deps.writer || new ZavorthAutonomousLearningWriteService({
      projectRoot: this.projectRoot,
      userId: this.userId,
      now: this.now,
      policy: resolveLearningRuntimePolicy({
        projectRoot: this.projectRoot,
        env: this.env,
        userId: this.userId,
      }),
    });
  }

  public resolvePolicy(): LearningRuntimePolicySnapshot {
    return resolveLearningRuntimePolicy({
      projectRoot: this.projectRoot,
      env: this.env,
      userId: this.userId,
    });
  }

  public setMode(mode: LearningRuntimeMode): LearningRuntimePolicySnapshot {
    return setLearningRuntimeMode(mode, {
      projectRoot: this.projectRoot,
      now: this.now,
      userId: this.userId,
    });
  }

  public listLearned(): LearnedRuntimeItem[] {
    const prefs = this.writer.listTrustedPreferences().map((entry) => ({
      id: entry.id,
      kind: 'preference' as const,
      title: 'Preferencia aprendida',
      summary: entry.summary,
      reversible: true as const,
      createdAt: entry.createdAt,
      sourceSurface: entry.sourceSurface,
    }));
    const drafts = this.writer.listSkillDrafts().map((entry) => ({
      id: entry.id,
      kind: 'skill-draft' as const,
      title: entry.title,
      summary: 'Rotina em rascunho (ainda nao instalada como skill final).',
      reversible: true as const,
      createdAt: entry.createdAt,
    }));
    return [...prefs, ...drafts].slice(0, 80);
  }

  public buildSnapshot(input: { query?: string | null; limit?: number } = {}): LearningRuntimeHubSnapshot {
    const policy = this.resolvePolicy();
    const items = this.filterItems(this.listLearned(), input.query, input.limit ?? 12);
    return {
      contractVersion: 'zavorth-learning-runtime-hub/1',
      generatedAt: this.now().toISOString(),
      policy,
      items,
      promptBlock: this.formatContextBlock(items, policy),
      noticeLines: this.formatNoticeLines(items, policy),
    };
  }

  public formatContextBlock(
    items?: LearnedRuntimeItem[],
    policy?: LearningRuntimePolicySnapshot,
  ): string {
    const resolvedPolicy = policy || this.resolvePolicy();
    const list = items || this.listLearned().slice(0, 12);
    if (!list.length) return '';
    const body = [
      `learningMode: ${resolvedPolicy.mode}`,
      'Apply only when they do not conflict with safety, approvals, or explicit user instructions.',
      'Do not invent permanent policy changes from this block.',
      ...list.map((item) => `[${item.kind}] ${sanitizeLearnedSummary(item.summary)}`),
    ].join('\n');
    return wrapUntrustedContent('learned_preferences', body, { maxChars: 2_400 });
  }

  public formatNoticeLines(
    items?: LearnedRuntimeItem[],
    policy?: LearningRuntimePolicySnapshot,
  ): string[] {
    const resolvedPolicy = policy || this.resolvePolicy();
    const list = items || this.listLearned();
    if (resolvedPolicy.mode !== 'autonomous' && list.length === 0) {
      return ['Aprendizado em modo revisado: nao gravo preferencias sozinho.'];
    }
    if (!list.length) {
      return ['Ainda nao gravei preferencias. Continue conversando normalmente.'];
    }
    return [
      `Lembro ${list.length} item(ns) aprendido(s) (reversivel).`,
      ...list.slice(0, 8).map((item) => `• ${item.summary}`),
      'To undo, say: undo learning <snippet> (or Portuguese: desfazer aprendizado <snippet>) or use the Forget card.',
    ];
  }

  public undo(idOrText: string): { ok: boolean; summary: string; removedId: string | null } {
    const target = String(idOrText || '').trim();
    if (!target) {
      return {
        ok: false,
        summary: 'Provide the exact item id (see "what did you learn?" / "o que voce aprendeu?").',
        removedId: null,
      };
    }

    const byId = this.writer.removePreference(target);
    if (byId.ok) return byId;
    const draft = this.writer.removeSkillDraft(target);
    if (draft.ok) return draft;

    const needle = target.toLowerCase();
    const exact = this.listLearned().find((item) => item.id.toLowerCase() === needle);
    if (exact) {
      if (exact.kind === 'preference') return this.writer.removePreference(exact.id);
      return this.writer.removeSkillDraft(exact.id);
    }

    const uniqueSummaryMatches = this.listLearned().filter((item) => (
      item.summary.toLowerCase() === needle || item.title.toLowerCase() === needle
    ));
    if (uniqueSummaryMatches.length === 1) {
      const match = uniqueSummaryMatches[0];
      if (match.kind === 'preference') return this.writer.removePreference(match.id);
      return this.writer.removeSkillDraft(match.id);
    }
    if (uniqueSummaryMatches.length > 1) {
      return {
        ok: false,
        summary: 'Varios itens batem com esse texto. Use o id exato.',
        removedId: null,
      };
    }

    // Unique substring match on summary/title/id (fail closed if ambiguous).
    const substringMatches = this.listLearned().filter((item) => (
      item.summary.toLowerCase().includes(needle)
      || item.title.toLowerCase().includes(needle)
      || item.id.toLowerCase().includes(needle)
    ));
    if (substringMatches.length === 1) {
      const match = substringMatches[0];
      if (match.kind === 'preference') return this.writer.removePreference(match.id);
      return this.writer.removeSkillDraft(match.id);
    }
    if (substringMatches.length > 1) {
      return {
        ok: false,
        summary: 'Varios itens batem com esse trecho. Use o id exato.',
        removedId: null,
      };
    }

    return { ok: false, summary: `Nada encontrado para desfazer: ${target}`, removedId: null };
  }

  public applyFromSpine(input: {
    learning: ZavorthExperienceLearningDaemonSnapshot;
    skillForge?: ZavorthSkillForgeRuntimeSnapshot | null;
    sourceSurface?: string | null;
    userId?: string | null;
  }): AutonomousLearningWriteResult {
    const scopedUserId = input.userId != null ? input.userId : this.userId;
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: this.projectRoot,
      userId: scopedUserId,
      now: this.now,
      policy: resolveLearningRuntimePolicy({
        projectRoot: this.projectRoot,
        env: this.env,
        userId: scopedUserId,
      }),
    });
    return writer.applyFromSpine(input);
  }

  /**
   * Free-text NLU packs removed (Hermes-style: free text → agent).
   * Use slash (/learn digest, /undo …) or agent tools.
   */
  public matchNaturalCommand(_text: string): null | { kind: 'digest' | 'undo'; query?: string } {
    return null;
  }

  private filterItems(items: LearnedRuntimeItem[], query?: string | null, limit = 12): LearnedRuntimeItem[] {
    const q = String(query || '').trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter((item) => item.summary.toLowerCase().includes(q) || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
    return filtered.slice(0, Math.max(1, limit));
  }
}

function sanitizeLearnedSummary(value: string): string {
  try {
    const { redactSensitiveText } = require('./ZavorthNativeAutonomyShared.js') as typeof import('./ZavorthNativeAutonomyShared.js');
    return redactSensitiveText(value).slice(0, 240);
  } catch {
    return String(value || '').slice(0, 240);
  }
}
