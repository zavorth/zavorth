import {
  createZavorthPremiumCliTheme,
  paintPremiumAccent,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';

const ANSI_RESET = '\u001b[0m';

/**
 * Creates a sleek gradient for the minimalist "ZAVORTH" brand text.
 * Transitions smoothly from purple/violet -> rose -> warm orange.
 */
function gradientText(text: string): string {
  // Precomputed ANSI colors for a premium purple-to-orange gradient
  const colors = [
    '\u001b[38;2;192;132;252m', // #c084fc
    '\u001b[38;2;217;70;239m',  // #d946ef
    '\u001b[38;2;244;63;94m',   // #f43f5e
    '\u001b[38;2;255;122;24m',  // #ff7a18
    '\u001b[38;2;251;191;36m',  // #fbbf24
  ];

  let result = '';
  // Apply a color from the gradient to each character, skipping spaces
  let colorIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      result += char;
    } else {
      const color = colors[Math.floor((colorIndex / (text.length - 1)) * (colors.length - 1))] || colors[colors.length - 1];
      result += `${color}${char}${ANSI_RESET}`;
      colorIndex++;
    }
  }
  return result;
}

/* ── Public API ───────────────────────────────────────────── */

export function renderPremiumBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (isAsciiOnly) {
    return [
      paintPremiumAccent('  ⟡ ZAVORTH', 'amber', theme),
      '',
      paintPremiumAccent(`  ${theme.tagline}`, 'muted', theme),
      paintPremiumAccent(`  ${theme.subtagline}`, 'muted', theme),
    ].join('\n');
  }

  // Minimalist Premium Style
  // Wide-tracked typography, subtle gradient, no heavy ASCII blocks.
  const title = theme.colorEnabled
    ? `  \u001b[1m${gradientText('Z A V O R T H')}${ANSI_RESET}`
    : `  Z A V O R T H`;

  const divider = theme.colorEnabled
    ? `  \u001b[38;2;60;60;70m────────────────────────────────────────${ANSI_RESET}`
    : `  ────────────────────────────────────────`;

  return [
    title,
    divider,
    `  \u001b[38;2;125;133;151mNatural language in. Governed action out.${ANSI_RESET}`,
    `  \u001b[38;2;90;100;115mLocal-first agent OS with receipts, approvals, and native integrations.${ANSI_RESET}`,
    ''
  ].join('\n');
}

export function renderPremiumCompactBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (theme.colorEnabled && !isAsciiOnly) {
    return [
      `\u001b[1m${gradientText('ZAVORTH')}${ANSI_RESET} \u001b[2m(v1.1.0)${ANSI_RESET}  \u001b[2m·  Local-first governed agent OS${ANSI_RESET}`,
    ].join('\n');
  }

  return 'ZAVORTH (v1.1.0)  ·  Local-first governed agent OS';
}
