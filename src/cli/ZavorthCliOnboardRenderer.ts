import {
  ZAVORTH_CLI_BRAND_NAME,
  formatZavorthMascotBlock,
} from './ZavorthCliMascot.js';
import { padCliVisualText, paintCliTone } from './ZavorthCliVisualTheme.js';

export const ZAVORTH_ONBOARD_STEPS = [
  { label: 'Model', summary: 'choose the primary AI' },
  { label: 'Acesso', summary: 'definir porta e uso local' },
  { label: 'Seguranca', summary: 'ativar capacidades com cuidado' },
  { label: 'Pessoa', summary: 'calibrar identidade, usuario e tom' },
  { label: 'Pronto', summary: 'abrir o Zavorth pelo caminho certo' },
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
    `${paintCliTone('Aviso', 'warning')}: o setup guiado precisa de um terminal interativo.`,
    `${paintCliTone('Abra', 'info')}: PowerShell, Windows Terminal ou terminal do VS Code.`,
    `${paintCliTone('Run', 'info')}: zavorth setup`,
    `${paintCliTone('Preview', 'info')}: zavorth setup --dry-run`,
    `${paintCliTone('Safe JSON', 'info')}: zavorth setup --json --dry-run`,
    `${paintCliTone('Cloned repo', 'info')}: npm run setup`,
    `${paintCliTone('Depois', 'success')}: zavorth go ou npm run go abre o Home em /zavorthControl`,
    `${paintCliTone('Diagnostico', 'muted')}: zavorth doctor ou npm run doctor`,
  ].join('\n');
}

function formatOnboardStep(index: number, label: string, summary: string): string {
  const number = paintCliTone(`${index}.`, 'brand');
  const paddedLabel = padCliVisualText(label, ONBOARD_STEP_LABEL_WIDTH);
  return `${number} ${paddedLabel} ${paintCliTone(summary, 'muted')}`;
}
