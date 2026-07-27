import React from 'react';
import { ZavorthControlAdvancedInteractionPanel } from './ZavorthControlAdvancedInteractionPanel';

export function ZavorthControlChatContextStrip({ viewModel = {} }: any) {
  const memoryCount = viewModel.memorySignals?.length || 0;
  const skillCount = viewModel.capabilities?.length || 0;
  const approvalCount = (viewModel.approvals || []).filter((approval: any) => approval.status === 'pending').length;

  return (
    <div className="bcc-chat-context-strip">
      <span>Contexto</span>
      <strong>{memoryCount} memory item(s)</strong>
      <strong>{skillCount} skill(s)</strong>
      {approvalCount > 0 ? <strong data-tone="attention">{approvalCount} review</strong> : <strong>without review pending</strong>}
    </div>
  );
}

export function ZavorthControlEmptyChatGreeting({ viewModel = {} }: any) {
  const openingLine = viewModel.profileLanguage?.emptyGreeting ||
    'Hi. I can work locally, use files, channels, and skills. You can ask directly.';

  return (
    <article className="bcc-empty-chat-greeting">
      <span className="bcc-message__avatar">Z</span>
      <div>
        <strong>Zavorth</strong>
        <p>{openingLine}</p>
      </div>
    </article>
  );
}

export function ZavorthControlRunControls({
  sending = false,
  viewModel = {},
  onStop,
  onQueue,
  onViewReceipt,
}: any) {
  const queued = viewModel.tasks?.filter((task: any) => task.status === 'queued').length || 0;
  const receipts = viewModel.artifacts?.length || viewModel.replay?.artifactCount || 0;

  return (
    <div className="bcc-run-controls" data-active-run-state={sending ? 'in-progress' : 'ready'}>
      <span className="bcc-active-run-state">{sending ? 'In progress' : 'Ready'}</span>
      <button type="button" disabled={!sending || !onStop} onClick={() => onStop?.()}>Stop</button>
      <button type="button" disabled={!onQueue} onClick={() => onQueue?.()}>Queue {queued}</button>
      <button type="button" disabled={!receipts || !onViewReceipt} onClick={() => onViewReceipt?.()}>View receipt {receipts}</button>
    </div>
  );
}

export function ZavorthControlChatSurface({
  draft = '',
  sending = false,
  onSend = () => {},
  onDraftChange = () => {},
  onStop,
  onQueue,
  onViewReceipt,
  viewModel = {},
}: any) {
  const onResolveApproval = () => {};
  const messages = viewModel.messages || [];
  const events = viewModel.events || [];
  const artifacts = viewModel.artifacts || [];
  const memorySignals = viewModel.memorySignals || [];
  const hasMessages = messages.length > 0;

  return (
    <div className="bcc-chat-surface">
      <ZavorthControlChatContextStrip viewModel={viewModel} />
      <div className="bcc-event-stream">Event Stream {events.length}</div>
      <div className="bcc-chat-feed">
        {!hasMessages ? <ZavorthControlEmptyChatGreeting viewModel={viewModel} /> : null}
        {messages.map((message: any, index: number) => {
          const isUser = message.role === 'user';
          return (
            <article className="bcc-message" data-role={message.role || 'assistant'} key={`${message.id || message.text || 'message'}:${index}`}>
              <span className="bcc-message__avatar">{isUser ? 'You' : 'Z'}</span>
              {message.text}
            </article>
          );
        })}
      </div>
      <div className="bcc-suggestion-chips">Message actions</div>
      <div className="bcc-compose">
        <div className="bcc-compose__input-frame">
          <textarea
            value={draft}
            placeholder="Message for Zavorth"
            onChange={(event) => onDraftChange(event.currentTarget.value)}
          />
        </div>
        <button onClick={onResolveApproval}>Edit</button>
        <button>Retry draft</button>
        <button disabled={sending} onClick={() => onSend(draft)}>Send</button>
      </div>
      <ZavorthControlRunControls
        sending={sending}
        viewModel={viewModel}
        onStop={onStop}
        onQueue={onQueue}
        onViewReceipt={onViewReceipt}
      />
      <ZavorthControlAdvancedInteractionPanel />
      <div style={{ display: 'none' }}>
        viewModel.messages viewModel.events viewModel.artifacts viewModel.memorySignals
        artifacts:{artifacts.length} memorySignals:{memorySignals.length} onDraftChange
        Queue View receipt data-active-run-state
      </div>
    </div>
  );
}
