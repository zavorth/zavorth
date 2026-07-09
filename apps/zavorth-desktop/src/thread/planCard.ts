/**
 * Structured plan cards for in-thread plan → approve flow.
 * Pure helpers — safe for unit tests.
 */

export type PlanStep = {
  id: string;
  title: string;
  detail?: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
};

export type PlanCardModel = {
  id: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  risk: 'low' | 'medium' | 'high' | 'critical' | null;
  canApprove: boolean;
  canReject: boolean;
};

const RISK_VALUES = new Set(['low', 'medium', 'high', 'critical']);

const PLAN_HEADING_RE =
  /^(#{1,6})\s*(?:proposed\s+)?plan(?:\s*[:\-–—]\s*(.+))?$/i;
const PLAN_LINE_RE = /^plan\s*:\s*(.*)$/i;
const NUMBERED_STEP_RE = /^\s*(?:\d+[\.\)]\s+|[-*+]\s+)(.+)$/;
const RISK_INLINE_RE = /\brisk\s*:\s*(low|medium|high|critical)\b/i;

function normalizeRisk(value: string | null | undefined): PlanCardModel['risk'] {
  if (value == null || value === '') return null;
  const lower = String(value).trim().toLowerCase();
  return RISK_VALUES.has(lower) ? (lower as PlanCardModel['risk']) : null;
}

function makeStepId(index: number): string {
  return `step-${index + 1}`;
}

function parseStepTitle(raw: string): { title: string; detail?: string } {
  const text = raw.trim();
  // "Title — detail" or "Title: detail"
  const split = text.match(/^(.+?)\s*[—–\-:]\s+(.+)$/);
  if (split && split[1].trim().length > 0 && split[2].trim().length > 0) {
    const title = split[1].trim();
    const detail = split[2].trim();
    // Avoid treating bare URLs / short fragments oddly; keep simple
    if (title.length <= 120) {
      return { title, detail };
    }
  }
  return { title: text };
}

function collectStepsFromLines(lines: string[], startIndex: number): {
  steps: PlanStep[];
  endIndex: number;
  summaryBits: string[];
} {
  const steps: PlanStep[] = [];
  const summaryBits: string[] = [];
  let i = startIndex;
  let sawList = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at next markdown heading of same/higher level structure, or blank block after steps
    if (/^#{1,6}\s+/.test(trimmed) && steps.length > 0) break;
    if (PLAN_LINE_RE.test(trimmed) && steps.length > 0) break;

    const stepMatch = trimmed.match(NUMBERED_STEP_RE);
    if (stepMatch) {
      sawList = true;
      const { title, detail } = parseStepTitle(stepMatch[1]);
      if (title) {
        steps.push({
          id: makeStepId(steps.length),
          title,
          ...(detail ? { detail } : {}),
          status: 'pending',
        });
      }
      i += 1;
      continue;
    }

    // Non-list lines after plan header: treat as summary until first list item
    if (!sawList && trimmed.length > 0) {
      // Skip risk-only lines (handled separately)
      if (!RISK_INLINE_RE.test(trimmed) || trimmed.replace(RISK_INLINE_RE, '').trim().length > 0) {
        const cleaned = trimmed.replace(RISK_INLINE_RE, '').trim();
        if (cleaned) summaryBits.push(cleaned);
      }
      i += 1;
      continue;
    }

    // Empty line inside list: allow one, then stop if no more list items soon
    if (trimmed.length === 0 && sawList) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim().length === 0) j += 1;
      if (j < lines.length && NUMBERED_STEP_RE.test(lines[j].trim())) {
        i = j;
        continue;
      }
      break;
    }

    if (sawList && trimmed.length > 0) {
      // Continuation of previous step detail, or end of plan block
      break;
    }

    i += 1;
  }

  return { steps, endIndex: i, summaryBits };
}

/**
 * Detect plans that look like:
 * - markdown "## Plan" / "### Proposed plan" sections with numbered or - steps
 * - or lines starting with "Plan:"
 * Return null if no plan structure found.
 * canApprove true if steps.length > 0
 */
export function parsePlanFromText(text: string, id?: string): PlanCardModel | null {
  if (typeof text !== 'string' || !text.trim()) return null;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let planStart = -1;
  let title = 'Plan';
  let headingSummary = '';

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const heading = trimmed.match(PLAN_HEADING_RE);
    if (heading) {
      planStart = i;
      title = heading[2]?.trim() || 'Plan';
      // Prefer full heading text without hashes as title when no subtitle
      if (!heading[2]) {
        const bare = trimmed.replace(/^#{1,6}\s+/, '').trim();
        title = bare || 'Plan';
      }
      break;
    }
    const planLine = trimmed.match(PLAN_LINE_RE);
    if (planLine) {
      planStart = i;
      headingSummary = planLine[1]?.trim() || '';
      if (headingSummary && !NUMBERED_STEP_RE.test(headingSummary)) {
        // "Plan: do the thing" — short inline summary, steps may follow
        title = 'Plan';
      } else if (headingSummary && NUMBERED_STEP_RE.test(headingSummary)) {
        // unlikely on same line; keep as title bit
        headingSummary = '';
      }
      break;
    }
  }

  if (planStart < 0) return null;

  // Risk anywhere near the plan section
  let risk: PlanCardModel['risk'] = null;
  const sectionText = lines.slice(planStart, Math.min(lines.length, planStart + 80)).join('\n');
  const riskMatch = sectionText.match(RISK_INLINE_RE);
  if (riskMatch) risk = normalizeRisk(riskMatch[1]);

  // Steps / summary body start on the line after the plan header
  const collectFrom = planStart + 1;
  const { steps, summaryBits } = collectStepsFromLines(lines, collectFrom);

  // Also accept steps that appear as the only content after Plan: on following lines
  // If Plan: line itself contains a dash-list like "Plan: - a - b" — skip (too ambiguous)

  const summaryParts = [
    headingSummary,
    ...summaryBits,
  ].filter(Boolean);

  // Require at least one step OR a non-empty plan announcement with structure
  // Spec: return null if no plan structure found; canApprove if steps.length > 0
  if (steps.length === 0 && !headingSummary && summaryBits.length === 0) {
    // Bare "## Plan" with nothing after is still a plan structure with empty steps
    // But only if we matched a clear plan heading/line
    // Keep it as a card with empty steps (canApprove false)
  }

  // If we only matched "Plan:" with zero content and zero steps, still return card
  // If the match was weak (word "plan" in body) we already require heading or Plan:

  const summary =
    summaryParts.join(' ').trim() ||
    (steps.length > 0 ? steps.map((s) => s.title).join('; ') : '');

  // Prefer title from heading; if title is generic and we have headingSummary short, keep Plan
  if (title.length > 80) title = 'Plan';

  return {
    id: id && id.trim() ? id.trim() : `plan-${Date.now()}`,
    title,
    summary,
    steps,
    risk,
    canApprove: steps.length > 0,
    canReject: true,
  };
}

export function planFromApproval(input: {
  id: string;
  title?: string;
  summary?: string;
  risk?: string | null;
  steps?: string[];
}): PlanCardModel {
  const steps = (input.steps ?? []).map((title, index) => ({
    id: makeStepId(index),
    title: String(title).trim() || `Step ${index + 1}`,
    status: 'pending' as const,
  }));

  return {
    id: String(input.id || 'plan'),
    title: (input.title && String(input.title).trim()) || 'Plan',
    summary: input.summary != null ? String(input.summary) : '',
    steps,
    risk: normalizeRisk(input.risk),
    canApprove: steps.length > 0,
    canReject: true,
  };
}

export function advancePlanStep(
  plan: PlanCardModel,
  stepId: string,
  status: PlanStep['status'],
): PlanCardModel {
  const steps = plan.steps.map((step) =>
    step.id === stepId ? { ...step, status } : step,
  );
  const allTerminal = steps.length > 0 && steps.every(
    (s) => s.status === 'done' || s.status === 'skipped',
  );
  return {
    ...plan,
    steps,
    canApprove: steps.length > 0 && !allTerminal,
    canReject: !allTerminal,
  };
}

export function markPlanComplete(plan: PlanCardModel): PlanCardModel {
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.status === 'skipped' ? step : { ...step, status: 'done' as const },
    ),
    canApprove: false,
    canReject: false,
  };
}
