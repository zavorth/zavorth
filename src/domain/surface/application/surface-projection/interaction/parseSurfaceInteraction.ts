import {
  normalizeAgentPermissionChoice,
  type AgentPermissionChoice,
} from '../../../../../contracts/permission/AgentPermissionContract.js';
import {
  SEMANTIC_INTERACTION_CONTRACT_VERSION,
  type ParseSurfaceInteractionInput,
  type SemanticInteractionEvent,
} from './SemanticInteractionContract.js';
import { matchReactionMapping, parseReactionInteraction } from './SurfaceReactions.js';

function baseEvent(
  input: ParseSurfaceInteractionInput,
  partial: Omit<
    SemanticInteractionEvent,
    'version' | 'surface' | 'raw' | 'actorId' | 'sessionId' | 'metadata'
  > &
    Partial<Pick<SemanticInteractionEvent, 'metadata'>>,
): SemanticInteractionEvent {
  return {
    version: SEMANTIC_INTERACTION_CONTRACT_VERSION,
    surface: String(input.surface || 'plain').trim().toLowerCase() || 'plain',
    raw: String(input.raw || ''),
    actorId: input.actorId ?? null,
    sessionId: input.sessionId ?? null,
    metadata: {
      ...(input.metadata || {}),
      ...(partial.metadata || {}),
    },
    kind: partial.kind,
    controlId: partial.controlId,
    optionId: partial.optionId,
    approvalId: partial.approvalId,
    choice: partial.choice,
    action: partial.action,
  };
}

function choiceToAction(choice: AgentPermissionChoice | null): SemanticInteractionEvent['action'] {
  if (choice === 'deny') return 'reject';
  if (choice) return 'approve';
  return 'unknown';
}

/** task:once|session|always|deny:<id> and legacy task:approve|reject:<id> */
function parseTaskCallback(raw: string): {
  choice: AgentPermissionChoice;
  taskId: string;
  legacy: boolean;
} | null {
  const modern = /^task:(once|session|always|deny):([^:\s]{1,160})$/i.exec(raw);
  if (modern) {
    return {
      choice: modern[1].toLowerCase() as AgentPermissionChoice,
      taskId: modern[2],
      legacy: false,
    };
  }
  const legacy = /^task:(approve|reject):([^:\s]{1,160})$/i.exec(raw);
  if (legacy) {
    return {
      choice: legacy[1].toLowerCase() === 'reject' ? 'deny' : 'once',
      taskId: legacy[2],
      legacy: true,
    };
  }
  return null;
}

function parseTaskUndo(raw: string): string | null {
  const m = /^task:undo:([^:\s]{1,160})$/i.exec(raw);
  return m ? m[1] : null;
}

/** /approve <id> [once|session|always]  or  /reject <id> */
function parseSlashApproval(raw: string): {
  choice: AgentPermissionChoice;
  taskId: string;
} | null {
  const text = raw.trim();
  const approve = /^\/approve(?:@\w+)?\s+([^\s]+)(?:\s+(once|session|always|approve|deny))?$/i.exec(
    text,
  );
  if (approve) {
    const choiceRaw = (approve[2] || 'once').toLowerCase();
    const choice =
      choiceRaw === 'approve'
        ? 'once'
        : (normalizeAgentPermissionChoice(choiceRaw) as AgentPermissionChoice | null) || 'once';
    return { taskId: approve[1], choice: choice === 'deny' ? 'once' : choice };
  }
  const reject = /^\/reject(?:@\w+)?\s+([^\s]+)/i.exec(text);
  if (reject) {
    return { taskId: reject[1], choice: 'deny' };
  }
  return null;
}

/** approve <id> [choice] without leading slash (CLI / free text). */
function parseBareApprovalCommand(raw: string): {
  choice: AgentPermissionChoice;
  taskId: string;
} | null {
  const text = raw.trim();
  const approve = /^(?:approve)\s+([^\s]+)(?:\s+(once|session|always|deny|approve))?$/i.exec(text);
  if (approve) {
    const choiceRaw = (approve[2] || 'once').toLowerCase();
    if (choiceRaw === 'deny') return { taskId: approve[1], choice: 'deny' };
    const choice =
      choiceRaw === 'approve'
        ? 'once'
        : (normalizeAgentPermissionChoice(choiceRaw) as AgentPermissionChoice | null) || 'once';
    return { taskId: approve[1], choice };
  }
  const reject = /^(?:reject|deny)\s+([^\s]+)/i.exec(text);
  if (reject) {
    return { taskId: reject[1], choice: 'deny' };
  }
  return null;
}

/**
 * API-style payloads:
 * - "choice:once approvalId:uuid"
 * - JSON string {"choice":"once","approvalId":"..."}
 * - "once <id>"
 */
function parseApiChoice(raw: string): {
  choice: AgentPermissionChoice;
  taskId: string;
} | null {
  const text = raw.trim();
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const choice =
        normalizeAgentPermissionChoice(obj.choice) ||
        normalizeAgentPermissionChoice(obj.decision);
      const taskId = String(
        obj.approvalId || obj.taskId || obj.task_id || obj.id || '',
      ).trim();
      if (choice && taskId) {
        return { choice: choice as AgentPermissionChoice, taskId };
      }
      if (String(obj.decision || '').toLowerCase() === 'reject' && taskId) {
        return { choice: 'deny', taskId };
      }
      if (String(obj.decision || '').toLowerCase() === 'approve' && taskId) {
        return { choice: 'once', taskId };
      }
    } catch {
      // not JSON
    }
  }

  const kvChoice = /(?:choice|decision)\s*[:=]\s*(once|session|always|deny|approve|reject)/i.exec(
    text,
  );
  const kvId =
    /(?:approvalId|taskId|task_id|id)\s*[:=]\s*([^\s,}"']+)/i.exec(text) ||
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i.exec(text);
  if (kvChoice && kvId) {
    let choice = normalizeAgentPermissionChoice(kvChoice[1]) as AgentPermissionChoice | null;
    if (!choice) {
      const c = kvChoice[1].toLowerCase();
      if (c === 'approve') choice = 'once';
      else if (c === 'reject') choice = 'deny';
    }
    if (choice) return { choice, taskId: kvId[1] };
  }

  const short = /^(once|session|always|deny)\s+([^\s]+)$/i.exec(text);
  if (short) {
    return {
      choice: short[1].toLowerCase() as AgentPermissionChoice,
      taskId: short[2],
    };
  }
  return null;
}

function parseNumberedReply(
  raw: string,
  numberedOptions: string[] | null | undefined,
): { optionId: string; index: number } | null {
  if (!numberedOptions || numberedOptions.length === 0) return null;
  const m = /^\s*([1-9]\d*)\s*$/.exec(raw.trim());
  if (!m) return null;
  const index = Number(m[1]);
  if (!Number.isFinite(index) || index < 1 || index > numberedOptions.length) return null;
  return { optionId: numberedOptions[index - 1], index };
}

function optionIdToChoice(optionId: string): AgentPermissionChoice | null {
  const id = String(optionId || '').toLowerCase();
  if (id === 'once' || id.endsWith('-once') || id.includes('perm-once')) return 'once';
  if (id === 'session' || id.endsWith('-session') || id.includes('perm-session')) return 'session';
  if (id === 'always' || id.endsWith('-always') || id.includes('perm-always')) return 'always';
  if (id === 'deny' || id.endsWith('-deny') || id.includes('perm-deny') || id.includes('reject')) {
    return 'deny';
  }
  return normalizeAgentPermissionChoice(id);
}

/**
 * Normalize a raw surface interaction into a SemanticInteractionEvent.
 * Returns null only when input is empty/whitespace.
 */
export function parseSurfaceInteraction(
  input: ParseSurfaceInteractionInput,
): SemanticInteractionEvent | null {
  const raw = String(input.raw ?? '').trim();
  if (!raw) return null;

  const hint = input.kindHint || 'auto';

  // F5e — reactions (emoji / shortcode)
  if (hint === 'reaction' || (hint === 'auto' && matchReactionMapping(raw))) {
    const reactionEvent = parseReactionInteraction({
      surface: input.surface,
      reaction: raw,
      approvalId: String(input.metadata?.approvalId || input.metadata?.taskId || '').trim() || null,
      actorId: input.actorId,
      sessionId: input.sessionId,
      highRisk: input.highRisk ?? Boolean(input.metadata?.highRisk),
      profile: input.profile,
      metadata: input.metadata,
    });
    if (reactionEvent) return reactionEvent;
  }

  // Undo callback (Telegram inline)
  if (hint === 'callback' || hint === 'auto') {
    const undoId = parseTaskUndo(raw);
    if (undoId) {
      return baseEvent(input, {
        kind: 'callback',
        controlId: 'task-undo',
        optionId: 'undo',
        approvalId: undoId,
        choice: null,
        action: 'undo',
        metadata: { taskId: undoId },
      });
    }

    const taskCb = parseTaskCallback(raw);
    if (taskCb) {
      return baseEvent(input, {
        kind: 'callback',
        controlId: 'agent-permission-choices',
        optionId: `agent-perm-${taskCb.choice}`,
        approvalId: taskCb.taskId,
        choice: taskCb.choice,
        action: choiceToAction(taskCb.choice),
        metadata: { legacyCallback: taskCb.legacy, taskId: taskCb.taskId },
      });
    }
  }

  if (hint === 'text' || hint === 'auto' || hint === 'api') {
    const slash = parseSlashApproval(raw);
    if (slash) {
      return baseEvent(input, {
        kind: raw.trim().startsWith('/') ? 'slash' : 'command',
        controlId: 'agent-permission-choices',
        optionId: `agent-perm-${slash.choice}`,
        approvalId: slash.taskId,
        choice: slash.choice,
        action: choiceToAction(slash.choice),
        metadata: { taskId: slash.taskId },
      });
    }

    const bare = parseBareApprovalCommand(raw);
    if (bare) {
      return baseEvent(input, {
        kind: 'command',
        controlId: 'agent-permission-choices',
        optionId: `agent-perm-${bare.choice}`,
        approvalId: bare.taskId,
        choice: bare.choice,
        action: choiceToAction(bare.choice),
        metadata: { taskId: bare.taskId },
      });
    }
  }

  if (hint === 'api' || hint === 'auto') {
    const api = parseApiChoice(raw);
    if (api) {
      return baseEvent(input, {
        kind: 'api_choice',
        controlId: 'agent-permission-choices',
        optionId: `agent-perm-${api.choice}`,
        approvalId: api.taskId,
        choice: api.choice,
        action: choiceToAction(api.choice),
        metadata: { taskId: api.taskId },
      });
    }
  }

  if (hint === 'text' || hint === 'auto') {
    const numbered = parseNumberedReply(raw, input.numberedOptions);
    if (numbered) {
      const choice = optionIdToChoice(numbered.optionId);
      const approvalFromMeta = String(
        input.metadata?.approvalId || input.metadata?.taskId || '',
      ).trim();
      return baseEvent(input, {
        kind: 'numbered_reply',
        controlId: 'agent-permission-choices',
        optionId: numbered.optionId,
        approvalId: approvalFromMeta || null,
        choice,
        action: choiceToAction(choice),
        metadata: {
          index: numbered.index,
          taskId: approvalFromMeta || null,
        },
      });
    }
  }

  return baseEvent(input, {
    kind: 'unknown',
    controlId: null,
    optionId: null,
    approvalId: null,
    choice: null,
    action: 'unknown',
  });
}

/**
 * Map a semantic event to TelegramTaskApprovalService args: `"<taskId> <choice>"`.
 */
export function toPermissionApprovalArgs(
  event: SemanticInteractionEvent,
): { taskId: string; choice: AgentPermissionChoice } | null {
  const taskId = String(event.approvalId || event.metadata?.taskId || '').trim();
  if (!taskId) return null;
  if (event.action === 'undo') return null;
  // High-risk reaction still waiting for explicit "yes" confirmation
  if (event.metadata?.requiresConfirmation || event.metadata?.blocked) {
    return null;
  }
  if (event.choice) {
    return { taskId, choice: event.choice };
  }
  if (event.action === 'reject') {
    return { taskId, choice: 'deny' };
  }
  if (event.action === 'approve') {
    return { taskId, choice: 'once' };
  }
  return null;
}

export function isPermissionDecisionEvent(event: SemanticInteractionEvent): boolean {
  return Boolean(
    event &&
      event.approvalId &&
      !event.metadata?.requiresConfirmation &&
      !event.metadata?.blocked &&
      (event.choice || event.action === 'approve' || event.action === 'reject'),
  );
}

export function isUndoEvent(event: SemanticInteractionEvent): boolean {
  return event?.action === 'undo' && Boolean(event.approvalId);
}
