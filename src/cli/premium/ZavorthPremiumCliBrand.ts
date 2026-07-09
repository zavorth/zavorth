import {
  createZavorthPremiumCliTheme,
  paintPremiumAccent,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';

const ANSI_RESET = '\u001b[0m';

function gradientText(text: string): string {
  const colors = [
    '\u001b[38;2;255;191;105m',  // #FFBF69
    '\u001b[38;2;255;122;24m',   // #FF7A18
    '\u001b[38;2;230;100;20m',   // #E66414
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
      paintPremiumAccent('  ZAVORTH', 'orange', theme),
      '',
      paintPremiumAccent(`  ${theme.tagline}`, 'muted', theme),
    ].join('\n');
  }

  const title = theme.colorEnabled
    ? `  \u001b[1m${gradientText('Z A V O R T H')}${ANSI_RESET}`
    : '  Z A V O R T H';

  const divider = theme.colorEnabled
    ? `  \u001b[38;2;255;122;24m${'─'.repeat(40)}${ANSI_RESET}`
    : '  ' + '─'.repeat(40);

  return [
    title,
    divider,
    `  \u001b[38;2;107;114;128m${theme.tagline}${ANSI_RESET}`,
    `  \u001b[38;2;75;85;99m${theme.subtagline}${ANSI_RESET}`,
    '',
  ].join('\n');
}

export function renderPremiumCompactBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (theme.colorEnabled && !isAsciiOnly) {
    return `\u001b[1m${gradientText('ZAVORTH')}${ANSI_RESET} \u001b[2m(v1.1.0)${ANSI_RESET}  Local-first governed agent OS`;
  }

  return 'ZAVORTH (v1.1.0)  Local-first governed agent OS';
}
