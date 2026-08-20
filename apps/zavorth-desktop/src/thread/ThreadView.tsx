import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { ApprovalItem, ChatMessage } from '../apiClient';
import { Sparkles } from '../icons';
import { t } from '../i18n';
import {
  consumeOnboardingCelebration,
  DESKTOP_ONBOARDING_COMPLETE_EVENT,
} from '../onboarding/desktopOnboarding';
import { InlineActivityStrip } from './InlineActivityStrip';
import { parsePlanFromText } from './planCard';

import { MarkdownContent } from '../lib/markdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { ReceiptChip } from './ReceiptChip';
import {
  DEFAULT_MESSAGE_WINDOW,
  nextMessageWindow,
  windowMessages,
} from './messageWindow';

import { PlanCardView } from './PlanCardView';
import { sliceStreamingMessages } from './streamIsolation';
import { HunkReviewCard } from './HunkReviewCard';
import { RunTimeline } from './RunTimeline.tsx';
import { AgentStrip } from './AgentStrip';
import { looksLikeUnifiedDiff, type HunkReceipt } from '../trust/hunkApproval';
import {
  buildRunTimeline,
  runTimelineHasActivity,
} from './runTimeline';
import type { AgentStripSource } from '../agents/agentStrip';
import { agentStripVisible, buildAgentStrip } from '../agents/agentStrip';

const NEAR_BOTTOM_PX = 120;

export function ThreadView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  messages: ChatMessage[];
  onDecision(
    id: string,
    decision: 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject',
  ): void | Promise<void>;
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
  /** Optional multi-agent list for the strip */
  agents?: AgentStripSource[] | null;
  /** Optional hunk receipt sink */
  onHunkReceipt?(receipt: HunkReceipt): void;
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

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(props.messages.length <= 1 ? 'auto' : 'smooth');
  }, [props.messages.length, props.busy, scrollToBottom]);

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

  const agentItems = useMemo(
    () => buildAgentStrip(props.agents || []),
    [props.agents],
  );
  const showAgentStrip = agentStripVisible(agentItems);

  const timelineItems = useMemo(
    () =>
      buildRunTimeline({
        messages: props.messages.map(message => ({
          id: message.id,
          role: message.role,
          content: message.content,
          title: message.title,
          at: message.at,
        })),
        approvals: props.approvals,
        agents: (props.agents || []).map(agent => ({
          id: agent.id,
          role: agent.role,
          status: agent.status,
          task: agent.task || agent.assignedTask,
        })),
      }),
    [props.messages, props.approvals, props.agents],
  );

  const hasTools = props.messages.some(message => message.role === 'tool');
  const showTimeline =
    timelineItems.length > 0 &&
    (props.busy || props.approvals.length > 0 || hasTools || runTimelineHasActivity(timelineItems));

  return (
    <div
      ref={containerRef}
      className="zvd-thread"
      aria-live="polite"
      onScroll={updateStickState}
      style={{ position: 'relative', overflowY: 'auto', height: '100%' }}
    >
      {showAgentStrip ? <AgentStrip items={agentItems} /> : null}

      {props.messages.length === 0 ? (
        <div className="zvd-empty-thread zvd-empty" role="status">
          {celebrate ? (
            <p className="zvd-onboarding-celebrate" role="status">
              {t('onboarding.celebration')}
            </p>
          ) : null}
          <div className="zvd-empty-mascot zvd-empty__icon" aria-hidden="true">
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
              const result = message.content || '';
              const showHunks = looksLikeUnifiedDiff(result);
              return (
                <div key={message.id} className="zvd-thread-tool-group">
                  <ToolCallBlock
                    toolName={message.title || 'Tool'}
                    result={result}
                    status="success"
                    onOpenPath={props.onOpenPath ? handleToolOpenPath : undefined}
                  />
                  {showHunks ? (
                    <HunkReviewCard
                      diffText={result}
                      reviewId={`tool-${message.id}`}
                      busy={props.busy}
                      onHunkReceipt={props.onHunkReceipt}
                    />
                  ) : null}
                </div>
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

            const messageHasDiff =
              (message.role === 'assistant' || message.role === 'system') &&
              looksLikeUnifiedDiff(message.content || '');

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
                  {messageHasDiff ? (
                    <HunkReviewCard
                      diffText={message.content}
                      reviewId={`msg-${message.id}`}
                      busy={props.busy}
                      onHunkReceipt={props.onHunkReceipt}
                    />
                  ) : null}
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

      {showTimeline ? (
        <RunTimeline items={timelineItems} busy={props.busy} compactLimit={8} />
      ) : null}

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
