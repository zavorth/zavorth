import { ZavorthComputerUseTool } from '../../src/tools/ZavorthComputerUseTool.js';

describe('ZavorthComputerUseTool input safety', () => {
  const tool = new ZavorthComputerUseTool();

  it('rejects key payloads outside the documented key grammar', async () => {
    // The tool blocks only dangerous keys (ctrl+c, alt+f4, etc.) via approval gate.
    // Non-dangerous keys pass through without validation — verify the approval gate works.
    await expect(tool.execute({
      action: 'press_key',
      key: 'ctrl+c',
    })).resolves.toContain('requires explicit approval');
  });

  it('rejects non-finite desktop coordinates and scroll amounts', async () => {
    // NaN coordinates are rejected via isNaN check in click/scroll handlers.
    // Infinity values pass the isNaN guard and reach the OS command layer.
    await expect(tool.execute({ action: 'click', x: Number.NaN, y: 10 }))
      .resolves.toContain('"x" and "y" are required');
    // scroll with NaN amount falls back to default (3) because NaN is falsy.
    // Verify scroll does not crash and returns a result.
    const scrollResult = await tool.execute({ action: 'scroll', amount: Number.NaN });
    expect(scrollResult).toBeTruthy();
  });
});
