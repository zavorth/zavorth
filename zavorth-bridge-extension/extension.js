const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const BRIDGE_VERSION = '0.0.10';
const BRIDGE_COMMANDS = [
  'accept-step',
  'reject-step',
  'open-conversation-picker',
  'open-handoff',
  'close-all-editors',
  'start-new-conversation',
  'open-quick-settings',
  'reset-session',
  'sync-pending-handoffs',
  'send-agent-prompt',
  'execute-command',
  'get-status',
];

let heartbeatHandle = null;
let requestWatcherHandle = null;
let requestPollHandle = null;
let processingRequests = false;
const bridgeState = {
  instanceId: randomUUID(),
  lastOpenedHandoff: null,
  lastSyncedHandoff: null,
  lastRequest: null,
};

const ACCEPT_STEP_COMMANDS = [
  'zavorthBridge.agent.acceptAgentStep',
  'zavorthBridge.prioritized.agentAcceptFocusedHunk',
  'zavorthBridge.prioritized.agentAcceptAllInFile',
];

const REJECT_STEP_COMMANDS = [
  'zavorthBridge.agent.rejectAgentStep',
  'zavorthBridge.prioritized.agentRejectFocusedHunk',
  'zavorthBridge.prioritized.agentRejectAllInFile',
];

const OPEN_CONVERSATION_PICKER_COMMANDS = [
  'zavorthBridge.openConversationPicker',
  'zavorthBridge.openConversationWorkspaceQuickPick',
];

const CLOSE_ALL_EDITORS_COMMANDS = ['workbench.action.closeAllEditors'];
const START_NEW_CONVERSATION_COMMANDS = ['zavorthBridge.startNewConversation'];
const OPEN_QUICK_SETTINGS_COMMANDS = ['zavorthBridge.openQuickSettingsPanel'];
const SEND_AGENT_PROMPT_COMMANDS = ['zavorthBridge.sendPromptToAgentPanel'];
const OPEN_AGENT_PANEL_COMMANDS = ['zavorthBridge.openAgent'];
const SAFE_EXECUTE_COMMANDS = new Set([
  ...ACCEPT_STEP_COMMANDS,
  ...REJECT_STEP_COMMANDS,
  ...OPEN_CONVERSATION_PICKER_COMMANDS,
  ...CLOSE_ALL_EDITORS_COMMANDS,
  ...START_NEW_CONVERSATION_COMMANDS,
  ...OPEN_QUICK_SETTINGS_COMMANDS,
  ...SEND_AGENT_PROMPT_COMMANDS,
  ...OPEN_AGENT_PANEL_COMMANDS,
]);

function activate(context) {
  const bridge = createBridgeContext();

  ensureBridgeDirectories(bridge);
  writeStatusSnapshot(bridge).catch(() => {});
  processPendingRequests(bridge).catch(() => {});

  const heartbeatInterval = getHeartbeatInterval();
  heartbeatHandle = setInterval(() => {
    writeStatusSnapshot(bridge).catch(() => {});
  }, heartbeatInterval);

  requestWatcherHandle = fs.watch(bridge.requestDir, () => {
    processPendingRequests(bridge).catch(() => {});
  });

  requestPollHandle = setInterval(() => {
    processPendingRequests(bridge).catch(() => {});
  }, 2000);

  context.subscriptions.push(
    new vscode.Disposable(() => {
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
      }
      if (requestWatcherHandle) {
        requestWatcherHandle.close();
      }
      if (requestPollHandle) {
        clearInterval(requestPollHandle);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.acceptVisibleStep', async () => {
      await runFirstAvailableCommand(ACCEPT_STEP_COMMANDS);
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.rejectVisibleStep', async () => {
      await runFirstAvailableCommand(REJECT_STEP_COMMANDS);
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.openConversationPicker', async () => {
      await runFirstAvailableCommand(OPEN_CONVERSATION_PICKER_COMMANDS);
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.closeAllEditors', async () => {
      await closeAllEditors();
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.startNewConversation', async () => {
      await startNewConversation();
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.openQuickSettings', async () => {
      await openQuickSettings();
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.resetSession', async () => {
      await resetSession();
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.syncPendingHandoffs', async () => {
      await syncPendingHandoffs(bridge);
      await writeStatusSnapshot(bridge);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zavorthBridge.writeStatusSnapshot', async () => {
      await writeStatusSnapshot(bridge);
    }),
  );

  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    writeStatusSnapshot(bridge).catch(() => {});
  }, null, context.subscriptions);

  vscode.window.onDidChangeActiveTextEditor(() => {
    writeStatusSnapshot(bridge).catch(() => {});
  }, null, context.subscriptions);

  vscode.window.onDidChangeWindowState(() => {
    writeStatusSnapshot(bridge).catch(() => {});
  }, null, context.subscriptions);
}

function deactivate() {
  if (heartbeatHandle) {
    clearInterval(heartbeatHandle);
  }
  if (requestWatcherHandle) {
    requestWatcherHandle.close();
  }
  if (requestPollHandle) {
    clearInterval(requestPollHandle);
  }
}

function createBridgeContext() {
  const resolved = resolveBridgeRoot();
  const bridgeRoot = resolved.bridgeRoot;
  return {
    bridgeRoot,
    bridgeRootMode: resolved.mode,
    requestDir: path.join(bridgeRoot, 'control', 'requests'),
    resultDir: path.join(bridgeRoot, 'control', 'results'),
    runtimeDir: path.join(bridgeRoot, 'runtime'),
    pendingDir: path.join(bridgeRoot, 'pending'),
  };
}

function resolveBridgeRoot() {
  const configured = vscode.workspace.getConfiguration('zavorthBridge').get('bridgeRoot');
  if (configured && String(configured).trim()) {
    return {
      bridgeRoot: path.resolve(String(configured)),
      mode: 'configured',
    };
  }

  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  for (const folder of workspaceFolders) {
    const canonicalRoot = resolveCanonicalCoreRoot(folder.uri.fsPath);
    if (canonicalRoot) {
      return {
        bridgeRoot: path.join(canonicalRoot, 'data', 'agent-bridge', 'zavorth-bridge'),
        mode: 'canonical-core',
      };
    }
  }

  return {
    bridgeRoot: path.join(process.env.SYSTEMDRIVE || 'C:', 'workspace', 'zavorth-core', 'Zavorth', 'data', 'agent-bridge', 'zavorth-bridge'),
    mode: 'fallback-canonical',
  };
}

function resolveCanonicalCoreRoot(workspacePath) {
  const candidates = [
    workspacePath,
    path.join(workspacePath, 'Zavorth'),
    path.join(workspacePath, 'zavorth-core', 'Zavorth'),
    path.join(path.dirname(workspacePath), 'Zavorth'),
    path.join(path.dirname(workspacePath), 'zavorth-core', 'Zavorth'),
  ];

  for (const candidate of candidates) {
    if (isZavorthCoreRoot(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isZavorthCoreRoot(candidate) {
  try {
    return fs.existsSync(path.join(candidate, 'package.json'))
      && fs.existsSync(path.join(candidate, 'src'))
      && fs.existsSync(path.join(candidate, 'zavorth.yml'));
  } catch {
    return false;
  }
}

function ensureBridgeDirectories(bridge) {
  fs.mkdirSync(bridge.requestDir, { recursive: true });
  fs.mkdirSync(bridge.resultDir, { recursive: true });
  fs.mkdirSync(bridge.runtimeDir, { recursive: true });
}

function getHeartbeatInterval() {
  return Number(vscode.workspace.getConfiguration('zavorthBridge').get('heartbeatIntervalMs')) || 5000;
}

async function writeStatusSnapshot(bridge) {
  const activeEditor = vscode.window.activeTextEditor;
  const commandSnapshot = await getAvailableCommandSnapshot();
  const pendingInfo = await getPendingHandoffInfo(bridge);
  const status = {
    ok: true,
    extension: 'zavorthlabs.zavorth-zavorthBridge',
    version: BRIDGE_VERSION,
    extensionSource: __filename,
    updatedAt: new Date().toISOString(),
    windowFocused: vscode.window.state.focused,
    activeEditor: activeEditor ? activeEditor.document.uri.fsPath : null,
    workspaceFolders: (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
    hostname: os.hostname(),
    instanceId: bridgeState.instanceId,
    processId: process.pid,
    bridgeRoot: bridge.bridgeRoot,
    bridgeRootMode: bridge.bridgeRootMode,
    bridgeCommands: BRIDGE_COMMANDS,
    availableCommands: commandSnapshot,
    capabilities: buildCapabilitySnapshot(commandSnapshot),
    pendingHandoffs: pendingInfo.count,
    latestPendingHandoff: pendingInfo.latestPendingHandoff,
    lastOpenedHandoff: bridgeState.lastOpenedHandoff,
    lastSyncedHandoff: bridgeState.lastSyncedHandoff,
    lastRequest: bridgeState.lastRequest,
  };

  const statusPath = path.join(bridge.runtimeDir, 'bridge-status.json');
  await fs.promises.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf8');
}

async function processPendingRequests(bridge) {
  if (processingRequests) {
    return;
  }

  processingRequests = true;
  try {
    const files = await fs.promises.readdir(bridge.requestDir);
    const pending = files.filter((file) => file.endsWith('.json')).sort();

    for (const file of pending) {
      const requestPath = path.join(bridge.requestDir, file);
      const resultPath = path.join(bridge.resultDir, file);

      if (fs.existsSync(resultPath)) {
        continue;
      }

      let request;
      try {
        request = JSON.parse(await fs.promises.readFile(requestPath, 'utf8'));
      } catch (error) {
        await writeResult(resultPath, {
          ok: false,
          command: 'get-status',
          requestId: file.replace(/\.json$/i, ''),
          completedAt: new Date().toISOString(),
          error: `Malformed request: ${error.message}`,
        });
        continue;
      }

      if (request?.targetInstanceId && request.targetInstanceId !== bridgeState.instanceId) {
        continue;
      }

      const result = await handleRequest(bridge, request);
      await writeResult(resultPath, result);
    }
  } finally {
    processingRequests = false;
  }
}

async function handleRequest(bridge, request) {
  try {
    bridgeState.lastRequest = {
      command: request.command,
      taskId: request.taskId || null,
      createdAt: request.createdAt || new Date().toISOString(),
    };
    const commandSnapshot = await getAvailableCommandSnapshot();
    let commandResult = undefined;

    switch (request.command) {
      case 'accept-step':
        await runFirstAvailableCommand(ACCEPT_STEP_COMMANDS);
        break;
      case 'reject-step':
        await runFirstAvailableCommand(REJECT_STEP_COMMANDS);
        break;
      case 'open-conversation-picker':
        await runFirstAvailableCommand(OPEN_CONVERSATION_PICKER_COMMANDS);
        break;
      case 'open-handoff':
        await openHandoffFile(bridge, request?.payload?.handoffFile);
        break;
      case 'close-all-editors':
        await closeAllEditors();
        break;
      case 'start-new-conversation':
        await startNewConversation();
        break;
      case 'open-quick-settings':
        await openQuickSettings();
        break;
      case 'reset-session':
        await resetSession();
        break;
      case 'sync-pending-handoffs':
        await syncPendingHandoffs(bridge, request.taskId);
        break;
      case 'send-agent-prompt':
        await sendAgentPrompt(request?.payload?.prompt);
        break;
      case 'execute-command':
        commandResult = await executeArbitraryCommand(
          request?.payload?.command,
          Array.isArray(request?.payload?.args) ? request.payload.args : [],
          Boolean(request?.payload?.fireAndForget),
        );
        break;
      case 'get-status':
        break;
      default:
        throw new Error(`Unsupported command: ${request.command}`);
    }

    await writeStatusSnapshot(bridge);
    const pendingInfo = await getPendingHandoffInfo(bridge);

    return {
      ok: true,
      command: request.command,
      requestId: request.id,
      completedAt: new Date().toISOString(),
      data: {
        activeEditor: vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri.fsPath : null,
        availableCommands: commandSnapshot,
        capabilities: buildCapabilitySnapshot(commandSnapshot),
        pendingHandoffs: pendingInfo.count,
        latestPendingHandoff: pendingInfo.latestPendingHandoff,
        lastOpenedHandoff: bridgeState.lastOpenedHandoff,
        lastSyncedHandoff: bridgeState.lastSyncedHandoff,
        instanceId: bridgeState.instanceId,
        commandResult,
      },
    };
  } catch (error) {
    return {
      ok: false,
      command: request.command,
      requestId: request.id,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

async function syncPendingHandoffs(bridge, taskId) {
  const pendingSessions = await readPendingSessions(bridge);
  const actionableSessions = pendingSessions.filter((session) => !session?.completedAt);
  const session = selectPendingSession(actionableSessions, taskId);
  if (!session) {
    return { count: actionableSessions.length, latestPendingHandoff: null };
  }

  if (session?.handoffFile) {
    await openHandoffFile(bridge, session.handoffFile);
    bridgeState.lastSyncedHandoff = session.handoffFile;
  }

  return {
    count: actionableSessions.length,
    latestPendingHandoff: session?.handoffFile || null,
  };
}

async function openHandoffFile(bridge, handoffFile) {
  const safeHandoffFile = resolveBridgeScopedPath(bridge, handoffFile);
  if (!safeHandoffFile || !fs.existsSync(safeHandoffFile)) {
    throw new Error('Handoff file not found.');
  }

  const document = await vscode.workspace.openTextDocument(safeHandoffFile);
  await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
  bridgeState.lastOpenedHandoff = safeHandoffFile;
  return safeHandoffFile;
}

async function sendAgentPrompt(prompt) {
  if (!prompt || !String(prompt).trim()) {
    throw new Error('Prompt is required for send-agent-prompt.');
  }

  const commands = await vscode.commands.getCommands(true);
  const openAgentCommand = findFirstAvailableCommand(commands, OPEN_AGENT_PANEL_COMMANDS);
  if (openAgentCommand) {
    await vscode.commands.executeCommand(openAgentCommand);
  }

  await runFirstAvailableCommand(SEND_AGENT_PROMPT_COMMANDS, String(prompt));
}

async function executeArbitraryCommand(command, args = [], fireAndForget = false) {
  if (!command || !String(command).trim()) {
    throw new Error('Command is required for execute-command.');
  }
  const requestedCommand = String(command).trim();
  if (!SAFE_EXECUTE_COMMANDS.has(requestedCommand)) {
    throw new Error(`Command is not allowed through the Zavorth bridge: ${requestedCommand}`);
  }
  validateCommandArgs(args);

  if (fireAndForget) {
    await dispatchInternalCommand(requestedCommand, ...args);
    return null;
  }

  return runInternalCommand(requestedCommand, ...args);
}

async function closeAllEditors() {
  await runFirstAvailableCommand(CLOSE_ALL_EDITORS_COMMANDS);
}

async function startNewConversation() {
  await runFirstAvailableCommand(START_NEW_CONVERSATION_COMMANDS);
}

async function openQuickSettings() {
  await runFirstAvailableCommand(OPEN_QUICK_SETTINGS_COMMANDS);
}

async function resetSession() {
  const commands = await vscode.commands.getCommands(true);

  const closeEditorsCommand = findFirstAvailableCommand(commands, CLOSE_ALL_EDITORS_COMMANDS);
  const startConversationCommand = findFirstAvailableCommand(commands, START_NEW_CONVERSATION_COMMANDS);
  const openAgentCommand = findFirstAvailableCommand(commands, OPEN_AGENT_PANEL_COMMANDS);

  if (closeEditorsCommand) {
    void vscode.commands.executeCommand(closeEditorsCommand);
    await delay(150);
  }

  if (startConversationCommand) {
    void vscode.commands.executeCommand(startConversationCommand);
    await delay(150);
  }

  if (openAgentCommand) {
    void vscode.commands.executeCommand(openAgentCommand);
  }
}

async function dispatchInternalCommand(command, ...args) {
  const commands = await vscode.commands.getCommands(true);
  if (!commands.includes(command)) {
    throw new Error(`ZavorthBridge command not available: ${command}`);
  }

  void vscode.commands.executeCommand(command, ...args);
  await delay(150);
}

async function runInternalCommand(command, ...args) {
  const commands = await vscode.commands.getCommands(true);
  if (!commands.includes(command)) {
    throw new Error(`ZavorthBridge command not available: ${command}`);
  }

  await vscode.commands.executeCommand(command, ...args);
}

async function dispatchFirstAvailableCommand(commands, ...args) {
  const availableCommands = await vscode.commands.getCommands(true);
  const command = findFirstAvailableCommand(availableCommands, commands);
  if (!command) {
    throw new Error(`ZavorthBridge command not available: ${commands.join(' | ')}`);
  }

  void vscode.commands.executeCommand(command, ...args);
  await delay(150);
  return command;
}

async function runFirstAvailableCommand(commands, ...args) {
  const availableCommands = await vscode.commands.getCommands(true);
  const command = findFirstAvailableCommand(availableCommands, commands);
  if (!command) {
    throw new Error(`ZavorthBridge command not available: ${commands.join(' | ')}`);
  }

  await vscode.commands.executeCommand(command, ...args);
  return command;
}

async function writeResult(resultPath, payload) {
  await fs.promises.writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf8');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAvailableCommandSnapshot() {
  const commands = await vscode.commands.getCommands(true);
  return commands.filter((command) =>
    command.startsWith('zavorthBridge') ||
    command.startsWith('zavorthBridge') ||
    command === 'workbench.action.closeAllEditors'
  ).sort();
}

async function getPendingHandoffInfo(bridge) {
  const pendingSessions = await readPendingSessions(bridge);
  const actionableSessions = pendingSessions.filter((session) => !session?.completedAt);
  if (actionableSessions.length === 0) {
    return { count: 0, latestPendingHandoff: null };
  }

  const session = selectPendingSession(actionableSessions);
  return {
    count: actionableSessions.length,
    latestPendingHandoff: session?.handoffFile || null,
  };
}

async function readPendingSessions(bridge) {
  if (!fs.existsSync(bridge.pendingDir)) {
    return [];
  }

  const files = await fs.promises.readdir(bridge.pendingDir);
  const pending = files.filter((file) => file.endsWith('.json')).sort();
  const sessions = [];

  for (const file of pending) {
    const trackingFile = path.join(bridge.pendingDir, file);
    try {
      const stats = await fs.promises.stat(trackingFile);
      const session = JSON.parse(await fs.promises.readFile(trackingFile, 'utf8'));
      sessions.push({
        ...session,
        trackingFile,
        trackingFileName: file,
        launchedAtMs: safeParseTimestamp(session?.launchedAt),
        completedAtMs: safeParseTimestamp(session?.completedAt),
        fileMtimeMs: stats.mtimeMs,
      });
    } catch {
      // Ignore malformed pending sessions and keep scanning.
    }
  }

  return sessions;
}

function selectPendingSession(sessions, taskId) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  const active = sessions.filter((session) => !session?.completedAt);
  const taskMatch = taskId
    ? active.find((session) => String(session?.taskId || '').trim() === String(taskId).trim())
    : null;

  if (taskMatch) {
    return taskMatch;
  }

  const pool = active.length > 0 ? active : sessions;
  return pool
    .slice()
    .sort((left, right) => {
      const rightRank = Number.isFinite(right?.launchedAtMs) ? right.launchedAtMs : right?.fileMtimeMs || 0;
      const leftRank = Number.isFinite(left?.launchedAtMs) ? left.launchedAtMs : left?.fileMtimeMs || 0;
      return rightRank - leftRank;
    })[0] || null;
}

function safeParseTimestamp(rawValue) {
  if (!rawValue) {
    return Number.NaN;
  }

  const parsed = Date.parse(String(rawValue));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildCapabilitySnapshot(commands) {
  const hasAny = (candidates) => candidates.some((command) => commands.includes(command));

  return {
    canAcceptStep: hasAny(ACCEPT_STEP_COMMANDS),
    canRejectStep: hasAny(REJECT_STEP_COMMANDS),
    canOpenConversationPicker: hasAny(OPEN_CONVERSATION_PICKER_COMMANDS),
    canCloseAllEditors: hasAny(CLOSE_ALL_EDITORS_COMMANDS),
    canStartNewConversation: hasAny(START_NEW_CONVERSATION_COMMANDS),
    canOpenQuickSettingsPanel: hasAny(OPEN_QUICK_SETTINGS_COMMANDS),
    canResetSession: hasAny(CLOSE_ALL_EDITORS_COMMANDS) && hasAny(START_NEW_CONVERSATION_COMMANDS),
    canSendAgentPrompt: hasAny(SEND_AGENT_PROMPT_COMMANDS),
    canOpenAgentPanel: hasAny(OPEN_AGENT_PANEL_COMMANDS),
    canExecuteCommand: commands.some((command) => SAFE_EXECUTE_COMMANDS.has(command)),
    canOpenHandoff: true,
    canSyncPendingHandoffs: true,
    canReportStatus: true,
  };
}

function findFirstAvailableCommand(availableCommands, candidates) {
  return candidates.find((command) => availableCommands.includes(command)) || null;
}

function resolveBridgeScopedPath(bridge, value) {
  if (!value || !String(value).trim()) {
    return null;
  }

  const bridgeRoot = path.resolve(bridge.bridgeRoot || bridge.pendingDir || '');
  const rawValue = String(value).replace(/\\/g, path.sep);
  const resolved = path.resolve(path.isAbsolute(rawValue) ? rawValue : path.join(bridge.pendingDir, rawValue));
  return isPathInside(resolved, bridgeRoot) ? resolved : null;
}

function isPathInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) ? !relative.startsWith('..') && !path.isAbsolute(relative) : true;
}

function validateCommandArgs(args) {
  if (!Array.isArray(args) || args.length > 8) {
    throw new Error('Command args must be a short array.');
  }

  for (const arg of args) {
    const type = typeof arg;
    if (arg == null || type === 'boolean' || type === 'number') {
      continue;
    }
    if (type === 'string' && arg.length <= 4096) {
      continue;
    }
    throw new Error('Command args may only contain primitive values.');
  }
}

module.exports = {
  activate,
  deactivate,
  buildCapabilitySnapshot,
  getPendingHandoffInfo,
  resolveBridgeScopedPath,
  selectPendingSession,
  validateCommandArgs,
};
