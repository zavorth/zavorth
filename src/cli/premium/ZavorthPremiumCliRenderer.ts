import {
  renderPremiumProgressRail,
  type ZavorthPremiumCliStep,
} from './ZavorthPremiumCliProgressRail.js';
import {
  createZavorthPremiumCliTheme,
  paintPremiumAccent,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';
import { renderPremiumBrand, renderPremiumCompactBrand } from './ZavorthPremiumCliBrand.js';
import {
  renderPremiumActions,
  renderPremiumInlineNotice,
  renderPremiumPanel,
  renderPremiumStatusRows,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from './ZavorthPremiumCliPanels.js';


export type ZavorthPremiumCliScreen = {
  title: string;
  subtitle?: string | null;
  mode?: 'hero' | 'compact';
  steps?: ZavorthPremiumCliStep[];
  statusRows?: ZavorthPremiumCliStatusRow[];
  panels?: ZavorthPremiumCliPanel[];
  actions?: ZavorthPremiumCliAction[];
  notice?: {
    title: string;
    body: string;
  } | null;
};

export class ZavorthPremiumCliRenderer {
  private readonly theme: ZavorthPremiumCliTheme;

  constructor(theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme()) {
    this.theme = theme;
  }

  public renderScreen(screen: ZavorthPremiumCliScreen): string {
    const parts: string[] = [];
    parts.push(screen.mode === 'compact'
      ? renderPremiumCompactBrand(this.theme)
      : renderPremiumBrand(this.theme));
    parts.push(this.renderTitle(screen.title, screen.subtitle));

    if (screen.steps && screen.steps.length > 0) {
      parts.push(renderPremiumProgressRail(screen.steps, this.theme));
    }

    if (screen.statusRows && screen.statusRows.length > 0) {
      parts.push(renderPremiumPanel({
        title: 'Runtime status',
        accent: 'cyan',
        lines: renderPremiumStatusRows(screen.statusRows, this.theme).split('\n'),
      }, this.theme));
    }

    if (screen.notice) {
      parts.push(renderPremiumInlineNotice(screen.notice.title, screen.notice.body, 'amber', this.theme));
    }

    for (const panel of screen.panels || []) {
      parts.push(renderPremiumPanel(panel, this.theme));
    }

    if (screen.actions && screen.actions.length > 0) {
      parts.push(renderPremiumPanel({
        title: 'Next actions',
        accent: 'emerald',
        lines: renderPremiumActions(screen.actions, this.theme).split('\n'),
      }, this.theme));
    }

    return parts.filter(Boolean).join('\n\n');
  }

  public renderTitle(title: string, subtitle?: string | null): string {
    return [
      paintPremiumAccent(String(title || 'Zavorth').trim(), 'neural', this.theme),
      subtitle ? paintPremiumAccent(String(subtitle).trim(), 'muted', this.theme) : null,
    ].filter(Boolean).join('\n');
  }
}

export function renderZavorthPremiumCliScreen(screen: ZavorthPremiumCliScreen): string {
  return new ZavorthPremiumCliRenderer().renderScreen(screen);
}
