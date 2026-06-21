import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const desktopRoot = join(process.cwd(), 'apps/zavorth-desktop');
const cockpitFiles = [
  'src/views/DesktopWorkspaceView.tsx',
  'src/views/panels/SettingsPanel.tsx',
  'src/views/panels/AutomationsPanel.tsx',
  'src/views/panels/PersonalizationPanel.tsx',
  'src/views/panels/SkillsPanel.tsx',
];

function readCockpitSource(): string {
  return cockpitFiles
    .map(file => readFileSync(join(desktopRoot, file), 'utf8'))
    .join('\n');
}

describe('Zavorth desktop product-ready cockpit', () => {
  it('exposes final product controls for providers, personal ops, workspace RAG, MCP, jobs and release readiness', () => {
    const source = readCockpitSource();

    for (const text of [
      'Add provider',
      'Test readiness',
      'List models',
      'Choose fallback',
      'Preview read',
      'Create draft',
      'Send requires approval',
      'Index workspace',
      'Trust source',
      'MCP exposure gate',
      'Release readiness',
      'Open diagnostics',
    ]) {
      expect(source).toContain(text);
    }
  });
});
