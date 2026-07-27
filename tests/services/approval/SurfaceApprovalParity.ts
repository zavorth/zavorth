export function toUnifiedApprovalCard(input: {
  id: string;
  title: string;
  risk: string;
  decision: string;
  surface: string;
  effects: string[];
  toolName: string;
  cchannelId: string;
}) {
  return {
    id: input.id,
    riskLevel: input.risk,
    decision: {
      action: input.decision === 'once' || input.decision === 'session' ? 'approve' : input.decision,
    },
    effectsSummary: input.effects,
  };
}

export function mapChannelDecisionToTrustLoop(decision: string): string {
  if (decision === 'once' || decision === 'session') return 'approve';
  return decision;
}

export function formatUnifiedApprovalCardText(card: { id: string }): string {
  return `zavorth approval decide ${card.id}`;
}
