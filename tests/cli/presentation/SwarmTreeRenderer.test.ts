import { describe, it, expect } from '@jest/globals';
import { SwarmTreeRenderer } from '../../../src/cli/presentation/SwarmTreeRenderer.js';
import { stripCliAnsi } from '../../../src/cli/ZavorthCliVisualTheme.js';

describe('SwarmTreeRenderer', () => {
  it('should render hierarchical tree of swarm specialists', () => {
    const tree = SwarmTreeRenderer.renderTree([
      {
        id: 'arch_1',
        scientist: 'Euler',
        role: 'System Architect',
        status: 'completed',
        currentAction: 'Decomposed tasks',
        durationMs: 120,
        children: [
          {
            id: 'code_1',
            scientist: 'Turing',
            role: 'Implementation Engineer',
            status: 'running',
            currentAction: 'Refactoring ProviderFactory.ts',
          },
          {
            id: 'qa_1',
            scientist: 'Curie',
            role: 'QA Auditor',
            status: 'queued',
            currentAction: 'Awaiting coder',
          },
        ],
      },
    ]);

    const clean = stripCliAnsi(tree);
    expect(clean).toContain('Live Swarm Topology & Thought Tree');
    expect(clean).toContain('Euler · System Architect');
    expect(clean).toContain('Turing · Implementation Engineer');
    expect(clean).toContain('Curie · QA Auditor');
  });
});
