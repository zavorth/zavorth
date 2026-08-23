export type ChannelMeshApprovalCommand = {
  action: 'approve' | 'deny';
  ref: string;
  choice: 'once' | 'session' | 'always';
};

const APPROVAL_COMMAND_PATTERN =
  /^\/(approve|deny)\s+([A-Za-z0-9][A-Za-z0-9:_-]*)\s*(once|session|always)?\s*$/i;

const CHOICE_BY_ACTION: Record<'approve' | 'deny', 'once' | 'session' | 'always'> = {
  approve: 'once',
  deny: 'always',
};

/**
 * Parses structured approval commands typed on channel-mesh surfaces.
 * Only exact slash syntax is recognized; natural-language approval phrases
 * stay governed by the LLM intent layer.
 */
export function parseChannelMeshApprovalCommand(text: string): ChannelMeshApprovalCommand | null {
  const match = APPROVAL_COMMAND_PATTERN.exec(String(text || '').trim());
  if (!match) {
    return null;
  }
  const action = match[1].toLowerCase() as 'approve' | 'deny';
  return {
    action,
    ref: match[2],
    choice: (match[3]?.toLowerCase() as ChannelMeshApprovalCommand['choice']) || CHOICE_BY_ACTION[action],
  };
}
