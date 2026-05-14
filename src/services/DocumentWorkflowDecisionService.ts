export type DocumentWorkflowTarget = 'open-prose' | 'lobster';

export type DocumentWorkflowDecision = {
  targetId: DocumentWorkflowTarget;
  status: 'workflow-decision-live';
  route: 'document.extract' | 'artifact.diff' | 'manual-review';
  reason: string;
  requiredApprovals: string[];
  artifactFirst: true;
  secretValuesSerialized: false;
};

export class DocumentWorkflowDecisionService {
  public decide(input: {
    targetId: DocumentWorkflowTarget;
    requestedAction?: string | null;
    sourceContentType?: string | null;
  }): DocumentWorkflowDecision {
    const action = String(input.requestedAction || '').toLowerCase();
    const contentType = String(input.sourceContentType || '').toLowerCase();
    if (input.targetId === 'lobster') {
      return {
        targetId: 'lobster',
        status: 'workflow-decision-live',
        route: action.includes('diff') ? 'artifact.diff' : 'document.extract',
        reason: 'lobster is activated as a governed document workflow route, not as a copied specialty runtime.',
        requiredApprovals: ['operator-document-workflow'],
        artifactFirst: true,
        secretValuesSerialized: false,
      };
    }
    return {
      targetId: 'open-prose',
      status: 'workflow-decision-live',
      route: action.includes('diff') || contentType.includes('patch') ? 'artifact.diff' : 'document.extract',
      reason: 'open-prose is routed through Zavorth document extraction and artifact diff primitives.',
      requiredApprovals: ['operator-document-workflow'],
      artifactFirst: true,
      secretValuesSerialized: false,
    };
  }
}
