import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { DesktopAutomationTool } from '../../src/tools/DesktopAutomationTool';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

describe('DesktopAutomationTool security filter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('blocks automation against shell and console windows before invoking PowerShell', async () => {
    const result = await new DesktopAutomationTool().execute({
      action: 'focus-window',
      windowTitle: 'Windows PowerShell',
    });

    expect(result).toContain('Automacao de desktop bloqueada');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('blocks launcher shortcuts that could bypass command policy', async () => {
    const result = await new DesktopAutomationTool().execute({
      action: 'press-key',
      windowTitle: 'Notepad',
      payload: 'Win+R',
    });

    expect(result).toContain('atalho de launcher/shell nao permitido');
    expect(execFile).not.toHaveBeenCalled();
  });
});

