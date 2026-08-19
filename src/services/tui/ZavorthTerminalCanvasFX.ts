export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface ModelCardMetrics {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly contextWindowTokens: number;
  readonly costPer1MInputUsd: number;
  readonly costPer1MOutputUsd: number;
  readonly reasoningScore: number;
  readonly speedTokensPerSec: number;
  readonly isLocal: boolean;
}

export interface ModelRecommendationResult {
  readonly model: ModelCardMetrics;
  readonly isRecommended: boolean;
  readonly score: number;
  readonly rationale: string;
}

export class ZavorthTerminalCanvasFX {
  public static readonly COLOR_CYAN: RgbColor = { r: 0, g: 210, b: 255 };
  public static readonly COLOR_PURPLE: RgbColor = { r: 168, g: 85, b: 247 };
  public static readonly COLOR_EMERALD: RgbColor = { r: 16, g: 185, b: 129 };
  public static readonly COLOR_AMBER: RgbColor = { r: 245, g: 158, b: 11 };
  public static readonly COLOR_ROSE: RgbColor = { r: 244, g: 63, b: 94 };

  public lerpColor(c1: RgbColor, c2: RgbColor, factor: number): RgbColor {
    const t = Math.max(0, Math.min(1, factor));
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t),
    };
  }

  public toAnsiRgbForeground(color: RgbColor): string {
    return `\x1b[38;2;${color.r};${color.g};${color.b}m`;
  }

  public toAnsiReset(): string {
    return '\x1b[0m';
  }

  public calculateReasoningPulse(
    elapsedMs: number,
    tokensPerSecond: number,
    reasoningMode: 'none' | 'low' | 'medium' | 'high' | 'extreme'
  ): {
    color: RgbColor;
    intensity: number;
    glyph: string;
    label: string;
  } {
    const modeMultiplier: Record<typeof reasoningMode, number> = {
      none: 0.5,
      low: 1.0,
      medium: 1.8,
      high: 2.8,
      extreme: 4.0,
    };

    const speedFactor = Math.min(3, Math.max(0.5, tokensPerSecond / 20));
    const frequency = 0.003 * modeMultiplier[reasoningMode] * speedFactor;
    const wave = (Math.sin(elapsedMs * frequency) + 1) / 2;

    let baseColor = ZavorthTerminalCanvasFX.COLOR_CYAN;
    let targetColor = ZavorthTerminalCanvasFX.COLOR_PURPLE;
    let glyph = '✦';
    let label = 'Thinking';

    if (reasoningMode === 'high' || reasoningMode === 'extreme') {
      baseColor = ZavorthTerminalCanvasFX.COLOR_PURPLE;
      targetColor = ZavorthTerminalCanvasFX.COLOR_AMBER;
      glyph = '✶';
      label = reasoningMode === 'extreme' ? 'Deep Reasoning' : 'High Reasoning';
    } else if (reasoningMode === 'none') {
      baseColor = ZavorthTerminalCanvasFX.COLOR_EMERALD;
      targetColor = ZavorthTerminalCanvasFX.COLOR_CYAN;
      glyph = '●';
      label = 'Streaming';
    }

    const blendedColor = this.lerpColor(baseColor, targetColor, wave);

    return {
      color: blendedColor,
      intensity: wave,
      glyph,
      label,
    };
  }

  public recommendModels(
    models: readonly ModelCardMetrics[],
    contextRequirements: {
      readonly estimatedTokens: number;
      readonly requiresHighReasoning: boolean;
      readonly prioritizeLocal: boolean;
      readonly budgetSensitive: boolean;
    }
  ): readonly ModelRecommendationResult[] {
    const scored = models.map((model) => {
      let score = 50;
      const reasons: string[] = [];

      if (contextRequirements.estimatedTokens > model.contextWindowTokens) {
        score -= 100;
        reasons.push('Context window insufficient');
      } else {
        score += 20;
      }

      if (contextRequirements.prioritizeLocal) {
        if (model.isLocal) {
          score += 40;
          reasons.push('Local-first execution prioritized');
        } else {
          score -= 30;
        }
      }

      if (contextRequirements.requiresHighReasoning) {
        score += model.reasoningScore * 5;
        if (model.reasoningScore >= 8) {
          reasons.push('Strong architectural & coding reasoning capacity');
        }
      }

      if (contextRequirements.budgetSensitive) {
        const totalCost = model.costPer1MInputUsd + model.costPer1MOutputUsd;
        if (totalCost === 0) {
          score += 35;
          reasons.push('Zero API cost (Local/Open)');
        } else if (totalCost < 5) {
          score += 20;
          reasons.push('Cost-effective token rate');
        } else if (totalCost > 20) {
          score -= 25;
        }
      }

      return {
        model,
        score,
        isRecommended: false,
        rationale: reasons.join('; ') || 'Balanced general-purpose capability',
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map((item, idx) => ({
      ...item,
      isRecommended: idx === 0 && item.score > 0,
    }));
  }
}
