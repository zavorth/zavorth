import {
  appendSubagentTask,
  completeSubagentTask,
  createSubagent,
  defaultSubagents,
  deleteSubagent,
  loadSubagents,
  persistSubagents,
} from '../../../apps/zavorth-desktop/src/desktop-state/subagents';
import {
  classifyRuntimeRecovery,
  shouldRefreshRuntimeForEvent,
} from '../../../apps/zavorth-desktop/src/desktop-state/runtimeRecovery';
import { riskLabel } from '../../../apps/zavorth-desktop/src/desktop-state/desktopLabels';
/** @jest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  addCustomProfile,
  createCustomProfile,
  deleteCustomProfile,
  defaultProfiles,
  loadCustomProfiles,
  persistCustomProfiles,
} from '../../../apps/zavorth-desktop/src/desktop-state/agentProfiles';



import { DesktopRecoveryBoundary } from '../../../apps/zavorth-desktop/src/components/DesktopRecoveryBoundary';
import { RiskBadge } from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function BrokenPanel() {
  throw new Error('Renderer failed');
}

describe('Desktop P3 foundation architecture', () => {
  it('keeps custom agent profile storage deterministic and outside the main app hook', () => {
    const storage = new MemoryStorage();
    const profile = createCustomProfile({
      name: 'Reviewer',
      systemPrompt: 'Review changes carefully.',
      effort: 'high',
      costLimit: 12,
    }, () => 'profile_fixed');

    const profiles = addCustomProfile([], profile);
    persistCustomProfiles(profiles, storage);

    expect(defaultProfiles.map(item => item.id)).toEqual([
      'personal',
      'creator',
      'developer',
      'business',
      'power',
    ]);
    expect(loadCustomProfiles(storage)).toEqual([profile]);
    expect(deleteCustomProfile(profiles, 'profile_fixed')).toEqual([]);
    expect(loadCustomProfiles({ getItem: () => '{broken', setItem: jest.fn(), removeItem: jest.fn() })).toEqual([]);
  });

  it('keeps subagent state transitions pure and testable', () => {
    const now = () => '2026-06-30T12:00:00.000Z';
    const storage = new MemoryStorage();
    const agent = createSubagent('QA Reviewer', 'auditor', () => 'agent_fixed', now);

    const started = appendSubagentTask([agent], 'agent_fixed', 'Check the desktop shell.', now);
    const completed = completeSubagentTask(started, 'agent_fixed', 'Check the desktop shell.', now);

    expect(defaultSubagents(() => 0)).toHaveLength(3);
    expect(started[0]).toMatchObject({
      status: 'running',
      assignedTask: 'Check the desktop shell.',
    });
    expect(started[0].identity).toMatchObject({
      identiconSeed: 'agent_fixed:auditor',
      motionState: 'running',
      motion: {
        active: true,
        className: 'zvd-motion-audit-border',
      },
    });
    expect(completed[0]).toMatchObject({ status: 'completed' });
    expect(completed[0].identity.motion.active).toBe(false);
    expect(completed[0].messages.at(-1)?.text).toContain('Execution complete');

    persistSubagents(completed, storage);
    expect(loadSubagents(storage, () => 0)).toEqual(completed);
    expect(deleteSubagent(completed, 'agent_fixed')).toEqual([]);
  });

  it('classifies runtime recovery and reconnect triggers without renderer side effects', () => {
    expect(classifyRuntimeRecovery({
      bridgeReady: false,
      status: { running: false, message: 'Bridge missing', runtimePid: null },
      notice: '',
    })).toMatchObject({
      visible: true,
      reason: 'bridge-unavailable',
      title: 'Desktop bridge indisponivel',
    });

    expect(classifyRuntimeRecovery({
      bridgeReady: true,
      status: { running: false, message: 'Runtime offline', runtimePid: null },
      notice: 'Could not reach the local runtime.',
    })).toMatchObject({
      visible: true,
      reason: 'runtime-unreachable',
    });

    expect(classifyRuntimeRecovery({
      bridgeReady: true,
      status: { running: true, message: 'Runtime ready', runtimePid: 123 },
      notice: '',
    }).visible).toBe(false);

    expect(shouldRefreshRuntimeForEvent({ type: 'online', online: true, visibilityState: 'visible' })).toBe(true);
    expect(shouldRefreshRuntimeForEvent({ type: 'visibilitychange', online: true, visibilityState: 'hidden' })).toBe(false);
    expect(shouldRefreshRuntimeForEvent({ type: 'focus', online: false, visibilityState: 'visible' })).toBe(false);
  });

  it('renders a desktop recovery boundary with retry and diagnostics actions', () => {
    const onRecover = jest.fn();
    const onDiagnostics = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <DesktopRecoveryBoundary onRecover={onRecover} onOpenDiagnostics={onDiagnostics}>
        <BrokenPanel />
      </DesktopRecoveryBoundary>,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('A interface encontrou um problema');

    fireEvent.click(screen.getByRole('button', { name: 'Reabrir interface' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir diagnosticos' }));

    expect(onRecover).toHaveBeenCalledTimes(1);
    expect(onDiagnostics).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('keeps shared desktop labels free from mojibake sequences', () => {
    const labels = [
      riskLabel('LOW'),
      riskLabel('MEDIUM'),
      riskLabel('HIGH'),
      riskLabel('CRITICAL'),
    ].join(' ');

    expect(labels).toContain('Risco medio');
    expect(labels).toContain('Risco critico');
    expect(labels).not.toMatch(/Ã|Â|�/);

    render(<RiskBadge level="MEDIUM" />);
    expect(screen.getByText('Risco medio')).toBeInTheDocument();
    expect(screen.getByText('Medium risk').textContent).not.toMatch(/Ã|Â|�/);
  });

  it('delegates foundation domains out of the main desktop app hook', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/useDesktopAppState.ts'),
      'utf8',
    );

    expect(source).toContain("from './desktop-state/agentProfiles'");
    expect(source).toContain("from './desktop-state/subagents'");
    expect(source).toContain("from './desktop-state/useDesktopAutomations'");
    expect(source).toContain("from './desktop-state/useKaelController'");
    expect(source).toContain("from './desktop-state/useRuntimeRecoveryRefresh'");
    expect(source).not.toContain('const defaultProfiles: AgentProfile[]');
    expect(source.split(/\r?\n/).length).toBeLessThan(1125);
  });

  it('wraps the desktop app with a renderer recovery boundary and runtime recovery surface', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/App.tsx'),
      'utf8',
    );

    expect(source).toContain('DesktopRecoveryBoundary');
    expect(source).toContain('classifyRuntimeRecovery');
    expect(source).toContain('runtimeRecovery.visible');
    expect(source).toContain("setSettingsTab('diagnostics')");
  });

  it('keeps premium state surface CSS in a focused stylesheet module', () => {
    const main = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/main.tsx'),
      'utf8',
    );
    const rootStyles = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/styles.css'),
      'utf8',
    );
    const stateStyles = readFileSync(
      join(process.cwd(), 'apps/zavorth-desktop/src/styles/state-surfaces.css'),
      'utf8',
    );

    expect(main).toContain("import './styles/state-surfaces.css'");
    expect(rootStyles).not.toContain('.zvd-recovery-overlay');
    expect(stateStyles).toContain('.zvd-recovery-overlay');
    expect(stateStyles).toContain('.zvd-premium-empty-state');
  });
});
