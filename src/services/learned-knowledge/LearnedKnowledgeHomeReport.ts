/**
 * Pretty home report for /knowledge and `zavorth knowledge status`.
 * Deterministic template — no LLM, no keyword routing.
 * English-canonical body (device locale may be used later via tService; EN is fallback).
 */

import {
  buildLearnedKnowledgeHub,
  type LearnedKnowledgeHubSnapshot,
} from './LearnedKnowledgeHub.js';
import { resolveLearnedKnowledgeFlags } from './LearnedKnowledgeFlags.js';

const PILLAR_EMOJI: Record<string, string> = {
  workflows: '⚙️',
  conversation: '💬',
  'about-you': '👤',
  knowledge: '📚',
};

function readyBadge(ready: boolean): string {
  return ready ? 'ready' : 'setup';
}

/**
 * Normalize optional locale input. Reports remain English-canonical;
 * non-empty values are accepted for callers/logging but do not switch
 * to a hardcoded secondary language (e.g. PT-primary bilingual model).
 */
function normalizeReportLocale(locale?: string | null): string {
  const raw = String(locale || '').trim().replace(/_/g, '-');
  if (!raw) return 'en-US';
  return raw;
}

/**
 * Build a chat/CLI-friendly Learned Knowledge home card.
 */
export function formatKnowledgeHomeReport(options: {
  userId?: string | null;
  projectRoot?: string | null;
  /** BCP-47 locale hint; report text is English-canonical with EN fallback. */
  locale?: string | null;
  maxEvents?: number;
  maxChars?: number;
} = {}): string {
  const hub = buildLearnedKnowledgeHub({
    userId: options.userId,
    projectRoot: options.projectRoot,
  });
  return formatKnowledgeHomeReportFromHub(hub, options);
}

export function formatKnowledgeHomeReportFromHub(
  hub: LearnedKnowledgeHubSnapshot,
  options: {
    /** BCP-47 locale hint; report text is English-canonical with EN fallback. */
    locale?: string | null;
    maxEvents?: number;
    maxChars?: number;
  } = {},
): string {
  // Keep normalize for forward-compat / call-site contracts; body stays EN.
  void normalizeReportLocale(options.locale);
  const flags = resolveLearnedKnowledgeFlags();
  const maxEvents = Math.max(0, Math.min(12, Number(options.maxEvents ?? 6) || 6));
  const maxChars = Math.max(800, Math.min(4000, Number(options.maxChars ?? 3500) || 3500));

  const title = 'Learned knowledge';
  const oneLiner = hub.oneLiner;
  const onOff = hub.enabled ? 'on' : 'off';

  const lines: string[] = [
    `📚 ${title}`,
    oneLiner,
    '',
    `Status: ${onOff} · conversation capture: ${flags.continuumCaptureEnabled ? 'on' : 'off'} · about-you inject: ${flags.userModelEnabled ? 'on' : 'off'}`,
    '',
    'Pillars',
  ];

  for (const card of hub.cards) {
    const label = card.label;
    const summary = card.summary;
    const emoji = PILLAR_EMOJI[card.id] || '•';
    lines.push(
      `${emoji} ${label}  ·  ${readyBadge(card.ready)}`,
      `   ${summary}`,
    );
    // Promote affordance for skill drafts (workflows pillar).
    if (card.id === 'workflows') {
      const drafts = Number(card.metrics?.drafts ?? 0) || 0;
      if (drafts > 0) {
        lines.push(`   Promote skill drafts: /learn promote 1  (list: /learn list · drafts=${drafts})`);
      }
    }
  }

  if (hub.storyPreview) {
    lines.push('');
    lines.push('📅 This week');
    lines.push(hub.storyPreview.summary);
    const events = (hub.storyPreview.events || []).slice(0, maxEvents);
    if (events.length) {
      for (const ev of events) {
        const when = String(ev.at || '').slice(0, 10);
        const emoji = PILLAR_EMOJI[ev.pillar] || '•';
        lines.push(`   ${emoji} ${when}  ${ev.title}`);
        if (ev.snippet) {
          lines.push(`      ${String(ev.snippet).slice(0, 120)}`);
        }
      }
    } else {
      lines.push('   (no events in this window yet)');
    }
  }

  if (hub.advanced) {
    const fi = hub.advanced.fileIndex;
    const dc = hub.advanced.dreamCycle;
    lines.push('');
    lines.push('🔧 Advanced');
    lines.push(
      `   Vault: ${fi.available ? 'yes' : 'no'}${typeof fi.fileCount === 'number' ? ` · ${fi.fileCount} file(s)` : ''}`,
    );
    if (fi.vaultPath) lines.push(`   ${fi.vaultPath}`);
    lines.push(
      dc.lastRunAt ? `   Dream (preview): last ${String(dc.lastRunAt).slice(0, 16)} · candidates=${dc.lastCandidateCount ?? 0}`
        : '   Dream (preview): not run yet',
    );
  }

  lines.push('');
  lines.push('Shortcuts');
  lines.push('/knowledge story · /knowledge advanced · /knowledge pack <q>');
  lines.push('/knowledge recall <q> · /knowledge about · /knowledge help');
  lines.push('/learn list · /learn promote 1');

  let body = lines.join('\n').trim();
  if (body.length > maxChars) {
    body = `${body.slice(0, maxChars - 1)}…`;
  }
  return body;
}
