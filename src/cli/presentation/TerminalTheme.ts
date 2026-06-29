import chalk from 'chalk';

export const TerminalTheme = {
  colors: {
    primary: chalk.hex('#06B6D4'),        // cyan-500
    primaryLight: chalk.hex('#22D3EE'),   // cyan-400
    primaryDark: chalk.hex('#0891B2'),    // cyan-600
    secondary: chalk.hex('#6B7280'),      // gray-500
    success: chalk.hex('#10B981'),        // unchanged
    error: chalk.hex('#EF4444'),          // unchanged
    warning: chalk.hex('#F59E0B'),        // amber-500
    info: chalk.hex('#06B6D4'),           // unified with primary
    dim: chalk.dim,
    muted: chalk.hex('#6B7280'),          // darker gray
    highlight: chalk.bgHex('#06B6D4').black,
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
