import { useRef, useState, useEffect, useCallback } from 'react';
import type { ApprovalItem, ChatMessage } from '../apiClient';
import { Sparkles } from '../icons';
import { InlineActivityStrip } from './InlineActivityStrip';
import { MarkdownContent } from '../lib/markdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ScrollToBottomButton } from './ScrollToBottomButton';

const quickActions = [
  'Plan a local delivery with memory, skills, and approval',
  'Review this project and propose next steps',
  'Create a flow with agents, tools, and clear limits',
];

export function ThreadView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  messages: ChatMessage[];
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onOpenReview(): void;
  onSuggestion(value: string): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 200;
    setShowScrollBottom(isUp);
  }, []);

  // Auto scroll to bottom when new messages arrive or when busy status changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });
  }, [props.messages.length, props.busy]);

  return (
    <div 
      ref={containerRef}
      className="zvd-thread" 
      aria-live="polite"
      onScroll={handleScroll}
      style={{ position: 'relative', overflowY: 'auto', height: '100%' }}
    >
      {props.messages.length === 0 ? (
        <div className="zvd-empty-thread">
          <h1>What should we work on?</h1>
          <p>Plan, review, or deliver a task with local runtime, memory, and visible approvals.</p>
          <div className="zvd-suggestion-stack" aria-label="Initial suggestions">
            {quickActions.map(action => (
              <button disabled={props.busy} key={action} onClick={() => props.onSuggestion(action)} type="button">
                <Sparkles aria-hidden="true" size={14} stroke={1.8} />
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="zvd-thread-messages-list">
          {props.messages.map(message => {
            if (message.role === 'tool') {
              return (
                <ToolCallBlock
                  key={message.id}
                  toolName={message.title || 'Tool'}
                  result={message.content}
                  status="success"
                />
              );
            }
            return (
              <article key={message.id} className={`zvd-message zvd-message--${message.role}`}>
                <span className="zvd-message__role">{message.role === 'user' ? 'You' : 'Zavorth'}</span>
                <div className="zvd-message__body">
                  <MarkdownContent content={message.content} />
                </div>
              </article>
            );
          })}
        </div>
      )}
      <InlineActivityStrip
        approvals={props.approvals}
        busy={props.busy}
        onDecision={props.onDecision}
        onOpenReview={props.onOpenReview}
      />
      <ScrollToBottomButton containerRef={containerRef} visible={showScrollBottom} />
    </div>
  );
}
