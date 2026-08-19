import {
  ZavorthTerminalCanvasFX,
  type ModelCardMetrics,
  type ModelRecommendationResult,
} from '../../services/tui/ZavorthTerminalCanvasFX.js';

export interface ModelPickerRenderOptions {
  readonly selectedIndex: number;
  readonly recommendations: readonly ModelRecommendationResult[];
}

export class ModelCatalogCardPickerRenderer {
  public render(options: ModelPickerRenderOptions): string {
    const { selectedIndex, recommendations } = options;
    const lines: string[] = [];

    lines.push('┌─ \x1b[1mZavorth Intelligent Model Catalog\x1b[0m ──────────────────────────────────────────┐');

    recommendations.forEach((rec, idx) => {
      const isSelected = idx === selectedIndex;
      const selector = isSelected ? '\x1b[36;1m▶\x1b[0m ' : '  ';
      const model = rec.model;

      const recBadge = rec.isRecommended
        ? ' \x1b[30;42;1m RECOMMENDED \x1b[0m'
        : '';
      const localBadge = model.isLocal
        ? ' \x1b[30;46m LOCAL \x1b[0m'
        : ' \x1b[90m CLOUD \x1b[0m';

      const header = `${selector}\x1b[1m${model.name}\x1b[0m (\x1b[35m${model.provider}\x1b[0m)${recBadge}${localBadge}`;
      lines.push(`│ ${header}`);

      const ctxFormatted = `${Math.round(model.contextWindowTokens / 1000)}k tokens`;
      const costFormatted =
        model.costPer1MInputUsd === 0 && model.costPer1MOutputUsd === 0
          ? 'Free / Local'
          : `$${model.costPer1MInputUsd}/$${model.costPer1MOutputUsd} per 1M`;

      const statsLine = `│    \x1b[90mContext: \x1b[37m${ctxFormatted}\x1b[90m │ Cost: \x1b[37m${costFormatted}\x1b[90m │ Reasoning: \x1b[33m${'★'.repeat(
        Math.min(5, Math.ceil(model.reasoningScore / 2))
      )}\x1b[90m │ Speed: \x1b[32m${model.speedTokensPerSec} t/s\x1b[0m`;
      lines.push(statsLine);

      if (rec.rationale) {
        lines.push(`│    \x1b[90mRationale: \x1b[36m${rec.rationale}\x1b[0m`);
      }

      lines.push('├' + '─'.repeat(78));
    });

    lines.push('│ \x1b[90m[↑/↓] Select Model | [Enter] Confirm Switch | [Esc] Cancel\x1b[0m');
    lines.push('└' + '─'.repeat(78));

    return lines.join('\n');
  }
}
