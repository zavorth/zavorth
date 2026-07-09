import {
  accentForStatus,
  createZavorthPremiumCliTheme,
  paintPremiumAccent,
  statusSymbol,
  type ZavorthPremiumCliStatus,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';

export type ZavorthPremiumCliStep = {
  id: string;
  title: string;
  status: ZavorthPremiumCliStatus;
  detail?: string | null;
};

export function renderPremiumProgressRail(
  steps: ZavorthPremiumCliStep[],
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  return steps.map((step, index) => {
    const last = index === steps.length - 1;
    const rail = paintPremiumAccent(last ? ' ' : theme.symbols.rail, 'cyan', theme);
    const marker = statusSymbol(step.status, theme);
    const title = paintPremiumAccent(step.title, accentForStatus(step.status), theme);
    const detail = step.detail ? paintPremiumAccent(` - ${step.detail}`, 'muted', theme) : '';
    return `${rail} ${marker} ${title}${detail}`;
  }).join('\n');
}

export function renderPremiumStepHeader(
  step: ZavorthPremiumCliStep,
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  return [
    `${paintPremiumAccent(theme.symbols.rail, 'cyan', theme)} ${statusSymbol(step.status, theme)} ${paintPremiumAccent(step.title, accentForStatus(step.status), theme)}`,
    step.detail ? `${paintPremiumAccent(theme.symbols.rail, 'cyan', theme)}   ${paintPremiumAccent(step.detail, 'muted', theme)}` : null,
  ].filter(Boolean).join('\n');
}
