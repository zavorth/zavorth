/**
 * Cross-pillar "what was learned this week" timeline .
 * Collects lightweight events from existing engines — no new stores, no silent promote.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ExperienceSkillLearningLoopService } from '../ExperienceSkillLearningLoopService.js';
import { AboutYouService } from './AboutYouService.js';
import {
 getConversationContinuum,
 redactConversationText,
} from './ConversationContinuumCapture.js';
import { knowledgeWikiPresent } from './KnowledgeFactsRecall.js';
import { toPublicPath } from './LearnedKnowledgePathSafety.js';

export type LearnedKnowledgeStoryEvent = {
 id: string;
 pillar: 'workflows' | 'conversation' | 'about-you' | 'knowledge';
 at: string;
 title: string;
 snippet: string;
 sourceId?: string;
 trust?: number;
};

export type LearnedKnowledgeStorySnapshot = {
 ok: true;
 generatedAt: string;
 userId: string;
 windowDays: number;
 events: LearnedKnowledgeStoryEvent[];
 summary: string;
};

function safeIso(value: unknown, fallback: string): string {
 const raw = String(value || '').trim();
 if (!raw) return fallback;
 const ms = Date.parse(raw);
 if (!Number.isFinite(ms)) return fallback;
 return new Date(ms).toISOString();
}

function withinWindow(atIso: string, cutoffMs: number): boolean {
 const ms = Date.parse(atIso);
 if (!Number.isFinite(ms)) return false;
 return ms >= cutoffMs;
}

function clip(text: string, max = 180): string {
 const clean = redactConversationText(String(text || '').replace(/\s+/g, ' ').trim());
 if (clean.length <= max) return clean;
 return `${clean.slice(0, max - 1)}…`;
}

function collectWorkflowEvents(
 projectRoot: string,
 userId: string,
 cutoffMs: number,
 nowIso: string,
): LearnedKnowledgeStoryEvent[] {
 const out: LearnedKnowledgeStoryEvent[] = [];
 try {
 const loop = new ExperienceSkillLearningLoopService({ projectRoot });
 const drafts = loop.listDrafts(userId, 40, { sortBy: 'updatedAt' });
 for (const d of drafts) {
 const at = safeIso(d.updatedAt || d.lastUsedAt || d.createdAt, nowIso);
 if (!withinWindow(at, cutoffMs)) continue;
 const tools = (d.tools || []).slice(0, 4).join(', ');
 out.push({
 id: `workflows:draft:${d.id}`,
 pillar: 'workflows',
 at,
 title: clip(d.title || d.id, 80) || 'Workflow draft',
 snippet: clip(
 Number(d.revisions || 0) > 0
 ? `Draft updated · tools: ${tools || 'n/a'} · uses=${d.useCount || 0}`
 : `Draft created · tools: ${tools || 'n/a'}`,
 ),
 sourceId: d.id,
 trust: Math.min(1, Math.max(0.2, Number(d.successRate ?? 0.5))),
 });
 }
 const promoted = loop.listPromoted(userId, 40);
 for (const p of promoted) {
 const at = safeIso(p.promotedAt, nowIso);
 if (!withinWindow(at, cutoffMs)) continue;
 out.push({
 id: `workflows:promoted:${p.id}`,
 pillar: 'workflows',
 at,
 title: clip(p.title || p.id, 80) || 'Promoted workflow',
 snippet: clip(`Skill promoted from draft ${p.id}`),
 sourceId: p.id,
 trust: 0.85,
 });
 }
 } catch {
 // optional pillar
 }
 return out;
}

function collectConversationEvents(
 projectRoot: string,
 cutoffMs: number,
 nowIso: string,
 limit: number,
): LearnedKnowledgeStoryEvent[] {
 const out: LearnedKnowledgeStoryEvent[] = [];
 try {
 const continuum = getConversationContinuum({ projectRoot });
 // Skip browse when store is absent to avoid noisy JSON-parse ENOENT logs.
 const storePath = continuum.getStorePath?.() || '';
 if (storePath && !fs.existsSync(storePath)) {
 return out;
 }
 const snap = continuum.browse({ limit: Math.min(40, Math.max(4, limit)) });
 for (const hit of snap.hits || []) {
 const at = safeIso(hit.createdAt, nowIso);
 if (!withinWindow(at, cutoffMs)) continue;
 const sourceId = hit.messageId || hit.sessionId || undefined;
 out.push({
 id: `conversation:${sourceId || at}`,
 pillar: 'conversation',
 at,
 title: clip(hit.title || 'Conversation turn', 80),
 snippet: clip(hit.snippet || hit.title || ''),
 sourceId,
 trust: 0.6,
 });
 }
 } catch {
 // optional pillar
 }
 return out;
}

function collectAboutYouEvents(
 projectRoot: string,
 userId: string,
 cutoffMs: number,
 nowIso: string,
): LearnedKnowledgeStoryEvent[] {
 const out: LearnedKnowledgeStoryEvent[] = [];
 try {
 const about = new AboutYouService({ projectRoot }).buildSnapshot(userId);
 for (const fact of [...about.facts, ...about.drafts]) {
 const at = safeIso(fact.updatedAt, nowIso);
 if (!withinWindow(at, cutoffMs)) continue;
 const statusLabel = fact.status === 'draft' ? 'draft fact' : 'profile fact';
 out.push({
 id: `about-you:${fact.status}:${fact.id}`,
 pillar: 'about-you',
 at,
 title: clip(`${statusLabel}: ${fact.key}`, 80),
 snippet: clip(fact.value),
 sourceId: fact.id,
 trust: Math.min(1, Math.max(0.2, Number(fact.confidence || 0.5))),
 });
 }
 } catch {
 // optional pillar
 }
 return out;
}

function collectKnowledgeEvents(
 projectRoot: string,
 cutoffMs: number,
 nowIso: string,
): LearnedKnowledgeStoryEvent[] {
 const out: LearnedKnowledgeStoryEvent[] = [];
 try {
 const wikiIndex = path.join(path.resolve(projectRoot), '.zavorth', 'wiki', 'index.json');
 if (!knowledgeWikiPresent(projectRoot) || !fs.existsSync(wikiIndex)) {
 return out;
 }
 let at = nowIso;
 try {
 const st = fs.statSync(wikiIndex);
 at = new Date(st.mtimeMs).toISOString();
 } catch {
 // keep nowIso
 }
 const root = path.resolve(projectRoot);
 if (withinWindow(at, cutoffMs)) {
 out.push({
 id: 'knowledge:wiki-index',
 pillar: 'knowledge',
 at,
 title: 'Project knowledge wiki ready',
 snippet: clip('Wiki index present (.zavorth/wiki) · knowledge_recall ready · no silent promote'),
 sourceId: toPublicPath(wikiIndex, root) || '.zavorth/wiki/index.json',
 trust: 0.7,
 });
 }

 try {
 const raw = JSON.parse(fs.readFileSync(wikiIndex, 'utf8')) as {
 pages?: Array<{ id?: string; title?: string; path?: string; updatedAt?: string; mtime?: string }>;
 };
 const pages = Array.isArray(raw.pages) ? raw.pages.slice(0, 12) : [];
 for (const page of pages) {
 const pageAt = safeIso(page.updatedAt || page.mtime, at);
 if (!withinWindow(pageAt, cutoffMs)) continue;
 const pageId = String(page.id || page.path || page.title || '').trim().slice(0, 120);
 if (!pageId) continue;
 out.push({
 id: `knowledge:page:${pageId}`,
 pillar: 'knowledge',
 at: pageAt,
 title: clip(page.title || pageId, 80) || 'Wiki page',
 snippet: clip(page.path || pageId || 'Wiki page touch'),
 sourceId: pageId,
 trust: 0.65,
 });
 }
 } catch {
 // index shape optional
 }
 } catch {
 // optional
 }
 return out;
}

function buildSummary(events: LearnedKnowledgeStoryEvent[], windowDays: number): string {
 if (!events.length) {
 return `No learned-knowledge activity in the last ${windowDays} day(s).`;
 }
 const counts: Record<string, number> = {};
 for (const e of events) {
 counts[e.pillar] = (counts[e.pillar] || 0) + 1;
 }
 const parts = Object.entries(counts)
 .sort((a, b) => b[1] - a[1])
 .map(([pillar, n]) => `${pillar}=${n}`);
 return `Learned this week (${windowDays}d): ${events.length} event(s) · ${parts.join(' · ')}.`;
}

/**
 * Build a cross-pillar timeline of recent learned-knowledge activity.
 */
export function buildLearnedKnowledgeStory(options: {
 userId?: string | null;
 projectRoot?: string | null;
 windowDays?: number;
 limit?: number;
} = {}): LearnedKnowledgeStorySnapshot {
 const projectRoot = path.resolve(String(options.projectRoot || process.cwd()));
 const userId = String(options.userId || 'local-user').trim() || 'local-user';
 const windowDays = Math.max(1, Math.min(90, Number(options.windowDays || 7) || 7));
 const limit = Math.max(1, Math.min(100, Number(options.limit || 24) || 24));
 const generatedAt = new Date().toISOString();
 const cutoffMs = Date.parse(generatedAt) - windowDays * 24 * 60 * 60 * 1000;

 const events: LearnedKnowledgeStoryEvent[] = [
 ...collectWorkflowEvents(projectRoot, userId, cutoffMs, generatedAt),
 ...collectConversationEvents(projectRoot, cutoffMs, generatedAt, limit),
 ...collectAboutYouEvents(projectRoot, userId, cutoffMs, generatedAt),
 ...collectKnowledgeEvents(projectRoot, cutoffMs, generatedAt),
 ];

 events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
 const capped = events.slice(0, limit);

 return {
 ok: true,
 generatedAt,
 userId,
 windowDays,
 events: capped,
 summary: buildSummary(capped, windowDays),
 };
}
