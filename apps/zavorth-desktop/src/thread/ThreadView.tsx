import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { ApprovalItem, ChatMessage } from '../apiClient';
import { Sparkles } from '../icons';
import { t } from '../i18n';
import {
  consumeOnboardingCelebration,
  DESKTOP_ONBOARDING_COMPLETE_EVENT,
} from '../onboarding/desktopOnboarding';
import { InlineActivityStrip } from './InlineActivityStrip';
import { MarkdownContent } from '../lib/markdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { ReceiptChip } from './ReceiptChip';
import {
  DEFAULT_MESSAGE_WINDOW,
  nextMessageWindow,
  windowMessages,
} from './messageWindow';
import { parsePlanFromText } from './planCard';
import { PlanCardView } from './PlanCardView';
import { sliceStreamingMessages } from './streamIsolation';

const NEAR_BOTTOM_PX = 120;

export function ThreadView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  messages: ChatMessage[];
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onOpenReview(): void;
  onSuggestion(value: string): void;
  /** Open receipts / proof panel */
  onOpenProof?: () => void;
  /** Recent receipt count for the proof chip */
  recentReceiptCount?: number;
  /** Open a file/diff target from tool results or plan context */
  onOpenPath?(path: string, opts?: { line?: number; kind?: 'file' | 'diff' }): void;
  /** Approve a structured plan card parsed from assistant text */
  onApprovePlan?(planId: string): void;
  /** Reject a structured plan card parsed from assistant text */
  onRejectPlan?(planId: string): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [messageWindowSize, setMessageWindowSize] = useState(DEFAULT_MESSAGE_WINDOW);

  useEffect(() => {
    const syncCelebration = () => {
      if (consumeOnboardingCelebration()) {
        setCelebrate(true);
      }
    };
    syncCelebration();
    window.addEventListener(DESKTOP_ONBOARDING_COMPLETE_EVENT, syncCelebration);
    return () => window.removeEventListener(DESKTOP_ONBOARDING_COMPLETE_EVENT, syncCelebration);
  }, []);

  const quickActions = [
    t('thread.suggestion1'),
    t('thread.suggestion2'),
    t('thread.suggestion3'),
    t('thread.suggestion4'),
  ];

  const updateStickState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
    stickToBottomRef.current = true;
    setShowScrollBottom(false);
  }, []);

  // Smart auto-scroll: only follow new content when user is already near bottom.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(props.messages.length <= 1 ? 'auto' : 'smooth');
  }, [props.messages.length, props.busy, scrollToBottom]);

  // When user returns to chat empty → non-empty, pin to bottom once.
  useEffect(() => {
    if (props.messages.length === 0) {
      stickToBottomRef.current = true;
      setShowScrollBottom(false);
      setMessageWindowSize(DEFAULT_MESSAGE_WINDOW);
    }
  }, [props.messages.length]);

  const windowed = useMemo(
    () => windowMessages(props.messages, messageWindowSize),
    [props.messages, messageWindowSize],
  );

  // Stream isolation over the visible window — live assistant while busy.
  const streamSlice = useMemo(
    () =>
      sliceStreamingMessages(windowed.visible, {
        busy: props.busy,
      }),
    [windowed.visible, props.busy],
  );

  const showProofChip =
    Boolean(props.onOpenProof) &&
    props.messages.length > 0 &&
    (props.recentReceiptCount ?? 0) > 0;

  // Last assistant message id for placing proof chip after assistant turns.
  const lastAssistantId = (() => {
    for (let i = props.messages.length - 1; i >= 0; i -= 1) {
      if (props.messages[i].role === 'assistant') return props.messages[i].id;
    }
    return null;
  })();

  const handleToolOpenPath = useCallback(
    (path: string, line?: number) => {
      props.onOpenPath?.(path, { line, kind: 'file' });
    },
    [props.onOpenPath],
  );

  return (
    <div
      ref={containerRef}
      className="zvd-thread"
      aria-live="polite"
      onScroll={updateStickState}
      style={{ position: 'relative', overflowY: 'auto', height: '100%' }}
    >
      {props.messages.length === 0 ? (
        <div className="zvd-empty-thread zvd-empty" role="status">
          {celebrate ? (
            <p className="zvd-onboarding-celebrate" role="status">
              {t('onboarding.celebration')}
            </p>
          ) : null}
          <div className="zvd-empty-kael zvd-empty__icon" aria-hidden="true">
            <img src="./zavorth-mascot.svg" alt="" width={64} height={64} />
          </div>
          <p className="zvd-empty-eyebrow">{t('thread.emptyEyebrow')}</p>
          <h1 className="zvd-empty__title">{t('thread.emptyTitle')}</h1>
          <p className="zvd-empty__description">{t('thread.emptyBody')}</p>
          <div className="zvd-suggestion-stack zvd-empty__actions" aria-label={t('thread.suggestionsLabel')}>
            {quickActions.map(action => (
              <button
                disabled={props.busy}
                key={action}
                onClick={() => props.onSuggestion(action)}
                type="button"
              >
                <Sparkles aria-hidden="true" size={14} stroke={1.8} />
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="zvd-thread-messages-list">
          {windowed.canRevealMore ? (
            <div className="zvd-thread-window-bar">
              <button
                type="button"
                className="zvd-btn zvd-btn-ghost zvd-btn-sm"
                onClick={() => setMessageWindowSize(size => nextMessageWindow(size))}
              >
                {t('thread.showEarlier').replace('{count}', String(windowed.hiddenCount))}
              </button>
            </div>
          ) : null}
          {windowed.visible.map(message => {
            const isStreaming =
              Boolean(streamSlice.streamingId) && streamSlice.streamingId === message.id;

            if (message.role === 'tool') {
              return (
                <ToolCallBlock
                  key={message.id}
                  toolName={message.title || 'Tool'}
                  result={message.content}
                  status="success"
                  onOpenPath={props.onOpenPath ? handleToolOpenPath : undefined}
                />
              );
            }

            const roleLabel =
              message.role === 'user'
                ? t('thread.you')
                : message.role === 'system'
                  ? 'System'
                  : t('thread.zavorth');

            const plan =
              message.role === 'assistant'
                ? parsePlanFromText(message.content, `plan-${message.id}`)
                : null;

            return (
              <article
                key={message.id}
                className={`zvd-message zvd-message--${message.role}${isStreaming ? ' is-streaming' : ''}`}
                data-streaming={isStreaming ? 'true' : undefined}
              >
                <span className="zvd-message__role">{roleLabel}</span>
                <div className="zvd-message__body">
                  {plan ? (
                    <PlanCardView
                      plan={plan}
                      busy={props.busy}
                      onApprove={
                        plan.canApprove && props.onApprovePlan
                          ? () => props.onApprovePlan?.(plan.id)
                          : undefined
                      }
                      onReject={
                        plan.canReject && props.onRejectPlan
                          ? () => props.onRejectPlan?.(plan.id)
                          : undefined
                      }
                    />
                  ) : null}
                  <MarkdownContent content={message.content} />
                </div>
                {showProofChip &&
                message.role === 'assistant' &&
                message.id === lastAssistantId &&
                props.onOpenProof ? (
                  <div className="zvd-message__meta">
                    <ReceiptChip
                      count={props.recentReceiptCount}
                      onClick={props.onOpenProof}
                    />
                  </div>
                ) : null}
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
      <ScrollToBottomButton
        containerRef={containerRef}
        visible={showScrollBottom}
      />
    </div>
  );
}
