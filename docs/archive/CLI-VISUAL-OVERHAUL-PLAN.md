> Archived from public docs tree on 2026-07-11. Historical program notes — not current user documentation.
>
> **P7 completed (2026-07-11):** residual orange brand ANSI replaced with **product brand green** `#00e88f` (website/desktop), not orange. Cyan remains optional for informational accents (`#06B6D4`). This plan is archived history — brand primary is product green.

# Zavorth CLI Visual Overhaul Plan

## Goal

Replace the warm-orange aesthetic with a modern, minimalistic, MiMo Code-inspired system. Cyan primary, gray accents, block-character logo, simplified rendering.

---

## New Color Palette

| Role | Old Value | New Value | Where Used |
|------|-----------|-----------|------------|
| Brand primary | `#FF6F1F` (orange ANSI) | `#06B6D4` (cyan-500) | Core paintCliTone brand, premium neural accent |
| Brand bold | `#FF6F1F` bold | `#22D3EE` (cyan-400) | Bold brand text |
| Amber accent | `#FF954F` (orange soft ANSI) | `#F59E0B` (chalk.yellow) | Warnings only |
| Muted | `#9CA3AF` | `#6B7280` (gray-500) | Dim text, secondary labels |
| Success | `#10B981` | `#10B981` (no change) | Ready/success states |
| Error | `#EF4444` | `#EF4444` (no change) | Danger/blocked states |
| Info | `#3B82F6` | `#06B6D4` (unified cyan) | Merged with brand |
| Gradient | 4-step orange ramp | 3-step cyan ramp | Brand header rendering |

New ANSI constants to define:

```ts
const ZAVORTH_CYAN = '\u001b[38;2;6;182;212m';       // #06B6D4
const ZAVORTH_CYAN_BRIGHT = '\u001b[38;2;34;211;238m'; // #22D3EE
const ANSI_RESET = '\u001b[0m';
```

---

## New ASCII Art Logo

Replace `ZAVORTH_BLOCK_BANNER` with a dual-tone half-block design. Top half uses `▀` in cyan, bottom half in gray, creating a modern dense look.

```ts
export const ZAVORTH_BLOCK_BANNER = [
  ' \u001b[38;2;6;182;212m▄▄   ▄▄  ▄▄▄▄  ▄▄   ▄▄ ▄▄▄▄  ▄▄▄▄ \u001b[0m',
  ' \u001b[38;2;6;182;212m█▀█  █▀█ █  █▀█ █▀█  █▀█ █  █▀█ \u001b[0m',
  ' \u001b[38;2;107;114;128m█▀▀█ █▀▀▄ █  █ ▄ █  █▄▀ █  █▄▄▄ \u001b[0m',
];
```

Also update `ZAVORTH_ASCII_SIGIL` with a cleaner box:

```ts
export const ZAVORTH_ASCII_SIGIL = [
  ' .──────────────────────────────────────────. ',
  ' │  Z A V O R T H   E V E N T   H O R I Z O N  │ ',
  ' `──────────────────────────────────────────` ',
];
```

And `ZAVORTH_COMPACT_SIGIL`:

```ts
export const ZAVORTH_COMPACT_SIGIL = [
  '\u001b[38;2;6;182;212m◇\u001b[0m ZAVORTH \u001b[38;2;6;182;212m◇\u001b[0m',
  'Event-horizon agent dashboard',
];
```

---

## File-by-File Changes

### 1. `src/cli/ZavorthCliVisualTheme.ts`

**Changes:**
- Replace `ZAVORTH_ORANGE` constant with `ZAVORTH_CYAN` and `ZAVORTH_CYAN_BRIGHT`
- In `paintCliTone()`: change `'brand'` case to use cyan instead of orange
- In `paintCliTone()`: change `'info'` case to use same cyan (unified)
- Add new tone `'accent'` that maps to cyan-bright for emphasis
- Update `renderCliWordmark()` to use cyan divider line

**Specific edits:**

```ts
// OLD line 13:
const ZAVORTH_ORANGE = '\u001b[38;2;255;111;31m';
// NEW:
const ZAVORTH_CYAN = '\u001b[38;2;6;182;212m';
const ZAVORTH_CYAN_BRIGHT = '\u001b[38;2;34;211;238m';

// OLD line 45 (brand case):
return color.bold(`${ZAVORTH_ORANGE}${value}${ANSI_RESET}`);
// NEW:
return color.bold(`${ZAVORTH_CYAN_BRIGHT}${value}${ANSI_RESET}`);

// OLD line 49 (info case):
return color.cyan(value);
// NEW:
return color.cyan(value); // already correct, keep
```

### 2. `src/cli/ZavorthCliVisualSystem.ts`

**Changes:**
- Simplify `renderBox()` to use single-line `│` borders instead of round corners
- Reduce padding from 1 space to no padding inside boxes
- Change `renderHeroHeader()` to use block-character logo + cyan title
- Simplify `renderCliPanel()` — remove mode branching, always use compact style
- Add subtle cyan tint to panel titles

**Key change in `renderBox()`:**

```ts
// OLD: rounded corners
const top = `╭${paintCliTone(titleText, tone)}...`;
const body = lines.map(line => `│ ${padCliVisualText(line, inner)} │`);
const bottom = `╰${'─'.repeat(width - 2)}╯`;

// NEW: minimal single-line style
const top = `── ${paintCliTone(titleText, 'info')} ${'─'.repeat(Math.max(0, width - titleText.length - 5))}`;
const body = lines.map(line => `  ${padCliVisualText(line, inner)}`);
const bottom = `${'─'.repeat(width)}`;
```

**Key change in `renderHeroHeader()`:**

```ts
// OLD:
return renderBox('Zavorth CLI', lines, 'brand', 'hero');

// NEW: use block banner inline
const banner = ZAVORTH_BLOCK_BANNER.join('\n');
return [banner, '', paintCliTone(commandLine, 'muted')].join('\n');
```

### 3. `src/cli/ZavorthCliMascot.ts`

**Replace entirely.** New mascot uses the block-character logo concept:

```ts
import { paintCliTone } from './ZavorthCliVisualTheme.js';

export const ZAVORTH_CLI_BRAND_NAME = 'Zavorth';

export const ZAVORTH_CLI_FOX_MASCOT = [
  '\u2584\u2584   \u2584\u2584  \u2584\u2584\u2584\u2584  \u2584\u2584   \u2584\u2584 \u2584\u2584\u2584\u2584  \u2584\u2584\u2584\u2584',
  '\u2588\u2580\u2588  \u2588\u2580\u2588 \u2588  \u2588\u2580\u2588 \u2588\u2580\u2588  \u2588\u2580\u2588 \u2588  \u2588\u2580\u2588',
  '     ',
  'Local-first governed agent OS',
] as const;

export const ZAVORTH_CLI_MASCOT_WIDTH = 38;

export function formatZavorthMascotLine(
  mascotLine: string,
  content: string,
): string {
  void mascotLine;
  return content;
}

export function formatZavorthMascotBlock(contentLines: [string, string, string, string]): string[] {
  return contentLines.map((line, index) =>
    index === 0 ? paintCliTone(line || ZAVORTH_CLI_BRAND_NAME, 'brand') : line);
}
```

### 4. `src/cli/premium/ZavorthPremiumCliSigil.ts`

**Replace all ASCII art constants.** Keep deprecated empty arrays for backward compat. New constants:

- `ZAVORTH_BLOCK_BANNER` — new dual-tone half-block logo (see above)
- `ZAVORTH_BLOCK_WORDMARK` — alias to banner
- `ZAVORTH_ASCII_SIGIL` — clean double-line box
- `ZAVORTH_COMPACT_SIGIL` — diamond markers with cyan
- `ZAVORTH_WORDMARK` — keep existing but simplify to plain text

### 5. `src/cli/premium/ZavorthPremiumCliTheme.ts`

**Changes:**
- Replace `ZAVORTH_ORANGE` and `ZAVORTH_ORANGE_SOFT` with cyan constants
- Change `paintPremiumAccent()` cases:
  - `'neural'` → use cyan bright (was orange)
  - `'amber'` → use `chalk.yellow` (pure yellow, not orange)
  - `'cyan'` → keep as-is
  - `'violet'` → keep as-is
  - `'emerald'` → keep as-is
  - `'rose'` → keep as-is
  - `'muted'` → use `chalk.hex('#6B7280')` (darker gray)
- Update symbol map: use modern Unicode symbols
  ```ts
  symbols: {
    pass: '✓',
    warn: '⚠',
    fail: '✗',
    wait: '◌',
    arrow: '→',
    bullet: '•',
    rail: '│',
  }
  ```

### 6. `src/cli/premium/ZavorthPremiumCliBrand.ts`

**Changes:**
- Replace `gradientText()` to use cyan gradient: `#22D3EE → #06B6D4 → #0891B2`
- Change divider color from dark gray to cyan-dim
- Update tagline/subtagline colors to muted gray
- In `renderPremiumBrand()`:
  - Add block banner rendering before the gradient title
  - Reduce decorative elements — cleaner layout
- In `renderPremiumCompactBrand()`:
  - Use cyan for brand name, gray for version
  - Remove the dot separator, use space only

**New `renderPremiumBrand()`:**

```ts
export function renderPremiumBrand(
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const isAsciiOnly = process.env.ZAVORTH_ASCII_LOGO === '1';

  if (isAsciiOnly) {
    return [
      paintPremiumAccent('  ZAVORTH', 'cyan', theme),
      '',
      paintPremiumAccent(`  ${theme.tagline}`, 'muted', theme),
    ].join('\n');
  }

  const title = theme.colorEnabled
    ? `  \u001b[1m${gradientText('Z A V O R T H')}${ANSI_RESET}`
    : '  Z A V O R T H';

  const divider = theme.colorEnabled
    ? `  \u001b[38;2;6;182;212m${'─'.repeat(40)}${ANSI_RESET}`
    : '  ' + '─'.repeat(40);

  return [
    title,
    divider,
    `  \u001b[38;2;107;114;128m${theme.tagline}${ANSI_RESET}`,
    `  \u001b[38;2;75;85;99m${theme.subtagline}${ANSI_RESET}`,
    '',
  ].join('\n');
}
```

**New `gradientText()`:**

```ts
function gradientText(text: string): string {
  const colors = [
    '\u001b[38;2;34;211;238m',   // #22D3EE
    '\u001b[38;2;6;182;212m',    // #06B6D4
    '\u001b[38;2;8;145;178m',    // #0891B2
  ];
  let result = '';
  let colorIndex = 0;
  const coloredLength = Math.max(1, text.replace(/\s/g, '').length - 1);
  for (const char of text) {
    if (char === ' ') { result += char; continue; }
    const color = colors[Math.floor((colorIndex / coloredLength) * (colors.length - 1))] || colors[colors.length - 1];
    result += `${color}${char}${ANSI_RESET}`;
    colorIndex += 1;
  }
  return result;
}
```

### 7. `src/cli/presentation/TerminalTheme.ts`

**Replace entire color map:**

```ts
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
```

### 8. `src/cli/presentation/TerminalPanel.ts`

**Changes:**
- Switch from `round` to `single` border style for cleaner look
- Update default border color from `'gray'` to `'cyan'`
- Change title color to use `primaryLight` (bright cyan)
- Add top-line separator before title instead of inline title

**Key changes:**

```ts
// OLD:
const boxenOptions: BoxenOptions = {
  padding,
  margin,
  borderColor,
  borderStyle: 'round',
  title: title ? titleColor(...) : undefined,
  titleAlignment: 'left',
  width,
};

// NEW:
const boxenOptions: BoxenOptions = {
  padding: Math.max(0, (padding || 1) - 1),  // reduce padding
  margin,
  borderColor,
  borderStyle: 'single',
  title: title ? titleColor(format.bold(` ${title} `)) : undefined,
  titleAlignment: 'left',
  width,
};
```

---

## Implementation Order

1. **Palette first** — Update `ZavorthCliVisualTheme.ts` (foundation layer)
2. **Premium theme** — Update `ZavorthPremiumCliTheme.ts` (depends on #1)
3. **Logo/Sigil** — Update `ZavorthPremiumCliSigil.ts` (independent)
4. **Brand renderer** — Update `ZavorthPremiumCliBrand.ts` (depends on #2, #3)
5. **Mascot** — Update `ZavorthCliMascot.ts` (depends on #1)
6. **Screen renderer** — Update `ZavorthCliVisualSystem.ts` (depends on #1, #3)
7. **Terminal theme** — Update `TerminalTheme.ts` (independent)
8. **Terminal panels** — Update `TerminalPanel.ts` (depends on #7)

---

## Verification Steps

1. Run `npx tsc --noEmit` to verify no type errors
2. Run any existing CLI commands: `node dist/cli/index.js --help`
3. Check visual output in terminal for:
   - Cyan brand color on "ZAVORTH" text
   - New block-character logo renders correctly
   - Panel borders use single-line style
   - Status symbols show Unicode characters
   - Gradient header uses cyan tones
4. Test with `ZAVORTH_ASCII_LOGO=1` for ASCII fallback
5. Test with `NO_COLOR=1` for no-color mode
6. Verify all imports resolve (no broken references)

---

## Risk Assessment

- **Low risk**: All changes are visual-only, no logic changes
- **Backward compat**: Empty deprecated exports in sigil file preserved
- **Dependencies**: No new npm packages needed (picocolors, chalk, boxen unchanged)
- **Breakage risk**: Only if downstream code hardcodes orange ANSI values — grep for `255;111;31` to verify
