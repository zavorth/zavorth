import path from 'path';
import { config } from '../../config/index.js';
import type { ZavorthBridgeCompanionBridge } from '../ZavorthBridgeCompanionBridge.js';
import type { ZavorthBridgeWindowAutomator } from '../ZavorthBridgeWindowAutomator.js';

type BridgeStatus = Awaited<ReturnType<ZavorthBridgeCompanionBridge['readStatus']>>;

export function isWorkspaceCompatible(workspaceFolders: string[], workspace: string): boolean {
  const normalizedWorkspace = workspace.replace(/\\/g, '/').toLowerCase();
  return workspaceFolders.some((folder) => {
    const normalizedFolder = folder.replace(/\\/g, '/').toLowerCase();
    return (
      normalizedFolder === normalizedWorkspace ||
      normalizedWorkspace.startsWith(`${normalizedFolder}/`) ||
      normalizedFolder.startsWith(`${normalizedWorkspace}/`)
    );
  });
}

export function isBridgeSessionReusable(status: BridgeStatus | null, workspace: string): boolean {
  if (!status?.instanceId) {
    return false;
  }

  const capabilities = status.capabilities || {};
  if (
    !capabilities.canExecuteCommand &&
    !capabilities.canOpenAgentPanel &&
    !capabilities.canStartNewConversation &&
    !capabilities.canCloseAllEditors &&
    !capabilities.canResetSession
  ) {
    return false;
  }

  return isWorkspaceCompatible(status.workspaceFolders || [], workspace);
}

export async function ensureReusableWorkspaceSession(input: {
  workspace: string;
  launch: (args: string[], workspace: string) => Promise<void>;
  buildWorkspaceBootstrapArgs: (workspace: string) => string[][];
  waitForCompatibleBridgeStatus: (workspace: string, timeoutMs: number) => Promise<BridgeStatus | null>;
  companionBridge: Pick<ZavorthBridgeCompanionBridge, 'readStatus'>;
  describeWorkspaceBootstrapFailure: (workspace: string, status: BridgeStatus | null) => string;
}): Promise<void> {
  const currentStatus = await input.waitForCompatibleBridgeStatus(input.workspace, 1500);
  if (currentStatus) {
    return;
  }

  for (const args of input.buildWorkspaceBootstrapArgs(input.workspace)) {
    await input.launch(args, input.workspace);
    const bridgedStatus = await input.waitForCompatibleBridgeStatus(
      input.workspace,
      config.zavorthBridgeWorkspaceBootstrapTimeoutSeconds * 1000,
    );

    if (bridgedStatus) {
      return;
    }
  }

  const lastStatus = await input.companionBridge.readStatus().catch(() => null);
  throw new Error(input.describeWorkspaceBootstrapFailure(input.workspace, lastStatus));
}

export function buildWorkspaceBootstrapArgs(workspace: string): string[][] {
  const withProfile = config.zavorthBridgeProfileName
    ? ['--profile', config.zavorthBridgeProfileName]
    : [];
  const windowStrategy = resolveWindowStrategyFlag();

  return [
    [...withProfile, windowStrategy, workspace],
    [windowStrategy, workspace],
    [...withProfile, workspace],
    [workspace],
  ];
}

export function resolveWindowStrategyFlag(): '--reuse-window' | '--new-window' {
  const normalized = String(config.zavorthBridgeWindowStrategy || '')
    .trim()
    .toLowerCase();

  if (normalized === 'new-window' || normalized === '--new-window' || normalized === '-n') {
    return '--new-window';
  }

  return '--reuse-window';
}

export async function waitForCompatibleBridgeStatus(input: {
  workspace: string;
  timeoutMs: number;
  readLiveBridgeStatus: () => Promise<BridgeStatus | null>;
  isBridgeSessionReusable: (status: BridgeStatus | null, workspace: string) => boolean;
  isWindowSurfaceCompatible: (status: BridgeStatus | null, workspace: string) => Promise<boolean>;
}): Promise<BridgeStatus | null> {
  const startedAt = Date.now();
  let lastStatus = await input.readLiveBridgeStatus();

  while (Date.now() - startedAt < input.timeoutMs) {
    if (input.isBridgeSessionReusable(lastStatus, input.workspace)) {
      return lastStatus;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
    lastStatus = (await input.readLiveBridgeStatus()) || lastStatus;
  }

  if (input.isBridgeSessionReusable(lastStatus, input.workspace)) {
    return lastStatus;
  }

  if (await input.isWindowSurfaceCompatible(lastStatus, input.workspace)) {
    return lastStatus;
  }

  return null;
}

export async function readLiveBridgeStatus(
  companionBridge: Pick<ZavorthBridgeCompanionBridge, 'isOnline' | 'readStatus'>,
): Promise<BridgeStatus | null> {
  if (!(await companionBridge.isOnline())) {
    return null;
  }

  return companionBridge.readStatus().catch(() => null);
}

export function describeWorkspaceBootstrapFailure(workspace: string, status: BridgeStatus | null): string {
  const visibleWorkspaces = (status?.workspaceFolders || []).join(', ') || 'nenhuma';
  const capabilities = status?.capabilities || {};
  const missingCapabilities = [
    !capabilities.canExecuteCommand ? 'executeCommand' : null,
    !capabilities.canOpenAgentPanel ? 'openAgentPanel' : null,
  ].filter(Boolean);

  const details = [
    `workspace esperada: ${workspace}`,
    `workspace visivel: ${visibleWorkspaces}`,
  ];

  if (status?.instanceId) {
    details.push(`instancia: ${status.instanceId}`);
  }

  const workspaceLabel = getWorkspaceWindowLabel(workspace);
  if (workspaceLabel) {
    details.push(`expected title: ${workspaceLabel}`);
  }

  if (missingCapabilities.length > 0) {
    details.push(`missing capabilities: ${missingCapabilities.join(', ')}`);
  }

  return `ZavorthBridge did not open a reusable session in the correct workspace (${details.join(' | ')}).`;
}

export async function isWindowSurfaceCompatible(input: {
  status: BridgeStatus | null;
  workspace: string;
  windowAutomator: Pick<ZavorthBridgeWindowAutomator, 'focusWindow'>;
}): Promise<boolean> {
  if (!input.status?.instanceId) {
    return false;
  }

  const capabilities = input.status.capabilities || {};
  if (
    !capabilities.canExecuteCommand &&
    !capabilities.canOpenAgentPanel &&
    !capabilities.canStartNewConversation &&
    !capabilities.canCloseAllEditors &&
    !capabilities.canResetSession
  ) {
    return false;
  }

  const expectedWindowLabel = getWorkspaceWindowLabel(input.workspace);
  if (!expectedWindowLabel) {
    return false;
  }

  const focusedWindow = await input.windowAutomator.focusWindow(0).catch(() => null);
  const visibleWindowTitle = String((focusedWindow as any)?.windowTitle || '')
    .trim()
    .toLowerCase();

  return Boolean(visibleWindowTitle) && visibleWindowTitle.includes(expectedWindowLabel);
}

export function getWorkspaceWindowLabel(workspace: string): string {
  const normalized = String(workspace || '')
    .trim()
    .replace(/\//g, '\\')
    .replace(/\\+$/, '');

  return path.win32.basename(normalized).trim().toLowerCase();
}
