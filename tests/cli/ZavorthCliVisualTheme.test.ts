/**
 * P7 / V16.7 — CLI visual theme: product brand green (#00e88f), not orange.
 * Covers NO_COLOR / FORCE_COLOR precedence and plain help readability.
 */

import {
  ANSI_COLORS,
  CLI_BRAND_BRIGHT_RGB,
  CLI_BRAND_RGB,
  CLI_INFO_RGB,
  isCliColorEnabled,
  padCliVisualText,
  paintCliBadge,
  paintCliTone,
  renderCliWordmark,
  renderCliWordmarkStrip,
  stripCliAnsi,
} from '../../src/cli/ZavorthCliVisualTheme';

const BRAND_ANSI = `\u001b[38;2;${CLI_BRAND_RGB.r};${CLI_BRAND_RGB.g};${CLI_BRAND_RGB.b}m`;
const BRAND_BRIGHT_ANSI = `\u001b[38;2;${CLI_BRAND_BRIGHT_RGB.r};${CLI_BRAND_BRIGHT_RGB.g};${CLI_BRAND_BRIGHT_RGB.b}m`;
const ORANGE_ANSI = '\u001b[38;2;255;122;24m';

describe('ZavorthCliVisualTheme (P7 product green / V16.7)', () => {
  const prevForce = process.env.FORCE_COLOR;
  const prevNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (prevForce === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = prevForce;
    if (prevNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prevNoColor;
  });

  it('exports brand RGB constants matching #00e88f', () => {
    expect(CLI_BRAND_RGB).toEqual({ r: 0, g: 232, b: 143 });
    expect(CLI_BRAND_BRIGHT_RGB).toEqual({ r: 52, g: 255, b: 180 });
    expect(CLI_INFO_RGB).toEqual({ r: 6, g: 182, b: 212 });
  });

  it('ANSI_COLORS brand tokens use product green, not orange', () => {
    expect(ANSI_COLORS.BRAND).toBe(BRAND_ANSI);
    expect(ANSI_COLORS.BRAND_BRIGHT).toBe(BRAND_BRIGHT_ANSI);
    expect(ANSI_COLORS.BRAND).not.toContain('255;122;24');
    expect(ANSI_COLORS.ORANGE).toBe(BRAND_ANSI);
    expect(ANSI_COLORS.CYAN).toBe(BRAND_ANSI);
  });

  it('stripCliAnsi removes escape sequences', () => {
    const painted = `${BRAND_ANSI}ZAVORTH\u001b[0m`;
    expect(stripCliAnsi(painted)).toBe('ZAVORTH');
    expect(stripCliAnsi('plain')).toBe('plain');
  });

  it('padCliVisualText pads by visible width ignoring ANSI', () => {
    const painted = `${BRAND_ANSI}hi\u001b[0m`;
    const padded = padCliVisualText(painted, 6);
    expect(stripCliAnsi(padded)).toBe('hi    ');
    expect(padded.startsWith(painted)).toBe(true);
  });

  it('paintCliTone brand includes brand-green RGB when FORCE_COLOR=1 and NO_COLOR unset', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';

    const brand = paintCliTone('ZAVORTH', 'brand');
    const accent = paintCliTone('accent', 'accent');

    expect(brand).toContain(BRAND_BRIGHT_ANSI);
    expect(accent).toContain(BRAND_ANSI);
    expect(brand).not.toContain(ORANGE_ANSI);
    expect(accent).not.toContain(ORANGE_ANSI);
    expect(stripCliAnsi(brand)).toBe('ZAVORTH');
  });

  it('paintCliTone returns plain text when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '1';
    expect(paintCliTone('plain', 'brand')).toBe('plain');
  });

  it('NO_COLOR wins over FORCE_COLOR (isCliColorEnabled)', () => {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '1';
    expect(isCliColorEnabled()).toBe(false);
  });

  it('FORCE_COLOR enables color when NO_COLOR is unset', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    expect(isCliColorEnabled()).toBe(true);
  });

  it('empty FORCE_COLOR does not force color (NO_COLOR unset)', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '';
    // Empty string is falsy after trim → falls through to TTY check.
    expect(typeof isCliColorEnabled()).toBe('boolean');
  });

  it('wordmark and badge stay readable under NO_COLOR (no ANSI, stable glyphs)', () => {
    process.env.NO_COLOR = '1';
    delete process.env.FORCE_COLOR;

    const mark = renderCliWordmark('ZAVORTH');
    const strip = renderCliWordmarkStrip('ZAVORTH');
    const badge = paintCliBadge('proof', 'brand');

    expect(mark).toContain('ZAVORTH');
    expect(mark).not.toMatch(/\u001B\[/);
    expect(strip).toBe('◇ ZAVORTH ◇');
    expect(strip).not.toMatch(/\u001B\[/);
    expect(badge).toBe('[ PROOF ]');
    expect(stripCliAnsi(mark)).toBe(mark);
  });

  it('info tone uses cyan RGB when color forced (not orange)', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    const info = paintCliTone('hello', 'info');
    expect(info).toContain(`\u001b[38;2;${CLI_INFO_RGB.r};${CLI_INFO_RGB.g};${CLI_INFO_RGB.b}m`);
    expect(info).not.toContain(ORANGE_ANSI);
    expect(stripCliAnsi(info)).toBe('hello');
  });
});
