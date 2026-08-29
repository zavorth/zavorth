import { BitmapTextRenderer } from '../../../../src/services/llm/compression/BitmapTextRenderer';

describe('BitmapTextRenderer', () => {
  let renderer: BitmapTextRenderer;

  beforeEach(() => {
    renderer = new BitmapTextRenderer();
  });

  it('renders text as valid PNG with correct dimensions', async () => {
    const result = await renderer.renderPng('Hello', 80);
    expect(result.pngBase64).toBeTruthy();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.charColumns).toBe(5);
    expect(result.charRows).toBe(1);

    const buffer = Buffer.from(result.pngBase64, 'base64');
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4E);
    expect(buffer[3]).toBe(0x47);
  });

  it('wraps long lines at maxColumns', async () => {
    const longText = 'A'.repeat(100);
    const result = await renderer.renderPng(longText, 20);
    expect(result.charColumns).toBe(20);
    expect(result.charRows).toBe(5);
  });

  it('handles empty text', async () => {
    const result = await renderer.renderPng('', 80);
    expect(result.pngBase64).toBeTruthy();
    expect(result.charRows).toBe(1);
  });

  it('handles multiline text', async () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = await renderer.renderPng(text, 80);
    expect(result.charRows).toBe(3);
  });
});
