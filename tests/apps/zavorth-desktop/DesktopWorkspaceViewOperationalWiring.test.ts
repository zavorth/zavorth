import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('DesktopWorkspaceView operational cockpit wiring', () => {
  it('exposes first-class runtime bus actions for cockpit panels', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/views/DesktopWorkspaceView.tsx'),
      'utf8',
    );

    for (const actionType of [
      'set-provider-connection',
      'select-model-spec',
      'set-workspace-knowledge',
      'register-personal-connector',
      'resume-stream',
      'skill-lifecycle',
    ]) {
      expect(source).toContain(`runtimeActionType: '${actionType}'`);
    }

    expect(source).toContain("providers?.configurable");
    expect(source).toContain('workspaceKnowledge');
    expect(source).toContain('ragSources');
    expect(source).toContain("value: 'workspace'");
    expect(source).toContain('personalConnector');
    expect(source).toContain('connector.operations');
    expect(source).toContain('Every personal operation requires approval');
    expect(source).toContain('streamSession');
  });
});
