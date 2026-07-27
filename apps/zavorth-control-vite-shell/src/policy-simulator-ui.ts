/** Policy what-if preview. */

type GatePrediction = {
  gate: string;
  reason: string;
};

export function simulatePolicyGates(prompt: string): GatePrediction[] {
  const text = String(prompt || '').trim();
  if (!text) return [];
  return [{ gate: 'runtime-policy', reason: 'submit to the runtime policy engine for semantic evaluation' }];
}

function renderResults(root: ParentNode, predictions: GatePrediction[]) {
  const list = root.querySelector<HTMLElement>('[data-policy-sim-results]');
  if (!list) return;
  if (predictions.length === 0) {
    list.innerHTML = '<li class="daily-muted">Enter a prompt.</li>';
    return;
  }
  list.innerHTML = predictions
    .map((item) => `<li><strong>${escapeLite(item.gate)}</strong> - ${escapeLite(item.reason)}</li>`)
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
