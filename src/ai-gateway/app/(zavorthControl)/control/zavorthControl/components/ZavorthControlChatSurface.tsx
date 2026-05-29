import React from 'react';
import { ZavorthControlAdvancedInteractionPanel } from './ZavorthControlAdvancedInteractionPanel';

export function ZavorthControlChatSurface() {
  const onResolveApproval = () => {};
  return (
    <div className="bcc-chat-surface">
      <div className="bcc-event-stream">Event Stream</div>
      <div className="bcc-compose">
        <textarea placeholder="Message for Zavorth" />
        <button onClick={onResolveApproval}>Edit</button>
        <button>Retry draft</button>
      </div>
      <ZavorthControlAdvancedInteractionPanel />
    </div>
  );
}
