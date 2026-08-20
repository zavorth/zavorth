import { ZavorthTerminalCanvasFX, type RgbColor } from './ZavorthTerminalCanvasFX.js';

export interface PulseVisualFrame {
  readonly intensity: number;
  readonly color: RgbColor;
  readonly ansiColor: string;
  readonly glyph: string;
  readonly ambientString: string;
}

export class TerminalReasoningPulseService {
  private static readonly BRAILLE_SPARKLES = ['\u2801', '\u2802', '\u2804', '\u2840', '\u2820', '\u2810', '✦', '✧', '·'];
  private readonly canvasFx: ZavorthTerminalCanvasFX;

  constructor(canvasFx = new ZavorthTerminalCanvasFX()) {
    this.canvasFx = canvasFx;
  }

  public calculatePulse(elapsedMs: number, frequencyHz = 1.2): number {
    const periodMs = 1000 / frequencyHz;
    const phase = (elapsedMs % periodMs) / periodMs;
    // Sinusoidal wave between 0.25 (min dim) and 1.0 (max bright)
    return 0.25 + 0.75 * ((Math.sin(phase * 2 * Math.PI - Math.PI / 2) + 1) / 2);
  }

  public getPulseFrame(elapsedMs: number, reasoningLevel: 'low' | 'medium' | 'high' | 'deep' = 'high'): PulseVisualFrame {
    const intensity = this.calculatePulse(elapsedMs, reasoningLevel === 'deep' ? 1.8 : 1.2);

    const baseColor = reasoningLevel === 'deep'
      ? ZavorthTerminalCanvasFX.COLOR_PURPLE
      : reasoningLevel === 'high'
      ? ZavorthTerminalCanvasFX.COLOR_CYAN
      : ZavorthTerminalCanvasFX.COLOR_EMERALD;

    const targetColor = reasoningLevel === 'deep'
      ? ZavorthTerminalCanvasFX.COLOR_AMBER
      : ZavorthTerminalCanvasFX.COLOR_PURPLE;

    const blendedColor = this.canvasFx.lerpColor(baseColor, targetColor, intensity);
    const ansiColor = this.canvasFx.toAnsiRgbForeground(blendedColor);

    const sparkleIdx = Math.floor((elapsedMs / 180) % TerminalReasoningPulseService.BRAILLE_SPARKLES.length);
    const glyph = TerminalReasoningPulseService.BRAILLE_SPARKLES[sparkleIdx];

    const ambientString = `${ansiColor}${glyph} Thinking... (${Math.round(intensity * 100)}% pulse)\x1b[0m`;

    return {
      intensity,
      color: blendedColor,
      ansiColor,
      glyph,
      ambientString,
    };
  }

  public generateStarryBanner(width = 60, frameTick = 0): string {
    const chars: string[] = [];
    const seed = frameTick * 13;

    for (let i = 0; i < width; i++) {
      const pseudoRand = (seed + i * 37) % 100;
      if (pseudoRand < 3) {
        chars.push('✦');
      } else if (pseudoRand < 7) {
        chars.push('✧');
      } else if (pseudoRand < 12) {
        chars.push('·');
      } else {
        chars.push(' ');
      }
    }

    return `\x1b[2m\x1b[36m${chars.join('')}\x1b[0m`;
  }
}
