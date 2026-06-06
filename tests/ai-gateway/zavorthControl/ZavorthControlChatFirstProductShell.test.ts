import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const controlDir = join(process.cwd(), 'src/ai-gateway/app/(zavorthControl)/control');
const componentDir = join(controlDir, 'zavorth-control/components');

function readComponent(name: string): string {
  return readFileSync(join(componentDir, name), 'utf8');
}

describe('ZavorthControl chat-first product shell', () => {
  it('keeps the first dashboard surface as the agent chat instead of an intrusive home board', () => {
    const shell = readComponent('ZavorthControlControlShell.tsx');

    expect(shell).toContain('ZavorthControlChatSurface');
    expect(shell).toContain('ZavorthControlContextRail');
    const chatBranch = shell.slice(shell.indexOf('case "chat"'));
    expect(chatBranch.indexOf('<ZavorthControlChatSurface')).toBeGreaterThan(-1);
    expect(chatBranch.indexOf('<ZavorthControlContextRail')).toBeGreaterThan(chatBranch.indexOf('<ZavorthControlChatSurface'));

    for (const intrusiveBlock of [
      '<ZavorthControlMissionBrief',
      '<ZavorthControlOnboardingPanel',
      '<ZavorthControlStateCard',
      '<ZavorthControlOverviewSectorView',
    ]) {
      expect(shell).not.toContain(intrusiveBlock);
    }
  });

  it('keeps setup, memory, skills and receipts in a discrete contextual rail', () => {
    const railPath = join(componentDir, 'ZavorthControlContextRail.tsx');

    expect(existsSync(railPath)).toBe(true);

    const rail = readFileSync(railPath, 'utf8');

    for (const marker of [
      'ZavorthControlTaskTimeline',
      'ZavorthControlMemoryCenter',
      'ZavorthControlSkillCatalog',
      'ZavorthControlSetupGuides',
      'projection-only',
      'Editar',
      'Esquecer',
      'Nunca aprender isso',
      'Testar skill',
      'Promover',
      'Abrir configuracao',
      'Live verified',
      'Built-in verified',
    ]) {
      expect(rail).toContain(marker);
    }

    expect(rail).not.toContain('fetch(');
    expect(rail).not.toMatch(/falta conectar/i);
  });

  it('moves heavy workspaces into explicit sectors instead of rendering them on first chat load', () => {
    const shell = readComponent('ZavorthControlControlShell.tsx');

    expect(shell).toContain('renderZavorthControlFocusedSector');
    expect(shell).toContain('activeSectorId === "chat"');
    expect(shell).toContain('case "workspace"');
    expect(shell).toContain('case "gateway"');
    expect(shell).toContain('case "memory"');
    expect(shell).toContain('case "skills"');
    expect(shell).toContain('case "config"');
    expect(shell).toContain('<ZavorthControlDeveloperWorkspace model={model} />');
    expect(shell).toContain('<ZavorthControlGatewayConsole model={model} />');
    expect(shell).not.toContain('<ZavorthControlDeveloperWorkspace model={model} />\n      <ZavorthControlGatewayConsole model={model} />');
  });

  it('offers quiet sector navigation without replacing the chat landing surface', () => {
    const shell = readComponent('ZavorthControlControlShell.tsx');

    expect(shell).toContain('onSelectSector');
    expect(shell).toContain('aria-pressed={activeSectorId === sector.id}');
    for (const label of ['Chat', 'Memoria', 'Skills', 'Setup', 'Workspace', 'Gateway']) {
      expect(shell).toContain(label);
    }
    expect(shell).toContain('activeSectorId={activeSectorId}');
    expect(shell).toContain('onSelectSector={handleSelectSector}');
  });

  it('uses a natural empty chat greeting and compact run controls without nagging setup banners', () => {
    const chat = readComponent('ZavorthControlChatSurface.tsx');

    expect(chat).toContain('ZavorthControlEmptyChatGreeting');
    expect(chat).toContain('data-active-run-state');
    expect(chat).toContain('In progress');
    expect(chat).toContain('Stop');
    expect(chat).toContain('Queue');
    expect(chat).toContain('View receipt');
    expect(chat).not.toMatch(/falta conectar/i);
    expect(chat).not.toMatch(/provider mesh|policy broker|transaction plane/i);
  });
});
