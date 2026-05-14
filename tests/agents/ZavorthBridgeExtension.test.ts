jest.mock('vscode', () => ({}), { virtual: true });

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildCapabilitySnapshot,
  getPendingHandoffInfo,
  resolveBridgeScopedPath,
  selectPendingSession,
  validateCommandArgs,
} = require('../../zavorth-bridge-extension/extension.js');

describe('Zavorth Bridge extension', () => {
  it('recognizes modern ZavorthBridge command ids in the capability snapshot', () => {
    const capabilities = buildCapabilitySnapshot([
      'zavorthBridge.prioritized.agentAcceptFocusedHunk',
      'zavorthBridge.prioritized.agentRejectFocusedHunk',
      'zavorthBridge.openConversationWorkspaceQuickPick',
      'zavorthBridge.startNewConversation',
      'zavorthBridge.sendPromptToAgentPanel',
      'zavorthBridge.openAgent',
      'workbench.action.closeAllEditors',
    ]);

    expect(capabilities).toMatchObject({
      canAcceptStep: true,
      canRejectStep: true,
      canOpenConversationPicker: true,
      canCloseAllEditors: true,
      canStartNewConversation: true,
      canResetSession: true,
      canSendAgentPrompt: true,
      canOpenAgentPanel: true,
    });
  });

  it('selects the requested pending handoff by taskId instead of the lexicographically last file', () => {
    const selected = selectPendingSession(
      [
        {
          taskId: 'surface-send-check-2',
          handoffFile: 'surface.md',
          launchedAt: '2026-03-25T05:05:00.000Z',
          launchedAtMs: Date.parse('2026-03-25T05:05:00.000Z'),
          completedAt: null,
          fileMtimeMs: 10,
        },
        {
          taskId: 'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
          handoffFile: 'target.md',
          launchedAt: '2026-03-25T04:58:31.995Z',
          launchedAtMs: Date.parse('2026-03-25T04:58:31.995Z'),
          completedAt: null,
          fileMtimeMs: 5,
        },
      ],
      'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
    );

    expect(selected).toMatchObject({
      taskId: 'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
      handoffFile: 'target.md',
    });
  });

  it('reports only active pending handoffs in status snapshots', async () => {
    const pendingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-pending-'));

    try {
      const staleCompleted = {
        taskId: 'surface-send-check-2',
        handoffFile: 'surface.md',
        launchedAt: '2026-03-25T05:05:00.000Z',
        completedAt: '2026-03-25T05:06:00.000Z',
      };
      const activeOlder = {
        taskId: 'de89a8ff-c54a-4e3f-82ae-0dfa4c17551a',
        handoffFile: 'target.md',
        launchedAt: '2026-03-25T04:58:31.995Z',
        completedAt: null,
      };
      const activeNewer = {
        taskId: 'active-fresh-task',
        handoffFile: 'fresh.md',
        launchedAt: '2026-03-25T05:07:00.000Z',
        completedAt: null,
      };

      fs.writeFileSync(path.join(pendingDir, 'zzz_surface.json'), JSON.stringify(staleCompleted), 'utf8');
      fs.writeFileSync(path.join(pendingDir, 'aaa_target.json'), JSON.stringify(activeOlder), 'utf8');
      fs.writeFileSync(path.join(pendingDir, 'bbb_fresh.json'), JSON.stringify(activeNewer), 'utf8');

      const info = await getPendingHandoffInfo({ pendingDir });

      expect(info).toEqual({
        count: 2,
        latestPendingHandoff: 'fresh.md',
      });
    } finally {
      fs.rmSync(pendingDir, { recursive: true, force: true });
    }
  });

  it('confines handoff paths to the configured bridge root', () => {
    const bridgeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-root-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-outside-'));

    try {
      const bridge = {
        bridgeRoot,
        pendingDir: path.join(bridgeRoot, 'pending'),
      };
      fs.mkdirSync(bridge.pendingDir, { recursive: true });

      expect(resolveBridgeScopedPath(bridge, 'handoff.md')).toBe(path.join(bridge.pendingDir, 'handoff.md'));
      expect(resolveBridgeScopedPath(bridge, path.join(bridgeRoot, 'handoff.md'))).toBe(path.join(bridgeRoot, 'handoff.md'));
      expect(resolveBridgeScopedPath(bridge, path.join(outsideRoot, 'secret.md'))).toBeNull();
      expect(resolveBridgeScopedPath(bridge, '..\\..\\secret.md')).toBeNull();
    } finally {
      fs.rmSync(bridgeRoot, { recursive: true, force: true });
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('does not advertise arbitrary command execution when no safe command is available', () => {
    const capabilities = buildCapabilitySnapshot(['workbench.action.files.openFile']);

    expect(capabilities.canExecuteCommand).toBe(false);
  });

  it('rejects complex command arguments on the bridge command plane', () => {
    expect(() => validateCommandArgs(['plain', 1, true, null])).not.toThrow();
    expect(() => validateCommandArgs([{ command: 'workbench.action.openSettings' }])).toThrow(
      /primitive values/,
    );
    expect(() => validateCommandArgs(new Array(9).fill('arg'))).toThrow(/short array/);
  });
});
