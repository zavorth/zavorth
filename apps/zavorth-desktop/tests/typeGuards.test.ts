import { describe, expect, it } from 'vitest';
import {
  asBoolean,
  asString,
  isRecord,
  parseAccent,
  parseEffort,
  parseThemeMode,
} from '../src/lib/typeGuards';

describe('typeGuards', () => {
  it('parses theme modes with fallback', () => {
    expect(parseThemeMode('dark')).toBe('dark');
    expect(parseThemeMode('nope')).toBe('system');
  });

  it('parses effort with fallback', () => {
    expect(parseEffort('high')).toBe('high');
    expect(parseEffort('crazy')).toBe('medium');
  });

  it('parses accents against allow-list', () => {
    expect(parseAccent('purple', ['green', 'orange', 'purple', 'navy'] as const, 'green')).toBe('purple');
    expect(parseAccent('pink', ['green', 'orange', 'purple', 'navy'] as const, 'green')).toBe('green');
  });

  it('narrows records and primitives', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(asString(12)).toBe('12');
    expect(asString(undefined, 'x')).toBe('x');
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean('yes')).toBe(false);
  });
});
