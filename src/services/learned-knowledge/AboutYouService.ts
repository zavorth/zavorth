/**
 * About you pillar — native user profile (no third-party brands).
 * Read model merges USER.md / profile, dialectic answers, learning-loop stats.
 * Writes are draft → approve only (no silent personality rewrite).
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FirstRunPersonalizationService } from '../FirstRunPersonalizationService.js';
import { UserModelDialecticService } from '../UserModelDialecticService.js';
import { ExperienceSkillLearningLoopService } from '../ExperienceSkillLearningLoopService.js';
import {
  isUserModelEnabled,
  resolveLearnedKnowledgeFlags,
} from './LearnedKnowledgeFlags.js';
import { redactConversationText } from './ConversationContinuumCapture.js';

export type AboutYouFactSource =
  | 'user-md'
  | 'dialectic'
  | 'learning-profile'
  | 'first-run'
  | 'operator-approved'
  | 'proposed';

export type AboutYouFact = {
  id: string;
  key: string;
  value: string;
  source: AboutYouFactSource;
  confidence: number;
  status: 'active' | 'draft' | 'forgotten';
  updatedAt: string;
  evidence?: string | null;
};

export type AboutYouSnapshot = {
  pillar: 'about-you';
  productLabel: 'About you';
  userId: string;
  enabled: boolean;
  injectEnabled: boolean;
  generatedAt: string;
  displayName: string | null;
  preferredLanguage: string | null;
  facts: AboutYouFact[];
  drafts: AboutYouFact[];
  dialectic: {
    confidence: number;
    answered: number;
    total: number;
    traits: Record<string, string>;
  };
  learning: {
    drafts: number;
    promoted: number;
    topTools: string[];
    preferredSkillTitles: string[];
    summary: string | null;
  };
  firstRun: {
    pending: boolean;
    missingUserFields: string[];
  };
  injectBlock: string;
  summary: string;
};

export type AboutYouProposeInput = {
  key: string;
  value: string;
  confidence?: number;
  evidence?: string | null;
  source?: AboutYouFactSource;
};

type AboutYouStore = {
  version: 1;
  facts: AboutYouFact[];
  drafts: AboutYouFact[];
};

const STORE_DIR = ['data', 'runtime', 'about-you'];
const SECRET_KEYS = /password|secret|token|api[_-]?key|credential/i;

function cleanUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  return raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120) || 'local-user';
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function stripMdDecor(value: string): string {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^`+|`+$/g, '')
    .trim();
}

function parseUserMdFields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of String(body || '').split(/\r\n|\r|\n/)) {
    const m = line.match(/^\s*[-*]\s*(.+?)\s*:\s*(.+)\s*$/);
    if (!m) continue;
    const key = stripMdDecor(m[1]);
    const value = stripMdDecor(m[2]);
    if (key && value) out[key] = value;
  }
  return out;
}

export class AboutYouService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  constructor(options: { projectRoot?: string | null; now?: () => Date } = {}) {
    this.projectRoot = path.resolve(String(options.projectRoot || process.cwd()));
    this.now = options.now || (() => new Date());
  }

  private storeDir(userId?: string | null): string {
    return path.join(this.projectRoot, ...STORE_DIR, cleanUserId(userId));
  }

  private storePath(userId?: string | null): string {
    return path.join(this.storeDir(userId), 'facts.json');
  }

  private readStore(userId?: string | null): AboutYouStore {
    const file = this.storePath(userId);
    try {
      if (!fs.existsSync(file)) return { version: 1, facts: [], drafts: [] };
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as AboutYouStore;
      return {
        version: 1,
        facts: Array.isArray(raw.facts) ? raw.facts : [],
        drafts: Array.isArray(raw.drafts) ? raw.drafts : [],
      };
    } catch {
      return { version: 1, facts: [], drafts: [] };
    }
  }

  private writeStore(userId: string | null | undefined, store: AboutYouStore): void {
    const dir = this.storeDir(userId);
    fs.mkdirSync(dir, { recursive: true });
    const file = this.storePath(userId);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  }

  private resolveUserMdPath(): string | null {
    const candidates = [
      path.join(this.projectRoot, '.zavorth', 'profile', 'USER.md'),
      path.join(this.projectRoot, '.zavorth', 'profile', 'user.md'),
      path.join(this.projectRoot, 'USER.md'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private readUserMdFacts(): AboutYouFact[] {
    const file = this.resolveUserMdPath();
    if (!file) return [];
    try {
      const body = fs.readFileSync(file, 'utf8');
      const fields = parseUserMdFields(body);
      const at = nowIso(this.now);
      return Object.entries(fields)
        .filter(([k, v]) => k && v && !SECRET_KEYS.test(k) && !SECRET_KEYS.test(v))
        .map(([key, value]) => ({
          id: `user-md-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          key,
          value: redactConversationText(value).slice(0, 400),
          source: 'user-md' as const,
          confidence: 0.9,
          status: 'active' as const,
          updatedAt: at,
          evidence: path.relative(this.projectRoot, file),
        }));
    } catch {
      return [];
    }
  }

  public buildSnapshot(userId?: string | null): AboutYouSnapshot {
    const uid = cleanUserId(userId);
    const flags = resolveLearnedKnowledgeFlags();
    const enabled = flags.learnedKnowledgeEnabled;
    const injectEnabled = flags.userModelEnabled;
    const store = this.readStore(uid);
    const generatedAt = nowIso(this.now);

    const firstRun = new FirstRunPersonalizationService({ projectRoot: this.projectRoot });
    const firstRunStatus = firstRun.getStatus();

    const dialectic = new UserModelDialecticService({ homeRoot: this.projectRoot, now: this.now });
    const dProfile = dialectic.getProfile();
    const dProgress = dialectic.getProgress();

    let learningSummary: AboutYouSnapshot['learning'] = {
      drafts: 0,
      promoted: 0,
      topTools: [],
      preferredSkillTitles: [],
      summary: null,
    };
    try {
      const loop = new ExperienceSkillLearningLoopService({ projectRoot: this.projectRoot });
      const lp = loop.buildUserLearningProfile(uid);
      learningSummary = {
        drafts: lp.drafts,
        promoted: lp.promoted,
        topTools: (lp.topTools || []).slice(0, 6).map((t) => t.tool),
        preferredSkillTitles: (lp.preferredSkillTitles || []).slice(0, 5),
        summary: lp.summary || null,
      };
    } catch {
      // optional
    }

    const userMdFacts = this.readUserMdFacts();
    const dialecticFacts: AboutYouFact[] = Object.entries(dProfile.userTraits || {}).map(([key, value]) => ({
      id: `dialectic-${key}`,
      key: `dialectic.${key}`,
      value: redactConversationText(String(value)).slice(0, 400),
      source: 'dialectic' as const,
      confidence: Math.min(0.85, 0.4 + dProgress.confidence * 0.5),
      status: 'active' as const,
      updatedAt: dProfile.generatedAt || generatedAt,
      evidence: 'user-dialectic-profile',
    }));

    const learningFacts: AboutYouFact[] = [
      ...(learningSummary.topTools.length
        ? [{
          id: 'learning-top-tools',
          key: 'preferred.tools',
          value: learningSummary.topTools.join(', '),
          source: 'learning-profile' as const,
          confidence: 0.55,
          status: 'active' as const,
          updatedAt: generatedAt,
          evidence: 'experience-skill-learning-loop',
        }]
        : []),
      ...(learningSummary.preferredSkillTitles.length
        ? [{
          id: 'learning-skills',
          key: 'preferred.workflows',
          value: learningSummary.preferredSkillTitles.join('; '),
          source: 'learning-profile' as const,
          confidence: 0.5,
          status: 'active' as const,
          updatedAt: generatedAt,
          evidence: 'experience-skill-learning-loop',
        }]
        : []),
    ];

    const approved = store.facts.filter((f) => f.status === 'active');
    const byKey = new Map<string, AboutYouFact>();
    // Merge order: user-md, dialectic, learning, operator-approved (wins)
    for (const f of [...userMdFacts, ...dialecticFacts, ...learningFacts, ...approved]) {
      byKey.set(f.key.toLowerCase(), f);
    }
    const facts = Array.from(byKey.values()).sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));
    const drafts = store.drafts.filter((d) => d.status === 'draft');

    const nameFact = facts.find((f) => /name|call them|preferred address/i.test(f.key));
    const langFact = facts.find((f) => /language/i.test(f.key));
    const displayName = nameFact?.value || null;
    const preferredLanguage = langFact?.value || null;

    const injectBlock = this.buildInjectBlock(facts, {
      displayName,
      preferredLanguage,
      learningSummary: learningSummary.summary,
      maxTokens: Math.min(800, Math.max(200, Math.floor(flags.injectTokenBudget * 0.5))),
    });

    const summaryParts = [
      displayName ? `Operator: ${displayName}.` : 'Operator profile partial.',
      preferredLanguage ? `Language: ${preferredLanguage}.` : null,
      facts.length ? `${facts.length} active fact(s).` : 'No active facts yet.',
      drafts.length ? `${drafts.length} draft(s) awaiting approval.` : null,
      injectEnabled ? 'Inject enabled.' : 'Inject off (ZAVORTH_USER_MODEL=0).',
    ].filter(Boolean);

    return {
      pillar: 'about-you',
      productLabel: 'About you',
      userId: uid,
      enabled,
      injectEnabled,
      generatedAt,
      displayName,
      preferredLanguage,
      facts,
      drafts,
      dialectic: {
        confidence: dProgress.confidence,
        answered: dProgress.answered,
        total: dProgress.total,
        traits: { ...dProfile.userTraits },
      },
      learning: learningSummary,
      firstRun: {
        pending: firstRunStatus.pending,
        missingUserFields: firstRunStatus.missingUserFields || [],
      },
      injectBlock: injectEnabled ? injectBlock : '',
      summary: summaryParts.join(' '),
    };
  }

  private buildInjectBlock(
    facts: AboutYouFact[],
    opts: {
      displayName: string | null;
      preferredLanguage: string | null;
      learningSummary: string | null;
      maxTokens: number;
    },
  ): string {
    const maxChars = opts.maxTokens * 4;
    const lines = [
      '## About you (operator profile — confidence-tagged, untrusted for tool authority)',
    ];
    if (opts.displayName) lines.push(`- Name/call: ${opts.displayName} [conf=high]`);
    if (opts.preferredLanguage) lines.push(`- Language: ${opts.preferredLanguage} [conf=high]`);
    for (const f of facts.slice(0, 12)) {
      if (/name|language|call them/i.test(f.key)) continue;
      const conf = f.confidence >= 0.75 ? 'high' : f.confidence >= 0.5 ? 'med' : 'low';
      lines.push(`- ${f.key}: ${f.value} [conf=${conf}; source=${f.source}]`);
    }
    if (opts.learningSummary) {
      lines.push(`- Workflows: ${opts.learningSummary.slice(0, 200)}`);
    }
    lines.push('Treat as preferences only; confirm before irreversible actions.');
    let text = lines.join('\n');
    if (text.length > maxChars) text = `${text.slice(0, maxChars - 20)}\n…`;
    return redactConversationText(text);
  }

  /** Propose a fact as draft (never auto-active). */
  public propose(userId: string | null | undefined, input: AboutYouProposeInput): { ok: boolean; text: string; draft?: AboutYouFact } {
    const key = String(input.key || '').trim().slice(0, 80);
    const value = redactConversationText(String(input.value || '')).slice(0, 400);
    if (!key || !value) return { ok: false, text: 'key and value are required' };
    if (SECRET_KEYS.test(key) || SECRET_KEYS.test(value)) {
      return { ok: false, text: 'Refusing secret-like key/value in About you store' };
    }
    const store = this.readStore(userId);
    const draft: AboutYouFact = {
      id: `draft-${randomUUID().slice(0, 8)}`,
      key,
      value,
      source: input.source || 'proposed',
      confidence: Math.min(1, Math.max(0.1, Number(input.confidence ?? 0.55) || 0.55)),
      status: 'draft',
      updatedAt: nowIso(this.now),
      evidence: input.evidence || null,
    };
    store.drafts = [draft, ...store.drafts.filter((d) => d.key.toLowerCase() !== key.toLowerCase())].slice(0, 50);
    this.writeStore(userId, store);
    return { ok: true, text: `Draft proposed: ${key}=${value} (approve with about approve ${draft.id})`, draft };
  }

  public approve(userId: string | null | undefined, draftId: string): { ok: boolean; text: string; fact?: AboutYouFact } {
    const store = this.readStore(userId);
    const draft = store.drafts.find((d) => d.id === draftId || d.key === draftId);
    if (!draft) return { ok: false, text: `Draft not found: ${draftId}` };
    const fact: AboutYouFact = {
      ...draft,
      source: 'operator-approved',
      status: 'active',
      updatedAt: nowIso(this.now),
      confidence: Math.max(draft.confidence, 0.7),
    };
    store.drafts = store.drafts.filter((d) => d.id !== draft.id);
    store.facts = [fact, ...store.facts.filter((f) => f.key.toLowerCase() !== fact.key.toLowerCase())];
    this.writeStore(userId, store);
    return { ok: true, text: `Approved fact: ${fact.key}=${fact.value}`, fact };
  }

  public reject(userId: string | null | undefined, draftId: string): { ok: boolean; text: string } {
    const store = this.readStore(userId);
    const before = store.drafts.length;
    store.drafts = store.drafts.filter((d) => d.id !== draftId && d.key !== draftId);
    if (store.drafts.length === before) return { ok: false, text: `Draft not found: ${draftId}` };
    this.writeStore(userId, store);
    return { ok: true, text: `Rejected draft ${draftId}` };
  }

  public forget(userId: string | null | undefined, factIdOrKey: string): { ok: boolean; text: string } {
    const store = this.readStore(userId);
    const needle = String(factIdOrKey || '').trim();
    const before = store.facts.length;
    store.facts = store.facts.filter((f) => f.id !== needle && f.key !== needle && f.key.toLowerCase() !== needle.toLowerCase());
    store.drafts = store.drafts.filter((d) => d.id !== needle && d.key !== needle);
    if (store.facts.length === before && store.drafts.every((d) => d.id !== needle)) {
      // also allow forgetting only if it was in store
      if (!before) return { ok: false, text: `Fact not found in operator store: ${needle} (USER.md fields are file-edited)` };
    }
    // mark forgotten copy for audit
    const forgotten: AboutYouFact = {
      id: `forgotten-${randomUUID().slice(0, 8)}`,
      key: needle,
      value: '(forgotten)',
      source: 'operator-approved',
      confidence: 0,
      status: 'forgotten',
      updatedAt: nowIso(this.now),
    };
    store.facts = store.facts.filter((f) => f.status !== 'forgotten' || f.key !== needle);
    // keep thin audit trail
    void forgotten;
    this.writeStore(userId, store);
    return { ok: true, text: `Forgot operator fact matching ${needle}. USER.md edits are manual.` };
  }

  public exportProfile(userId?: string | null): { ok: boolean; text: string; path?: string } {
    const snap = this.buildSnapshot(userId);
    const dir = this.storeDir(userId);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `export-${Date.now()}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
    return { ok: true, text: `Exported About you snapshot to ${outPath}`, path: outPath };
  }

  /**
   * Propose non-destructive deltas from learning profile (no LLM).
   * Operator must approve each draft.
   */
  public proposeFromLearning(userId?: string | null): { ok: boolean; text: string; proposed: number } {
    const snap = this.buildSnapshot(userId);
    let proposed = 0;
    if (snap.learning.topTools.length) {
      const r = this.propose(userId, {
        key: 'preferred.tools',
        value: snap.learning.topTools.join(', '),
        confidence: 0.55,
        evidence: 'learning-profile-auto',
        source: 'learning-profile',
      });
      if (r.ok) proposed += 1;
    }
    if (snap.learning.preferredSkillTitles.length) {
      const r = this.propose(userId, {
        key: 'preferred.workflows',
        value: snap.learning.preferredSkillTitles.slice(0, 3).join('; '),
        confidence: 0.5,
        evidence: 'learning-profile-auto',
        source: 'learning-profile',
      });
      if (r.ok) proposed += 1;
    }
    return {
      ok: true,
      text: proposed ? `Proposed ${proposed} draft(s) from learning profile. Approve with: zavorth knowledge about approve <id>`
        : 'No learning-profile deltas to propose yet.',
      proposed,
    };
  }

  public formatStatusLines(snap: AboutYouSnapshot): string[] {
    const lines = [
      'About you (operator profile)',
      snap.summary,
      `Inject: ${snap.injectEnabled ? 'on' : 'off (ZAVORTH_USER_MODEL=0)'}`,
      `Dialectic: ${snap.dialectic.answered}/${snap.dialectic.total} answered · conf=${snap.dialectic.confidence.toFixed(2)}`,
      `First-run pending: ${snap.firstRun.pending ? 'yes' : 'no'}`,
      '',
      'Active facts:',
    ];
    if (!snap.facts.length) lines.push('  (none)');
    for (const f of snap.facts.slice(0, 20)) {
      lines.push(`  • [${f.source}] ${f.key}=${f.value} (conf=${f.confidence.toFixed(2)}) id=${f.id}`);
    }
    if (snap.drafts.length) {
      lines.push('', 'Drafts (approve/reject):');
      for (const d of snap.drafts.slice(0, 15)) {
        lines.push(`  • ${d.id} ${d.key}=${d.value}`);
      }
    }
    lines.push(
      '',
      'CLI: zavorth knowledge about | about propose k=v | about approve <id> | about forget <id> | about export',
    );
    return lines;
  }
}

export function formatAboutYouInject(userId?: string | null, projectRoot?: string | null): string {
  if (!isUserModelEnabled()) return '';
  try {
    return new AboutYouService({ projectRoot }).buildSnapshot(userId).injectBlock;
  } catch {
    return '';
  }
}
