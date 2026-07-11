import chalk from 'chalk';

export const TerminalTheme = {
  colors: {
    primary: chalk.hex('#00e88f'),        // product brand green
    primaryLight: chalk.hex('#34ffb4'),   // brand bright
    primaryDark: chalk.hex('#00b46e'),    // brand deep
    secondary: chalk.hex('#6B7280'),      // gray-500
    success: chalk.hex('#10B981'),        // unchanged
    error: chalk.hex('#EF4444'),          // unchanged
    warning: chalk.hex('#F59E0B'),        // amber-500
    info: chalk.hex('#06B6D4'),           // info cyan
    dim: chalk.dim,
    muted: chalk.hex('#6B7280'),          // darker gray
    highlight: chalk.bgHex('#00e88f').black,
  },
  symbols: {
    check: '✓',
    cross: '✗',
    info: '→',
    warning: '⚠',
    arrow: '→',
    dot: '•',
  },
  format: {
    bold: chalk.bold,
    italic: chalk.italic,
    underline: chalk.underline,
    strikethrough: chalk.strikethrough,
  },
};
