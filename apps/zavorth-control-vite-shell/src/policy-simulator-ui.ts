/**
 * Policy simulator (P2-16) — read-only keyword heuristic for predicted gates.
 */

type GatePrediction = {
  gate: string;
  reason: string;
};

const RULES: Array<{ pattern: RegExp; gate: string; reason: string }> = [
  { pattern: /\b(delete|remove|rm\b|unlink|drop)\b/i, gate: 'destructive', reason: 'would require approval' },
  { pattern: /\b(write|edit|patch|overwrite|save to|modify file)\b/i, gate: 'write', reason: 'would require approval' },
  { pattern: /\b(network|http|fetch|download|upload|webhook|api call)\b/i, gate: 'network', reason: 'would require approval' },
  { pattern: /\b(shell|terminal|exec|command|powershell|bash|cmd)\b/i, gate: 'shell', reason: 'would require approval' },
  { pattern: /\b(install|npm i|pip install|deploy|sudo)\b/i, gate: 'install', reason: 'would require approval' },
  { pattern: /\b(send|email|message|post to|publish)\b/i, gate: 'outbound', reason: 'would require approval' },
  { pattern: /\b(payment|transfer|transaction|wire)\b/i, gate: 'money', reason: 'would require approval' },
];

export function simulatePolicyGates(prompt: string): GatePrediction[] {
  const text = String(prompt || '').trim();
  if (!text) return [];
  const hits: GatePrediction[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    if (!rule.pattern.test(text) || seen.has(rule.gate)) continue;
    seen.add(rule.gate);
    hits.push({ gate: rule.gate, reason: rule.reason });
  }
  if (hits.length === 0) {
    hits.push({ gate: 'read', reason: 'likely allowed (no write/delete/network/shell signals)' });
  }
  return hits;
}

function renderResults(root: ParentNode, predictions: GatePrediction[]) {
  const list = root.querySelector<HTMLElement>('[data-policy-sim-results]');
  if (!list) return;
  if (predictions.length === 0) {
    list.innerHTML = '<li class="daily-muted">Enter a prompt.</li>';
    return;
  }
  list.innerHTML = predictions
    .map((item) => `<li><strong>${escapeLite(item.gate)}</strong> — ${escapeLite(item.reason)}</li>`)
    .join('');
}

function escapeLite(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initPolicySimulatorUi(root: ParentNode = document) {
  const cards = root.querySelectorAll<HTMLElement>('[data-policy-simulator]');
  if (!cards.length) return;

  cards.forEach((card) => {
    if (card.dataset.policySimBound === '1') return;
    card.dataset.policySimBound = '1';

    const run = () => {
      const input = card.querySelector<HTMLInputElement>('[data-policy-sim-input]');
      const prompt = String(input?.value || '').trim();
      renderResults(card, simulatePolicyGates(prompt));
    };

    card.querySelector('[data-policy-sim-run]')?.addEventListener('click', (event) => {
      event.preventDefault();
      run();
    });

    card.querySelector<HTMLInputElement>('[data-policy-sim-input]')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        run();
      }
    });
  });
}
