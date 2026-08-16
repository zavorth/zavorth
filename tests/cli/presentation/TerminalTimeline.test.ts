import { describe, it, expect } from '@jest/globals';
import { TerminalTimeline } from '../../../src/cli/presentation/TerminalTimeline.js';

describe('TerminalTimeline & Live Event Presentation', () => {
  it('should render timeline items correctly with markers', () => {
    const output = TerminalTimeline.render([
      { title: 'Init session', status: 'success' },
      { title: 'Executing task', status: 'running' },
    ]);

    expect(output).toContain('Init session');
    expect(output).toContain('Executing task');
  });

  it('should render tool execution event lines with duration', () => {
    const toolLine = TerminalTimeline.renderToolEvent('run_command', 'git status', 34, 'success');
    expect(toolLine).toContain('Tool: run_command');
    expect(toolLine).toContain('(34ms)');
  });

  it('should render thinking event lines', () => {
    const thinkingLine = TerminalTimeline.renderThinkingEvent('Analyzing project architecture', 120);
    expect(thinkingLine).toContain('Thinking:');
    expect(thinkingLine).toContain('Analyzing project architecture');
    expect(thinkingLine).toContain('(120ms)');
  });

  it('should render diff summary lines with additions and deletions', () => {
    const diffLine = TerminalTimeline.renderDiffSummary('src/core/config.ts', 12, 4);
    expect(diffLine).toContain('File:');
    expect(diffLine).toContain('src/core/config.ts');
    expect(diffLine).toContain('+12');
    expect(diffLine).toContain('-4');
  });
});
