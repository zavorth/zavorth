import { ZavorthComputerUseTool } from '../../src/tools/ZavorthComputerUseTool';

describe('ZavorthComputerUseTool', () => {
  const tool = new ZavorthComputerUseTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_computer_use');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'fly_to_moon' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });

  it('returns error for click without coordinates', async () => {
    const result = await tool.execute({ action: 'click' });
    expect(result).toContain('Error');
    expect(result).toContain('x');
  });

  it('returns error for type without text', async () => {
    const result = await tool.execute({ action: 'type' });
    expect(result).toContain('Error');
    expect(result).toContain('text');
  });

  it('returns error for press_key without key', async () => {
    const result = await tool.execute({ action: 'press_key' });
    expect(result).toContain('Error');
    expect(result).toContain('key');
  });

  it('blocks dangerous key combinations', async () => {
    const result = await tool.execute({ action: 'press_key', key: 'ctrl+alt+delete' });
    expect(result).toContain('Error');
    expect(result).toContain('aprovacao');
  });

  it('blocks alt+f4', async () => {
    const result = await tool.execute({ action: 'press_key', key: 'alt+f4' });
    expect(result).toContain('Error');
  });

  it('handles drag without full coordinates', async () => {
    const result = await tool.execute({ action: 'drag', x: 100, y: 100 });
    expect(result).toContain('Error');
    expect(result).toContain('x2');
  });

  it('handles scroll with direction', async () => {
    const result = await tool.execute({ action: 'scroll', direction: 'down', amount: 5 });
    expect(result).toBeTruthy();
  });

  it('handles wait with valid duration', async () => {
    const result = await tool.execute({ action: 'wait', wait_ms: 500 });
    expect(result).toContain('500ms');
  });

  it('rejects wait over 30 seconds', async () => {
    const result = await tool.execute({ action: 'wait', wait_ms: 60000 });
    expect(result).toContain('Error');
  });

  it('returns error for find_on_screen without text', async () => {
    const result = await tool.execute({ action: 'find_on_screen' });
    expect(result).toContain('Error');
    expect(result).toContain('text');
  });

  it('returns error for move_mouse without coordinates', async () => {
    const result = await tool.execute({ action: 'move_mouse' });
    expect(result).toContain('Error');
  });
});
