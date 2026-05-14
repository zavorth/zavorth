import {
  ToolGroupCatalog,
} from '../../../src/runtime/agent/index.js';

describe('ToolGroupCatalog', () => {
  it('lists Echo Hands as a governed local-control capability', () => {
    const catalog = new ToolGroupCatalog();

    expect(catalog.get('echo_hands')).toEqual(expect.objectContaining({
      id: 'echo_hands',
      group: 'local_control',
      risk: 'danger',
      requiresApproval: true,
      policyTags: expect.arrayContaining([
        'capability:echo',
        'group:local_control',
        'approval-required',
      ]),
    }));
    expect(catalog.listByGroup('local_control').map((entry) => entry.id)).toContain('echo_hands');
  });

  it('lists Watch Mode as approval-gated local visual control', () => {
    const catalog = new ToolGroupCatalog();

    expect(catalog.get('watchmode.control')).toEqual(expect.objectContaining({
      id: 'watchmode.control',
      group: 'local_control',
      risk: 'danger',
      requiresApproval: true,
      policyTags: expect.arrayContaining([
        'capability:watch-mode',
        'capability:computer-use',
        'approval-required',
        'policy-allowlist-required',
        'visual-action',
      ]),
    }));
    expect(catalog.listByGroup('local_control').map((entry) => entry.id)).toContain('watchmode.control');
  });
});
