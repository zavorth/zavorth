export type ChannelMeshApprovalCommand = {
  action: 'approve' | 'deny';
  ref: string;
  choice: 'once' | 'session' | 'always';
};

export type ChannelMeshApprovalToken =
  | { kind: 'ordinal'; ordinal: number }
  | { kind: 'decision'; action: 'approve' | 'deny'; choice: 'once' | 'session' | 'always' };

const EXPLICIT_COMMAND_PATTERN =
  /^\/(approve|accept|reject|deny)\s+([A-Za-z0-9][A-Za-z0-9:_-]*)\s*(once|session|always)?\s*$/i;

const ORDINAL_PATTERN = /^([1-9])$/;
const DECISION_PATTERN = /^(approve|accept|ok|yes|y|always|reject|deny|no|cancel)$/i;

const APPROVE_DECISIONS = new Set(['approve', 'accept', 'ok', 'yes', 'y']);
const ALWAYS_DECISIONS = new Set(['always']);

/**
 * Parses structured approval interactions typed on channel-mesh surfaces.
 * Two layers, both closed token sets resolved only while an approval is
 * actually pending upstream: explicit slash commands carrying a ref, and
 * bare fast-path tokens (menu ordinals or single-word decisions). Natural
 * language stays governed by the LLM intent layer, never by keyword lists.
 */
export function parseChannelMeshApprovalCommand(text: string): ChannelMeshApprovalCommand | null {
  const match = EXPLICIT_COMMAND_PATTERN.exec(String(text || '').trim());
  if (!match) {
    return null;
  }
  const verb = match[1].toLowerCase();
  const action = verb === 'approve' || verb === 'accept' ? 'approve' : 'deny';
  const choice = (match[3]?.toLowerCase() as ChannelMeshApprovalCommand['choice']) || (action === 'deny' ? 'always' : 'once');
  if (!['once', 'session', 'always'].includes(choice)) {
    return null;
  }
  return { action, ref: match[2], choice };
}

export function parseChannelMeshApprovalToken(text: string): ChannelMeshApprovalToken | null {
  const trimmed = String(text || '').trim();
  const ordinal = ORDINAL_PATTERN.exec(trimmed);
  if (ordinal) {
    return { kind: 'ordinal', ordinal: Number(ordinal[1]) };
  }
  const decision = DECISION_PATTERN.exec(trimmed);
  if (!decision) {
    return null;
  }
  const word = decision[1].toLowerCase();
  if (APPROVE_DECISIONS.has(word)) {
    return { kind: 'decision', action: 'approve', choice: 'once' };
  }
  if (ALWAYS_DECISIONS.has(word)) {
    return { kind: 'decision', action: 'approve', choice: 'always' };
  }
  return { kind: 'decision', action: 'deny', choice: 'once' };
}
