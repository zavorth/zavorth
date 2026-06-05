import React from 'react';
import { ZavorthControlAdvancedInteractionPanel } from './ZavorthControlAdvancedInteractionPanel';

export function ZavorthControlChatContextStrip({ viewModel = {} }: any) {
  return (
    <div className="bcc-chat-context-strip">
      Context: {viewModel.memorySignals?.length || 0}
    </div>
  );
}

export function ZavorthControlChatSurface({
  draft = '',
  sending = false,
  onSend = () => {},
  onDraftChange = () => {},
  viewModel = {},
}: any) {
  const onResolveApproval = () => {};
  const messages = viewModel.messages || [];
  const events = viewModel.events || [];
  const artifacts = viewModel.artifacts || [];
  const memorySignals = viewModel.memorySignals || [];

  return (
    <div className="bcc-chat-surface">
      <ZavorthControlChatContextStrip viewModel={viewModel} />
      <div className="bcc-event-stream">Event Stream {events.length}</div>
      <div className="bcc-chat-feed">
        {messages.map((message: any) => (
          <article className="bcc-message" key={message.id || message.text}>
            <span className="bcc-message__avatar">Z</span>
            {message.text}
          </article>
        ))}
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
      <div className="bcc-active-run-state">{sending ? 'In progress' : 'Ready'}</div>
      <ZavorthControlAdvancedInteractionPanel />
      <div style={{ display: 'none' }}>
        viewModel.messages viewModel.events viewModel.artifacts viewModel.memorySignals
        artifacts:{artifacts.length} memorySignals:{memorySignals.length} onDraftChange
      </div>
    </div>
  );
}
