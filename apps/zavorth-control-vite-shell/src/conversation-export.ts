export type ConversationExportContext = {
  sessionId: string;
  traceEvents: unknown[];
  composer: {
    settings: unknown;
    selectedTools: unknown[];
    attachments: Array<{
      name: string;
      type: string;
      size: number;
      truncated: boolean;
    }>;
  };
};

export function collectTranscriptMarkdown(root: ParentNode = document) {
  const groups = Array.from(root.querySelectorAll<HTMLElement>('#neural-feed .echo-group'));
  if (groups.length === 0) {
    return [
      '# Zavorth conversation',
      '',
      '_No messages in this session._',
    ].join('\n');
  }

  const lines = ['# Zavorth conversation', '', `Exported at ${new Date().toLocaleString()}`, ''];
  groups.forEach((group) => {
    const sender = group.querySelector('.echo-sender')?.textContent?.trim() || 'Message';
    const bubble = group.querySelector<HTMLElement>('.echo-bubble')?.innerText?.trim() || '';
    if (!bubble) return;
    lines.push(`## ${sender}`, '', bubble, '');
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function collectTranscriptRecords(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>('#neural-feed .echo-group')).map((group) => ({
    sender: group.querySelector('.echo-sender')?.textContent?.trim() || 'Message',
    time: group.querySelector('.echo-timestamp')?.textContent?.trim() || '',
    model: group.querySelector('.echo-meta__model')?.textContent?.trim() || '',
    route: group.querySelector('.echo-meta__cost')?.textContent?.trim() || '',
    text: group.querySelector<HTMLElement>('.echo-bubble')?.innerText?.trim() || '',
  })).filter((record) => record.text);
}

export function collectTranscriptText(root: ParentNode = document) {
  const records = collectTranscriptRecords(root);
  if (records.length === 0) return 'No messages in this session.';
  return records.map((record) => `[${record.time || 'now'}] ${record.sender}: ${record.text}`).join('\n\n');
}

export function collectTranscriptJson(context: ConversationExportContext, root: ParentNode = document) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    sessionId: context.sessionId,
    messages: collectTranscriptRecords(root),
    trace: context.traceEvents.slice(-90),
    composer: context.composer,
  }, null, 2);
}

export function downloadTextFile(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function exportConversation(format: string, context: ConversationExportContext) {
  const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  if (format === 'json') {
    downloadTextFile(`zavorth-conversation-${date}.json`, collectTranscriptJson(context), 'application/json;charset=utf-8');
    return 'Conversation exported as JSON.';
  }
  if (format === 'txt') {
    downloadTextFile(`zavorth-conversation-${date}.txt`, collectTranscriptText(), 'text/plain;charset=utf-8');
    return 'Conversation exported as text.';
  }
  downloadTextFile(`zavorth-conversation-${date}.md`, collectTranscriptMarkdown(), 'text/markdown;charset=utf-8');
  return 'Conversation exported as Markdown.';
}

export function getExportMenuHtml() {
  return `
    <div class="zavorth-export-menu" role="group" aria-label="Export formats">
      <button type="button" data-export-format="md"><strong>Markdown</strong><span>Readable transcript with headings.</span></button>
      <button type="button" data-export-format="json"><strong>JSON</strong><span>Messages, trace, composer context and receipts.</span></button>
      <button type="button" data-export-format="txt"><strong>Text</strong><span>Plain log for quick sharing.</span></button>
    </div>
  `;
}

