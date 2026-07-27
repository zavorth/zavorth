/**
 * Aggregated hub snapshot for Control / Desktop / CLI status .
 * English-canonical labels/summaries — UI translates via locale catalogs (EN fallback).
 */

import path from 'node:path';
import { ExperienceSkillLearningLoopService } from '../ExperienceSkillLearningLoopService.js';
import { AboutYouService } from './AboutYouService.js';
import {
 getConversationContinuum,
 continuumBackendLabel,
} from './ConversationContinuumCapture.js';
import { knowledgeWikiPresent } from './KnowledgeFactsRecall.js';
import {
 isContinuumCaptureEnabled,
 isLearnedKnowledgeEnabled,
 isUserModelEnabled,
 resolveLearnedKnowledgeFlags,
} from './LearnedKnowledgeFlags.js';
import { emitKnowledgeTelemetry } from './LearnedKnowledgeSafety.js';
import {
 buildLearnedKnowledgeAdvanced,
 type LearnedKnowledgeAdvancedStatus,
} from './LearnedKnowledgeAdvanced.js';
import {
 buildLearnedKnowledgeStory,
 type LearnedKnowledgeStoryEvent,
} from './LearnedKnowledgeStoryService.js';
import { toPublicPath } from './LearnedKnowledgePathSafety.js';

export type LearnedKnowledgeHubCard = {
 id: 'workflows' | 'conversation' | 'about-you' | 'knowledge';
 /** English-canonical label; UI may pass through translate(). */
 label: string;
 ready: boolean;
 /** English-canonical summary. */
 summary: string;
 cli: string;
 slash: string;
 deepLink: string;
 metrics?: Record<string, string | number | boolean | null>;
};

/** + story preview — includes full event list for Control/Desktop (story timeline). */
export type LearnedKnowledgeStoryPreview = {
 eventCount: number;
 /** English-canonical summary. */
 summary: string;
 cli: string;
 slash?: string;
 days?: number;
 /** Newest-first events for hub UI (capped). */
 events?: LearnedKnowledgeStoryEvent[];
 limit?: number;
};

export type LearnedKnowledgeHubSnapshot = {
 ok: true;
 plane: 'learned-knowledge';
 enabled: boolean;
 generatedAt: string;
 userId: string;
 cards: LearnedKnowledgeHubCard[];
 /** English-canonical one-liner; UI translates known keys. */
 oneLiner: string;
 docs: string;
 /** return of buildLearnedKnowledgeAdvanced (defensive). */
 advanced?: LearnedKnowledgeAdvancedStatus;
 /** short story timeline preview (defensive). */
 storyPreview?: LearnedKnowledgeStoryPreview;
};

export function buildLearnedKnowledgeHub(options: {
 userId?: string | null;
 projectRoot?: string | null;
} = {}): LearnedKnowledgeHubSnapshot {
 const projectRoot = path.resolve(String(options.projectRoot || process.cwd()));
 const userId = String(options.userId || 'control').trim() || 'control';
 // Resolve flags so inject budget / capture toggles are consistent with env.
 resolveLearnedKnowledgeFlags();
 const enabled = isLearnedKnowledgeEnabled();

 let workflowsSummary = 'Workflow drafts unavailable.';
 let workflowsReady = false;
 let workflowsMetrics: LearnedKnowledgeHubCard['metrics'] = {};
 try {
 const loop = new ExperienceSkillLearningLoopService({ projectRoot });
 const snap = loop.buildStatusSnapshot(userId);
 workflowsReady = true;
 workflowsSummary = `${snap.badge} · drafts=${snap.drafts} · promoted=${snap.promoted}`;
 workflowsMetrics = {
 drafts: snap.drafts,
 promoted: snap.promoted,
 weekKey: snap.metrics?.weekKey || null,
 weekCreated: snap.metrics?.draftsCreated ?? 0,
 };
 } catch {
 // optional
 }

 let conversationSummary = 'Conversation continuum unavailable.';
 let conversationReady = false;
 let conversationMetrics: LearnedKnowledgeHubCard['metrics'] = {};
 try {
 const continuum = getConversationContinuum({ projectRoot });
 const backend = continuumBackendLabel({ projectRoot });
 const capture = isContinuumCaptureEnabled();
 conversationReady = true;
 conversationSummary = `Capture ${capture ? 'on' : 'off'} · backend=${backend}`;
 conversationMetrics = {
 capture,
 backend,
 // Public-safe relative path only (no absolute host leak).
 storePath: toPublicPath(continuum.getStorePath(), projectRoot),
 };
 } catch {
 // optional
 }

 let aboutSummary = 'About you unavailable.';
 let aboutReady = false;
 let aboutMetrics: LearnedKnowledgeHubCard['metrics'] = {};
 try {
 const about = new AboutYouService({ projectRoot }).buildSnapshot(userId);
 aboutReady = true;
 aboutSummary = `facts=${about.facts.length} · drafts=${about.drafts.length} · inject=${isUserModelEnabled() ? 'on' : 'off'}`;
 aboutMetrics = {
 facts: about.facts.length,
 drafts: about.drafts.length,
 inject: isUserModelEnabled(),
 // Display name is operator-scoped; keep only non-empty short form.
 displayName: about.displayName ? String(about.displayName).slice(0, 80) : null,
 };
 } catch {
 // optional
 }

 const wiki = knowledgeWikiPresent(projectRoot);
 const knowledgeSummary = wiki ? 'Wiki present · knowledge_recall ready · no silent promote'
 : 'Wiki missing (.zavorth/wiki) · run mnemos ingest';

 const cards: LearnedKnowledgeHubCard[] = [
 {
 id: 'workflows',
 label: 'Workflows',
 ready: workflowsReady,
 summary: workflowsSummary,
 cli: 'zavorth learn · zavorth knowledge workflows',
 slash: '/learn list · /knowledge workflows',
 deepLink: 'workflows',
 metrics: workflowsMetrics,
 },
 {
 id: 'conversation',
 label: 'Conversation recall',
 ready: conversationReady,
 summary: conversationSummary,
 cli: 'zavorth knowledge recall <query>',
 slash: '/knowledge recall <query>',
 deepLink: 'conversation',
 metrics: conversationMetrics,
 },
 {
 id: 'about-you',
 label: 'About you',
 ready: aboutReady,
 summary: aboutSummary,
 cli: 'zavorth knowledge about',
 slash: '/knowledge about',
 deepLink: 'about-you',
 metrics: aboutMetrics,
 },
 {
 id: 'knowledge',
 label: 'Knowledge',
 ready: wiki,
 summary: knowledgeSummary,
 cli: 'zavorth knowledge facts <query>',
 slash: '/knowledge facts <query>',
 deepLink: 'knowledge',
 metrics: { wikiPresent: wiki },
 },
 ];

 let advanced: LearnedKnowledgeAdvancedStatus | undefined;
 try {
 advanced = buildLearnedKnowledgeAdvanced({ projectRoot });
 } catch {
 advanced = undefined;
 }

 let storyPreview: LearnedKnowledgeStoryPreview | undefined;
 try {
 const storyLimit = 12;
 const story = buildLearnedKnowledgeStory({
 userId,
 projectRoot,
 windowDays: 7,
 limit: storyLimit,
 });
 storyPreview = {
 eventCount: story.events.length,
 summary: story.summary,
 cli: 'zavorth knowledge story',
 slash: '/knowledge story',
 days: story.windowDays,
 events: story.events,
 limit: storyLimit,
 };
 } catch {
 storyPreview = undefined;
 }

 const snapshot: LearnedKnowledgeHubSnapshot = {
 ok: true as const,
 plane: 'learned-knowledge' as const,
 enabled,
 generatedAt: new Date().toISOString(),
 userId,
 cards,
 oneLiner: 'Zavorth remembers workflows, conversations, who you are, and project knowledge — each in the right store.',
 docs: 'docs/product/learned-knowledge-plane.md',
 ...(advanced ? { advanced } : {}),
 ...(storyPreview ? { storyPreview } : {}),
 };
 emitKnowledgeTelemetry('knowledge.hub', {
 pillar: 'hub',
 hitCount: cards.filter((c) => c.ready).length,
 ok: true,
 surface: 'hub',
 });
 return snapshot;
}
