import {
  createZavorthPremiumCliTheme,
  paintPremiumAccent,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';

const ANSI_RESET = '\u001b[0m';

function gradientText(text: string): string {
  const colors = [
    '\u001b[38;2;255;111;31m',
    '\u001b[38;2;255;132;48m',
    '\u001b[38;2;255;154;77m',
    '\u001b[38;2;255;190;108m',
  ];

  let result = '';
  let colorIndex = 0;
  const coloredLength = Math.max(1, text.replace(/\s/g, '').length - 1);
  for (const char of text) {
    if (char === ' ') {
      result += char;
      continue;
    }
    const color = colors[Math.floor((colorIndex / coloredLength) * (colors.length - 1))] || colors[colors.length - 1];
    result += `${color}${char}${ANSI_RESET}`;
    colorIndex += 1;
  }
  return result;
}

export function renderPremiumBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (isAsciiOnly) {
    return [
      paintPremiumAccent('  ZAVORTH', 'amber', theme),
      '',
      paintPremiumAccent(`  ${theme.tagline}`, 'muted', theme),
      paintPremiumAccent(`  ${theme.subtagline}`, 'muted', theme),
    ].join('\n');
  }

  const title = theme.colorEnabled
    ? `  \u001b[1m${gradientText('Z A V O R T H')}${ANSI_RESET}`
    : '  Z A V O R T H';

  const divider = theme.colorEnabled
    ? `  \u001b[38;2;60;60;70m────────────────────────────────────────${ANSI_RESET}`
    : '  ────────────────────────────────────────';

  return [
    title,
    divider,
    `  \u001b[38;2;125;133;151mNatural language in. Governed action out.${ANSI_RESET}`,
    `  \u001b[38;2;90;100;115mLocal-first agent OS with receipts, approvals and native integrations.${ANSI_RESET}`,
    '',
  ].join('\n');
}

export function renderPremiumCompactBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (theme.colorEnabled && !isAsciiOnly) {
    return `\u001b[1m${gradientText('ZAVORTH')}${ANSI_RESET} \u001b[2m(v1.1.0)${ANSI_RESET}  \u001b[2m·  Local-first governed agent OS${ANSI_RESET}`;
  }

  return 'ZAVORTH (v1.1.0)  ·  Local-first governed agent OS';
}
