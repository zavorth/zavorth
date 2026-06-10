import type { ApprovalItem, ChatMessage } from '../apiClient';
import { Sparkles } from '../icons';
import { InlineActivityStrip } from './InlineActivityStrip';

const quickActions = [
  'Planeje uma entrega local com memória, skills e aprovação',
  'Revise este projeto e proponha os próximos passos',
  'Crie um fluxo com agentes, ferramentas e limites claros',
];

export function ThreadView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  messages: ChatMessage[];
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onOpenReview(): void;
  onSuggestion(value: string): void;
}) {
  return (
    <div className="zvd-thread" aria-live="polite">
      {props.messages.length === 0 ? (
        <div className="zvd-empty-thread">
          <div className="zvd-hero-brand" aria-label="Zavorth">
            <span>Zavorth</span>
          </div>
          <h1>No que vamos trabalhar?</h1>
          <p>Planeje, revise ou entregue uma tarefa com runtime local, memória e aprovações visíveis.</p>
          <div className="zvd-suggestion-stack" aria-label="Sugestões iniciais">
            {quickActions.map(action => (
              <button disabled={props.busy} key={action} onClick={() => props.onSuggestion(action)} type="button">
                <Sparkles aria-hidden="true" size={14} stroke={1.8} />
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : props.messages.map(message => (
        <article key={message.id} className={`zvd-message zvd-message--${message.role}`}>
          <span>{message.role}</span>
          <p>{message.content}</p>
        </article>
      ))}
      <InlineActivityStrip
        approvals={props.approvals}
        busy={props.busy}
        onDecision={props.onDecision}
        onOpenReview={props.onOpenReview}
      />
    </div>
  );
}
