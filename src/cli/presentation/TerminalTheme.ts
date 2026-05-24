import chalk from 'chalk';

export const TerminalTheme = {
  colors: {
    primary: chalk.hex('#f59e0b'),
    primaryLight: chalk.hex('#fcd34d'),
    primaryDark: chalk.hex('#b45309'),
    secondary: chalk.hex('#06b6d4'),
    success: chalk.hex('#10b981'),
    error: chalk.hex('#ef4444'),
    warning: chalk.hex('#f59e0b'),
    info: chalk.hex('#3b82f6'),
    dim: chalk.dim,
    muted: chalk.hex('#9ca3af'),
    highlight: chalk.bgHex('#f59e0b').black,
  },
  symbols: {
    check: 'OK',
    cross: 'ERR',
    info: 'INFO',
    warning: 'WARN',
    arrow: '>',
    dot: '*',
  },
  format: {
    bold: chalk.bold,
    italic: chalk.italic,
    underline: chalk.underline,
    strikethrough: chalk.strikethrough,
  },
};
