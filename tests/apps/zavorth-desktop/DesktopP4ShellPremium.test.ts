import fs from 'node:fs';
import path from 'node:path';
import {
  RIGHT_RAIL_TABS,
  buildDevServerCandidates,
  buildGitRailSummary,
  clampRightRailWidth,
  readStoredRightRailState,
  resolvePersistentTerminalSessionId,
  writeStoredRightRailState,
} from '../../../apps/zavorth-desktop/src/shell/rightRail';
import {
  buildCommandCenterItems,
  filterCommandCenterItems,
} from '../../../apps/zavorth-desktop/src/command-center/commandCenter';
import { buildSettingsModules } from '../../../apps/zavorth-desktop/src/settings/settingsModules';


function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    snapshot: () => Object.fromEntries(data.entries()),
  };
}

describe('Desktop P4 premium daily shell contract', () => {
  it('defines the complete right rail surface with stable sizing and persistence', () => {
    expect(RIGHT_RAIL_TABS.map(tab => tab.id)).toEqual([
      'activity',
      'preview',
      'files',
      'terminal',
      'logs',
      'git',
    ]);
    expect(clampRightRailWidth(100)).toBe(320);
    expect(clampRightRailWidth(900)).toBe(720);
    expect(clampRightRailWidth(421.8)).toBe(422);

    const storage = fakeStorage();
    writeStoredRightRailState({ open: true, tab: 'terminal', width: 900 }, storage);
    expect(readStoredRightRailState(storage)).toEqual({ open: true, tab: 'terminal', width: 720 });
  });

  it('persists terminal sessions by workspace without using the floating legacy launcher', () => {
    const storage = fakeStorage();
    const first = resolvePersistentTerminalSessionId('local workspace', storage);
    const second = resolvePersistentTerminalSessionId('local workspace', storage);
    expect(first).toBe('local-workspace-local');
    expect(second).toBe(first);

    const terminalSource = readSource('apps/zavorth-desktop/src/shell/PtyTerminalPanel.tsx');
    expect(terminalSource).toContain("mode?: 'rail' | 'dock'");
    expect(terminalSource).toContain('resolvePersistentTerminalSessionId');
    expect(terminalSource).not.toContain('fixed bottom-0');
    expect(terminalSource).toContain('Search terminal');
    expect(terminalSource).toContain('Copy output');
  });

  it('detects dev server candidates and summarizes git state for the rail', () => {
    const candidates = buildDevServerCandidates({
      devServerUrl: 'localhost:4321',
      workspace: { devServers: [{ port: 5174 }] },
    } as any, { id: 'ws', label: 'Local', shortLabel: 'Local', path: 'C:/repo' } as any);
    expect(candidates.map(candidate => candidate.url)).toEqual(expect.arrayContaining([
      'http://localhost:4321',
      'http://localhost:5174',
      'http://localhost:5173',
      'http://localhost:3000',
    ]));

    expect(buildGitRailSummary(
      { id: 'ws', label: 'Project', shortLabel: 'Proj', path: 'C:/repo' } as any,
      { git: { branch: 'main', status: '2 changed files', dirty: true } } as any,
    )).toMatchObject({
      workspaceLabel: 'Proj',
      branch: 'main',
      status: '2 changed files',
      dirty: true,
    });
  });

  it('wires the rail into DesktopShell, statusbar, preview, terminal and styles', () => {
    const shellSource = readSource('apps/zavorth-desktop/src/shell/DesktopShell.tsx');
    const railSource = readSource('apps/zavorth-desktop/src/shell/DesktopRightRail.tsx');
    const statusbarSource = readSource('apps/zavorth-desktop/src/navigation/DesktopStatusbar.tsx');
    const previewSource = readSource('apps/zavorth-desktop/src/views/WebPreviewView.tsx');
    const stylesSource = readSource('apps/zavorth-desktop/src/styles/right-rail.css');
    const mainSource = readSource('apps/zavorth-desktop/src/main.tsx');

    expect(shellSource).toContain('DesktopRightRail');
    expect(shellSource).toContain('rightRailOpen');
    expect(railSource).toContain('PtyTerminalPanel');
    expect(shellSource).toContain("onRail={openRightRail}");
    expect(shellSource).not.toContain('<PtyTerminalPanel workspaceId={props.workspaceScope.id} />');
    expect(statusbarSource).toContain('onOpenRail');
    expect(previewSource).toContain("mode?: 'page' | 'rail'");
    expect(previewSource).toContain('Dev server candidates');
    expect(stylesSource).toContain('.zvd-right-rail');
    expect(stylesSource).toContain('resize-handle');
    expect(mainSource).toContain("'./styles/right-rail.css'");
  });

  it('adds real Command Center actions for workspace, terminal, preview, git, themes, runtime and recovery', () => {
    const settingsGroups = buildSettingsModules({ runtimeRunning: false, providerCount: 1 });
    const items = buildCommandCenterItems({
      settingsGroups,
      providerCount: 1,
      runtimeRunning: false,
      workspaceLabel: 'Local',
      rightRailOpen: false,
      rightRailTab: 'activity',
    });
    const ids = items.map(item => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      'workspace:files',
      'terminal:open-rail',
      'preview:open-rail',
      'git:open-rail',
      'themes:studio',
      'runtime:start',
      'recovery:open',
    ]));
    expect(filterCommandCenterItems(items, 'terminal').map(item => item.id)).toContain('terminal:open-rail');
    expect(filterCommandCenterItems(items, 'recovery').map(item => item.id)).toContain('recovery:open');
  });
});
