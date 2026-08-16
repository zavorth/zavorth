import pc from 'picocolors';

const ZAVORTH_BRAND = '\u001b[38;2;0;232;143m';
const ZAVORTH_BRAND_BRIGHT = '\u001b[38;2;52;255;180m';
const ZAVORTH_INFO = '\u001b[38;2;6;182;212m';
const ZAVORTH_WARNING = '\u001b[38;2;245;158;11m';
const ZAVORTH_SUCCESS = '\u001b[38;2;16;185;129m';
const ZAVORTH_ERROR = '\u001b[38;2;239;68;68m';
const ZAVORTH_HIGHLIGHT = '\u001b[48;2;0;232;143m\u001b[30m';
const ANSI_RESET = '\u001b[0m';

export const TerminalTheme = {
  colors: {
    primary: (text: string) => `${ZAVORTH_BRAND}${text}${ANSI_RESET}`,
    primaryLight: (text: string) => `${ZAVORTH_BRAND_BRIGHT}${text}${ANSI_RESET}`,
    primaryDark: (text: string) => `${ZAVORTH_BRAND}${text}${ANSI_RESET}`,
    secondary: (text: string) => pc.gray(text),
    success: (text: string) => `${ZAVORTH_SUCCESS}${text}${ANSI_RESET}`,
    error: (text: string) => `${ZAVORTH_ERROR}${text}${ANSI_RESET}`,
    warning: (text: string) => `${ZAVORTH_WARNING}${text}${ANSI_RESET}`,
    info: (text: string) => `${ZAVORTH_INFO}${text}${ANSI_RESET}`,
    dim: (text: string) => pc.dim(text),
    muted: (text: string) => pc.gray(text),
    highlight: (text: string) => `${ZAVORTH_HIGHLIGHT}${text}${ANSI_RESET}`,
    bold: (text: string) => pc.bold(text),
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
    bold: (text: string) => pc.bold(text),
    italic: (text: string) => pc.italic(text),
    underline: (text: string) => pc.underline(text),
    strikethrough: (text: string) => pc.strikethrough(text),
  },
};
