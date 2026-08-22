import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
function zavorthControlClassicClientDataLogs() {
  type LogRow = { timestamp?: string; level?: string; category?: string; message?: string };
  // Consumed at runtime via extractFunctionBody(); invoked by the logs refresh button.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function loadLogs() {
    try {
      const res = await fetch('/api/logs');
      const { logs } = await res.json();
      const html = logs
        .map((l: LogRow) => {
          const date = l.timestamp ? new Date(l.timestamp).toLocaleString() : '';
          return `
              <div class="log-item">
                <div class="log-time">${date}</div>
                <div class="log-level level-${l.level}">${l.level}</div>
                <div class="log-msg">[${l.category}] ${l.message}</div>
              </div>
            `;
        })
        .join('');
      document.getElementById('log-container')!.innerHTML = html || 'No logs.';
    } catch (error: unknown) {
      document.getElementById('log-container')!.innerHTML = 'Failed to load logs.';
    }
  }
}

export function getZavorthControlClassicClientDataLogsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientDataLogs);
}
