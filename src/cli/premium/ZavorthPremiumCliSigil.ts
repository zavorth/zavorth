/**
 * Zavorth premium CLI sigil and block banner.
 *
 * The block banner uses solid █ characters against empty space (terminal
 * background) for maximum contrast.  Every letter is exactly 6 columns
 * wide, separated by 3-space gaps.  Total width: 60 columns.
 *
 * Letter map:  Z(6)  A(6)  V(6)  O(6)  R(6)  T(6)  H(6)
 */

export const ZAVORTH_BLOCK_BANNER = [
  ' \u001b[38;2;255;122;24m▄▄   ▄▄  ▄▄▄▄  ▄▄   ▄▄ ▄▄▄▄  ▄▄▄▄ \u001b[0m',
  ' \u001b[38;2;255;122;24m█▀█  █▀█ █  █▀█ █▀█  █▀█ █  █▀█ \u001b[0m',
  ' \u001b[38;2;107;114;128m█▀▀█ █▀▀▄ █  █ ▄ █  █▄▀ █  █▄▄▄ \u001b[0m',
];

/** Backward-compatible alias — now points to the block banner. */
export const ZAVORTH_BLOCK_WORDMARK = ZAVORTH_BLOCK_BANNER;

/** @deprecated Mascot removed in the premium redesign. */
export const ZAVORTH_MASCOT: string[] = [];

/** @deprecated Mascot removed in the premium redesign. */
export const ZAVORTH_ASCII_MASCOT: string[] = [];

// Legacy empty exports so old imports compile
export const ZAVORTH_VORTEX_SIGIL: string[] = [];
export const ZAVORTH_EVENT_HORIZON_SIGIL: string[] = [];

export const ZAVORTH_ASCII_SIGIL = [
  ' .──────────────────────────────────────────. ',
  ' │  Z A V O R T H   E V E N T   H O R I Z O N  │ ',
  ' `──────────────────────────────────────────` ',
];

export const ZAVORTH_COMPACT_SIGIL = [
  '\u001b[38;2;255;122;24m◇\u001b[0m ZAVORTH \u001b[38;2;255;122;24m◇\u001b[0m',
  'Event-horizon agent zavorthControl',
];

export const ZAVORTH_WORDMARK = [
  ' ZZZZZ   A   V   V  OOO  RRRR  TTTTT H   H',
  '    Z   A A  V   V O   O R   R   T   H   H',
  '   Z   AAAAA  V V  O   O RRRR    T   HHHHH',
  '  Z    A   A  V V  O   O R  R    T   H   H',
  ' ZZZZZ A   A   V    OOO  R   R   T   H   H',
];
