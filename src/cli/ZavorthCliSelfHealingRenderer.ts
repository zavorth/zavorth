import type { ZavorthSelfHealingProjection } from '../contracts/ZavorthSelfHealingUxContract.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { paintCliTone } from './ZavorthCliVisualTheme.js';
import { sanitizeHumanCliText } from './ZavorthCliText.js';

export function formatZavorthSelfHealingProjection(projection: ZavorthSelfHealingProjection): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'What happened',
      tone: projection.issue === 'approval_required' ? 'warning' : projection.ok ? 'success' : 'danger',
      lines: [
        `Tried: ${sanitizeHumanCliText(projection.attempted)}`,
        `Problem: ${sanitizeHumanCliText(projection.problem)}`,
        `Impact: ${sanitizeHumanCliText(projection.impact)}`,
      ],
    },
    {
      title: projection.canZavorthRepair ? 'I can help' : 'Needs your decision',
      tone: projection.canZavorthRepair ? 'brand' : 'warning',
      lines: [
        sanitizeHumanCliText(projection.nextSafeAction),
        projection.needsUserInput ? 'I need one piece of input from you before I can continue safely.'
          : 'I can prepare the next safe step without exposing secrets.',
      ],
    },
  ];

  if (projection.fallback) {
    panels.push({
      title: 'Fallback routing',
      tone: projection.fallback.candidates.length ? 'success' : 'warning',
      lines: [
        sanitizeHumanCliText(projection.fallback.reason),
        projection.fallback.selectedProvider ? `Preferred fallback: ${projection.fallback.selectedProvider}`
          : 'No fallback route is proven ready yet.',
        projection.fallback.candidates.length ? `Available candidates: ${projection.fallback.candidates.join(', ')}`
          : '',
      ].filter(Boolean),
    });
  }

  if (projection.setup) {
    panels.push({
      title: 'Needed from you',
      tone: projection.setup.secretSafe ? 'success' : 'warning',
      lines: [
        `Target: ${projection.setup.target}`,
        ...projection.setup.requiredInput.map((item) => `- ${sanitizeHumanCliText(item)}`),
        ...projection.setup.notes.slice(0, 3).map((item) => paintCliTone(sanitizeHumanCliText(item), 'muted')),
      ],
    });
  }

  panels.push({
    title: 'Safe actions',
    tone: 'neutral',
    lines: projection.actions.slice(0, 4).map((action) => {
      const badges = [
        action.approvalRequired ? 'approval' : 'no approval',
        action.needsUserInput ? 'needs input' : 'automatic',
      ].join(' | ');
      const hint = action.prompt || action.command || '';
      return `${action.label}: ${sanitizeHumanCliText(action.detail)} (${badges})${hint ? `\n  ${paintCliTone(hint, 'muted')}` : ''}`;
    }),
  });

  panels.push({
    title: 'Safety',
    tone: 'muted',
    lines: [
      'No raw secrets are printed.',
      'Learned preferences cannot weaken core safety policy.',
      projection.receipt.willBeCreated ? `Receipt: ${sanitizeHumanCliText(projection.receipt.reason)}`
        : 'No repair receipt is needed.',
    ],
  });

  return renderCliScreen({
    eyebrow: 'Self-Healing',
    title: projection.ok ? 'Ready' : 'Recovery',
    summary: projection.ok ? 'No repair is needed.'
      : 'Zavorth explains the failure and prepares the next safe repair.',
    panels,
    mode: 'hero',
    showWordmark: false,
  });
}
