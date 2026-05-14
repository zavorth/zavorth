// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientDataLogs() {
    async function loadLogs() {
      try {
         const res = await fetch('/api/logs');
         const { logs } = await res.json();
         const html = logs.map(l => {
            const date = l.timestamp ? new Date(l.timestamp).toLocaleString() : '';
            return `
              <div class="log-item">
                <div class="log-time">${date}</div>
                <div class="log-level level-${l.level}">${l.level}</div>
                <div class="log-msg">[${l.category}] ${l.message}</div>
              </div>
            `;
         }).join('');
         document.getElementById('log-container').innerHTML = html || 'Nenhum log.';
      } catch(e) {
         document.getElementById('log-container').innerHTML = 'Falha ao carregar logs.';
      }
    }
}

export function getDashboardClassicClientDataLogsScript(): string {
  return extractFunctionBody(dashboardClassicClientDataLogs);
}

