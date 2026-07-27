import type { IntelligenceFabricSnapshot } from '../contracts/native/IntelligenceFabricContract.js';
import type { ConversationalAgencyMessage } from '../contracts/PracticalAgencyContract.js';

const TERM_MAP = [
  { internal: 'Risk 3', human: 'change preview' },
  { internal: 'approval required', human: 'preciso da sua confirmation' },
  { internal: 'Capability Hub ticket', human: 'I will prepare that connection' },
  { internal: 'Fabric degraded', human: 'modo inteligente em observation' },
  { internal: 'Mutation Plane', human: 'reversible draft' },
  { internal: 'Risk Gate', human: 'impact confirmationo' },
];

export class ConversationalAgencyPresenter {
  public present(input: {
    fabric: IntelligenceFabricSnapshot;
    context?: 'chat' | 'zavorthControl' | 'receipt';
  }): ConversationalAgencyMessage {
    const { fabric } = input;
    const capability = fabric.capabilityBuilder;
    const risk = fabric.executionProposal.riskLevel;

    if (capability.status === 'draft_ready') {
      return this.message(
        'I can prepare that for you.',
        'I have not activated anything yet. I will prepare a proposal with manifest, tests, and safe dry-run for the requested capability.',
        'after you review the proposal and confirm whether to activate it.',
      );
    }

    if (capability.status === 'existing_capability') {
      return this.message(
        'Encontrei essa capability in Zavorth.',
        'I can guide configuration and verify what is missing without exposing secrets or activating anything by myself.',
        'when it is tudo ready, eu request sua confirmation to ativar.',
      );
    }

    if (risk <= 1) {
      return this.message(
        'Got it. I will take the direct path.',
        'I can answer, analyze, or inspect permitted context without asking for unnecessary confirmation.',
        'Se aparecer alguma action com impacto real, eu aviso before.',
      );
    }

    if (risk === 2) {
      return this.message(
        'I will prepare a preview.',
        'I can plan, simulate, and draft without applying real changes.',
        'Before applying any impact, I will return with a clear confirmation.',
      );
    }

    if (risk === 3) {
      return this.message(
        'I will leave a change preview ready.',
        'The change remains reversible and visible before it is applied.',
        'You approve through chat or ZavorthControl when applying.',
      );
    }

    return this.message(
      'This may cause real impact.',
      'before shell, installation, rede, secret, envio external, deploy ou apagamento, eu preciso de confirmation ou sandbox.',
      'I can prepare the safe plan now and wait for your decision.',
    );
  }

  public humanize(text: string): string {
    return TERM_MAP.reduce(
      (current, entry) => current.replace(new RegExp(escapeRegExp(entry.internal), 'gi'), entry.human),
      String(text || ''),
    );
  }

  private message(headline: string, body: string, nextAction: string): ConversationalAgencyMessage {
    return {
      headline,
      body: this.humanize(body),
      nextAction: this.humanize(nextAction),
      detailsHiddenByDefault: true,
      zavorthControlDetailsAvailable: true,
      internalTermsSuppressed: TERM_MAP.map((entry) => entry.internal),
    };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
