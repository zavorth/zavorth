import { sliceUtf16Safe, truncateSlackText } from '../../src/utils/text';

describe('Text Utilities — UTF-16 and Slack Truncation', () => {
  it('sliceUtf16Safe slices simple strings correctly', () => {
    expect(sliceUtf16Safe('hello world', 0, 5)).toBe('hello');
    expect(sliceUtf16Safe('hello world', 6)).toBe('world');
  });

  it('sliceUtf16Safe does not split surrogate pairs', () => {
    // 😊 is \ud83d\ude0a
    const str = 'hello 😊 world'; // 😊 starts at index 6 (length 2)

    // Normal slice inside the emoji: from 0 to 7.
    // The low surrogate is at index 7. Since we sliced up to 7, the high surrogate is included but low is excluded.
    // sliceUtf16Safe should adjust the end index to 6 to drop the emoji completely.
    expect(sliceUtf16Safe(str, 0, 7)).toBe('hello ');

    // Normal slice starting inside the emoji: from 7 to end.
    // The low surrogate is at index 7. sliceUtf16Safe should adjust the start index to 8 (skipping the low surrogate).
    expect(sliceUtf16Safe(str, 7)).toBe(' world');
  });

  it('truncateSlackText truncates text properly', () => {
    expect(truncateSlackText('hello world', 20)).toBe('hello world');
    expect(truncateSlackText('  hello world  ', 20)).toBe('hello world');
    expect(truncateSlackText('hello world', 8)).toBe('hello w…'); // 7 chars + 1 ellipsis = 8 chars
  });

  it('truncateSlackText does not leave dangling surrogate there islves at the boundary', () => {
    const str = 'hello 😊 world'; // length 14, emoji is at 6 and 7
    // If we limit to 8 chars: 'hello ' (6) + emoji (2) = 8.
    // truncateSlackText uses max ? 1 = 7.
    // At index 7 we are inside the surrogate pair.
    // sliceUtf16Safe(str, 0, 7) adjusts end to 6, returning 'hello '.
    // Then we append '…' (length 1), resulting in 'hello …' (length 7).
    expect(truncateSlackText(str, 8)).toBe('hello …');
  });
});
