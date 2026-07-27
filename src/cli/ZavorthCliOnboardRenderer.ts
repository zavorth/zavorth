import {
  ZAVORTH_CLI_BRAND_NAME,
  formatZavorthMascotBlock,
} from './ZavorthCliMascot.js';
import { padCliVisualText, paintCliTone } from './ZavorthCliVisualTheme.js';

export const ZAVORTH_ONBOARD_STEPS = [
  { label: 'Model', summary: 'choose the primary AI' },
  { label: 'access', summary: 'definir porta e usage local' },
  { label: 'Safety', summary: 'enable capabilities carefully' },
  { label: 'Person', summary: 'calibrate identity, user, and tone' },
  { label: 'Ready', summary: 'open Zavorth from the correct path' },
] as const;

const ONBOARD_STEP_LABEL_WIDTH = 10;

export function formatZavorthOnboardBanner(options: {
  currentModel?: string | null;
} = {}): string {
  const header = formatZavorthMascotBlock([
    paintCliTone(ZAVORTH_CLI_BRAND_NAME, 'brand'),
    "Let's prepare your local assistant",
    paintCliTone('Takes less than 2 minutes', 'muted'),
  ]);
  const steps = ZAVORTH_ONBOARD_STEPS.map((step, index) =>
    formatOnboardStep(index + 1, step.label, step.summary));
  const currentModel = String(options.currentModel || 'current model').trim() || 'current model';

  return [
    ...header,
    '',
    paintCliTone('What we will do', 'muted'),
    ...steps,
    '',
    `${paintCliTone('Current model', 'muted')}: ${currentModel}`,
  ].join('\n');
}

export function formatZavorthOnboardNonInteractiveHint(): string {
  return [
    '',
    `${paintCliTone('Warning', 'warning')}: the guided setup requires an interactive terminal.`,
    `${paintCliTone('Open', 'info')}: PowerShell, Windows Terminal, or VS Code terminal.`,
    `${paintCliTone('Run', 'info')}: zavorth setup`,
    `${paintCliTone('Preview', 'info')}: zavorth setup --dry-run`,
    `${paintCliTone('Safe JSON', 'info')}: zavorth setup --json --dry-run`,
    `${paintCliTone('Cloned repo', 'info')}: npm run setup`,
    `${paintCliTone('After', 'success')}: zavorth go or npm run go opens Home at /zavorthControl`,
    `${paintCliTone('Diagnostics', 'muted')}: zavorth doctor or npm run doctor`,
  ].join('\n');
}

function formatOnboardStep(index: number, label: string, summary: string): string {
  const number = paintCliTone(`${index}.`, 'brand');
  const paddedLabel = padCliVisualText(label, ONBOARD_STEP_LABEL_WIDTH);
  return `${number} ${paddedLabel} ${paintCliTone(summary, 'muted')}`;
}
