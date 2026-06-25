import fs from 'fs';

const filePath = 'c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/orchestrator/RealZavorthBridgeWatcher.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports if they do not exist
if (!content.includes('PermissionRequest')) {
  // Let's insert the import at the top
  const importLines = [
    "import { PermissionRequest } from '../contracts/PermissionRequest.js';",
    "import { ZavorthBridgeUiSnapshot } from '../services/ZavorthBridgeUiCaptureService.js';"
  ];
  content = importLines.join('\n') + '\n' + content;
}

// 2. Define replacements mapping
const replacements = {
  "findLatestZavorthBridgeLogFile": {
    body: `  private findLatestZavorthBridgeLogFile(): Promise<string | null> {
    return this.callWorkflow('findLatestZavorthBridgeLogFile', []);
  }`
  },
  "parseLogEvent": {
    body: `  private parseLogEvent(line: string): ZavorthBridgeLogEvent | null {
    return this.callWorkflow('parseLogEvent', [line]);
  }`
  },
  "isInterestingLogLine": {
    body: `  private isInterestingLogLine(line: string): boolean {
    return this.callWorkflow('isInterestingLogLine', [line]);
  }`
  },
  "isAutomationTriggerLogLine": {
    body: `  private isAutomationTriggerLogLine(line: string): boolean {
    return this.callWorkflow('isAutomationTriggerLogLine', [line]);
  }`
  },
  "resolveArtifactContentPath": {
    body: `  private resolveArtifactContentPath(dirPath: string, baseName: string): Promise<string | null> {
    return this.callWorkflow('resolveArtifactContentPath', [dirPath, baseName]);
  }`
  },
  "matchesSession": {
    body: `  private matchesSession(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): boolean {
    return this.callWorkflow('matchesSession', [session, artifact]);
  }`
  },
  "tryAutomationRescue": {
    body: `  private tryAutomationRescue(session: PendingZavorthBridgeSession, reason: 'stalled' | 'log_error'): Promise<void> {
    return this.callWorkflow('tryAutomationRescue', [session, reason]);
  }`
  },
  "getLiveCompanionStatus": {
    body: `  private getLiveCompanionStatus(targetInstanceId?: string): Promise<Record<string, any> | null> {
    return this.callWorkflow('getLiveCompanionStatus', [targetInstanceId]);
  }`
  },
  "resolveScopedCompanionUiTarget": {
    body: `  private resolveScopedCompanionUiTarget(session: PendingZavorthBridgeSession): Promise<ScopedCompanionUiTarget> {
    return this.callWorkflow('resolveScopedCompanionUiTarget', [session]);
  }`
  },
  "canCaptureScopedSessionUi": {
    body: `  private canCaptureScopedSessionUi(target: ScopedCompanionUiTarget): boolean {
    return this.callWorkflow('canCaptureScopedSessionUi', [target]);
  }`
  },
  "resolveCompanionTargetInstanceId": {
    body: `  private resolveCompanionTargetInstanceId(session: PendingZavorthBridgeSession): string | undefined {
    return this.callWorkflow('resolveCompanionTargetInstanceId', [session]);
  }`
  },
  "tryCompanionRecovery": {
    body: `  private tryCompanionRecovery(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: Record<string, any> | null,
    errorReason: string,
  ): Promise<boolean> {
    return this.callWorkflow('tryCompanionRecovery', [session, target, liveStatus, errorReason]);
  }`
  },
  "buildCompanionRecoveryPrompt": {
    body: `  private buildCompanionRecoveryPrompt(
    session: PendingZavorthBridgeSession,
    target: ScopedCompanionUiTarget,
    liveStatus: Record<string, any> | null,
    errorReason: string,
  ): string {
    return this.callWorkflow('buildCompanionRecoveryPrompt', [session, target, liveStatus, errorReason]);
  }`
  },
  "markTaskDelivered": {
    body: `  private markTaskDelivered(taskId: string, summary: string | null): Promise<void> {
    return this.callWorkflow('markTaskDelivered', [taskId, summary]);
  }`
  },
  "markTaskFailed": {
    body: `  private markTaskFailed(taskId: string, summary: string): Promise<void> {
    return this.callWorkflow('markTaskFailed', [taskId, summary]);
  }`
  },
  "resolvePendingPermissionForTerminalTask": {
    body: `  private resolvePendingPermissionForTerminalTask(task: Task, note: string): Promise<void> {
    return this.callWorkflow('resolvePendingPermissionForTerminalTask', [task, note]);
  }`
  },
  "queueSessionDelivery": {
    body: `  private queueSessionDelivery(
    session: PendingZavorthBridgeSession,
    deliverable: any,
    chatGatewayId: string | null,
  ): void {
    return this.callWorkflow('queueSessionDelivery', [session, deliverable, chatGatewayId]);
  }`
  },
  "failStalledSession": {
    body: `  private failStalledSession(session: PendingZavorthBridgeSession, errorReason: string): Promise<void> {
    return this.callWorkflow('failStalledSession', [session, errorReason]);
  }`
  },
  "tryQueueLocalDirectoryFallback": {
    body: `  private tryQueueLocalDirectoryFallback(session: PendingZavorthBridgeSession, workspace: string): Promise<boolean> {
    return this.callWorkflow('tryQueueLocalDirectoryFallback', [session, workspace]);
  }`
  },
  "describeStalledFailure": {
    body: `  private describeStalledFailure(session: PendingZavorthBridgeSession, liveStatus: Record<string, any> | null): string {
    return this.callWorkflow('describeStalledFailure', [session, liveStatus]);
  }`
  },
  "hasCompanionHandoffMismatch": {
    body: `  private hasCompanionHandoffMismatch(
    session: PendingZavorthBridgeSession,
    liveStatus: Record<string, any> | null,
  ): boolean {
    return this.callWorkflow('hasCompanionHandoffMismatch', [session, liveStatus]);
  }`
  },
  "normalizeComparisonValue": {
    body: `  private normalizeComparisonValue(rawValue: string | null | undefined): string {
    return this.callWorkflow('normalizeComparisonValue', [rawValue]);
  }`
  },
  "isLocalDirectoryInspectionPrompt": {
    body: `  private isLocalDirectoryInspectionPrompt(prompt: string): boolean {
    return this.callWorkflow('isLocalDirectoryInspectionPrompt', [prompt]);
  }`
  },
  "resolveDirectoryListingTarget": {
    body: `  private resolveDirectoryListingTarget(prompt: string, workspace: string): string | null {
    return this.callWorkflow('resolveDirectoryListingTarget', [prompt, workspace]);
  }`
  },
  "extractDirectoryHints": {
    body: `  private extractDirectoryHints(prompt: string): string[] {
    return this.callWorkflow('extractDirectoryHints', [prompt]);
  }`
  },
  "resolveDirectoryHint": {
    body: `  private resolveDirectoryHint(hint: string, workspacePath: string): string | null {
    return this.callWorkflow('resolveDirectoryHint', [hint, workspacePath]);
  }`
  },
  "listAncestorDirectories": {
    body: `  private listAncestorDirectories(startPath: string): string[] {
    return this.callWorkflow('listAncestorDirectories', [startPath]);
  }`
  },
  "normalizePathToken": {
    body: `  private normalizePathToken(value: string): string {
    return this.callWorkflow('normalizePathToken', [value]);
  }`
  },
  "pathTokensRoughlyMatch": {
    body: `  private pathTokensRoughlyMatch(left: string, right: string): boolean {
    return this.callWorkflow('pathTokensRoughlyMatch', [left, right]);
  }`
  },
  "isExistingDirectory": {
    body: `  private isExistingDirectory(candidate: string): boolean {
    return this.callWorkflow('isExistingDirectory', [candidate]);
  }`
  },
  "safeReadDirectory": {
    body: `  private safeReadDirectory(candidate: string): fs.Dirent[] {
    return this.callWorkflow('safeReadDirectory', [candidate]);
  }`
  },
  "normalizeVisibleResponse": {
    body: `  private normalizeVisibleResponse(value: string | null | undefined): string {
    return this.callWorkflow('normalizeVisibleResponse', [value]);
  }`
  },
  "sanitizeVisibleResponse": {
    body: `  private sanitizeVisibleResponse(value: string | null | undefined, promptText: string | null | undefined): string {
    return this.callWorkflow('sanitizeVisibleResponse', [value, promptText]);
  }`
  },
  "isVisibleResponseCaptureReady": {
    body: `  private isVisibleResponseCaptureReady(promptText: string, visibleResponse: string | null | undefined): boolean {
    return this.callWorkflow('isVisibleResponseCaptureReady', [promptText, visibleResponse]);
  }`
  },
  "tryQueuePromptContractDelivery": {
    body: `  private tryQueuePromptContractDelivery(session: PendingZavorthBridgeSession): Promise<boolean> {
    return this.callWorkflow('tryQueuePromptContractDelivery', [session]);
  }`
  },
  "extractFileCreationPromptContract": {
    body: `  private extractFileCreationPromptContract(
    promptText: string,
    visibleResponse: string | null | undefined,
  ): { filePath: string; fileContent: string } | null {
    return this.callWorkflow('extractFileCreationPromptContract', [promptText, visibleResponse]);
  }`
  },
  "normalizePromptContractFileContent": {
    body: `  private normalizePromptContractFileContent(value: string | null | undefined): string {
    return this.callWorkflow('normalizePromptContractFileContent', [value]);
  }`
  },
  "clearPendingPermissionMetadata": {
    body: `  private clearPendingPermissionMetadata(task: Task): void {
    return this.callWorkflow('clearPendingPermissionMetadata', [task]);
  }`
  },
  "isTrackingFileCompleted": {
    body: `  private isTrackingFileCompleted(trackingFile: string): boolean {
    return this.callWorkflow('isTrackingFileCompleted', [trackingFile]);
  }`
  },
  "isZavorthBridgeTask": {
    body: `  private isZavorthBridgeTask(task: Task | null | undefined): boolean {
    return this.callWorkflow('isZavorthBridgeTask', [task]);
  }`
  },
  "wasPermissionRecentlyNotified": {
    body: `  private wasPermissionRecentlyNotified(permissionId: string, minAgeMs: number): boolean {
    return this.callWorkflow('wasPermissionRecentlyNotified', [permissionId, minAgeMs]);
  }`
  },
  "maybeHandlePermissionPrompt": {
    body: `  private maybeHandlePermissionPrompt(session: PendingZavorthBridgeSession, trackingFile: string): Promise<boolean> {
    return this.callWorkflow('maybeHandlePermissionPrompt', [session, trackingFile]);
  }`
  },
  "findZavorthBridgeAutoApprovalPolicy": {
    body: `  private findZavorthBridgeAutoApprovalPolicy(permission: PermissionRequest): Promise<any> {
    return this.callWorkflow('findZavorthBridgeAutoApprovalPolicy', [permission]);
  }`
  },
  "resolveZavorthBridgeApprovalMode": {
    body: `  private resolveZavorthBridgeApprovalMode(permission: PermissionRequest): 'once' | 'conversation' {
    return this.callWorkflow('resolveZavorthBridgeApprovalMode', [permission]);
  }`
  },
  "buildZavorthBridgePermissionReason": {
    body: `  private buildZavorthBridgePermissionReason(snapshot: ZavorthBridgeUiSnapshot): string | null {
    return this.callWorkflow('buildZavorthBridgePermissionReason', [snapshot]);
  }`
  },
  "notifyPermissionRequest": {
    body: `  private notifyPermissionRequest(permission: PermissionRequest, reason: string): Promise<void> {
    return this.callWorkflow('notifyPermissionRequest', [permission, reason]);
  }`
  },
  "isRecentTimestamp": {
    body: `  private isRecentTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
    return this.callWorkflow('isRecentTimestamp', [value, maxAgeMs]);
  }`
  },
  "formatFinalResponseBroadcast": {
    body: `  private formatFinalResponseBroadcast(session: PendingZavorthBridgeSession, finalResponseText: string): string {
    return this.callWorkflow('formatFinalResponseBroadcast', [session, finalResponseText]);
  }`
  },
  "formatArtifactCompletion": {
    body: `  private formatArtifactCompletion(session: PendingZavorthBridgeSession, artifact: ZavorthBridgeArtifact): string {
    return this.callWorkflow('formatArtifactCompletion', [session, artifact]);
  }`
  },
  "humanizeArtifactType": {
    body: `  private humanizeArtifactType(artifactType: string): string {
    return this.callWorkflow('humanizeArtifactType', [artifactType]);
  }`
  },
  "truncate": {
    body: `  private truncate(content: string, maxLength: number): string {
    return this.callWorkflow('truncate', [content, maxLength]);
  }`
  },
  "formatTelegramFriendlyResponse": {
    body: `  private formatTelegramFriendlyResponse(
    originalResponse: string,
    session: PendingZavorthBridgeSession,
    artifact?: ZavorthBridgeArtifact,
  ): string {
    return this.callWorkflow('formatTelegramFriendlyResponse', [originalResponse, session, artifact]);
  }`
  },
  "tryFormatStructuredInventory": {
    body: `  private tryFormatStructuredInventory(originalResponse: string, session: PendingZavorthBridgeSession): string | null {
    return this.callWorkflow('tryFormatStructuredInventory', [originalResponse, session]);
  }`
  },
  "extractInventoryHeading": {
    body: `  private extractInventoryHeading(line: string): string | null {
    return this.callWorkflow('extractInventoryHeading', [line]);
  }`
  },
  "extractInventoryItem": {
    body: `  private extractInventoryItem(line: string): string | null {
    return this.callWorkflow('extractInventoryItem', [line]);
  }`
  },
  "looksLikeInventoryItem": {
    body: `  private looksLikeInventoryItem(line: string): boolean {
    return this.callWorkflow('looksLikeInventoryItem', [line]);
  }`
  },
  "isDiscardableZavorthBridgeClosingLine": {
    body: `  private isDiscardableZavorthBridgeClosingLine(line: string): boolean {
    return this.callWorkflow('isDiscardableZavorthBridgeClosingLine', [line]);
  }`
  },
  "normalizeTelegramFriendlyText": {
    body: `  private normalizeTelegramFriendlyText(value: string): string {
    return this.callWorkflow('normalizeTelegramFriendlyText', [value]);
  }`
  },
  "sendDeliveryToOriginChat": {
    body: `  private sendDeliveryToOriginChat(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendDeliveryToOriginChat', [session, message]);
  }`
  },
  "sendToSession": {
    body: `  private sendToSession(session: PendingZavorthBridgeSession, message: string): Promise<void> {
    return this.callWorkflow('sendToSession', [session, message]);
  }`
  }
};

let matchCount = 0;
for (const [methodName, config] of Object.entries(replacements)) {
  const pattern = new RegExp(`private ${methodName}\\(\\.\\.\\.args: any\\[\\]\\): any \\{\\r?\\n\\s*return this\\.callWorkflow\\('${methodName}', args\\);\\r?\\n\\s*\\}`, 'g');
  if (pattern.test(content)) {
    content = content.replace(pattern, config.body);
    matchCount++;
  } else {
    // try fallback without spaces or with optional args
    const fallbackPattern = new RegExp(`private ${methodName}\\(args: any\\[\\]\\): any \\{\\r?\\n\\s*return this\\.callWorkflow\\('${methodName}', args\\);\\r?\\n\\s*\\}`, 'g');
    if (fallbackPattern.test(content)) {
      content = content.replace(fallbackPattern, config.body);
      matchCount++;
    } else {
      console.log(`Failed to match method ${methodName}`);
    }
  }
}

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Successfully replaced ${matchCount} method bodies.`);
