import { LogRepository } from '../storage/LogRepository.js';
import crypto from 'crypto';
import path from 'path';

export class SecurityAuditLogger {
  private readonly logRepo: LogRepository;

  constructor(logRepo?: LogRepository) {
    this.logRepo = logRepo || new LogRepository();
  }

  // HMAC-SHA256 hashing using the local key ZAVORTH_AUDIT_HASH_KEY or secure fallback
  private hashId(id: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      }
      return crypto.createHmac('sha256', 'default-zavorth-audit-key-please-change-in-production').update(id).digest('hex');
    }
    return crypto.createHmac('sha256', key).update(id).digest('hex');
  }

  private getSuffix(id: string): string {
    const cleanId = id.trim().toLowerCase();
    if (cleanId.endsWith('@c.us')) {
      return '@c.us';
    }
    if (cleanId.endsWith('@g.us')) {
      return '@g.us';
    }
    return 'redacted';
  }

  // Runtime string sanitization: strip control characters
  private sanitizeString(val: string, maxLength = 128): string {
    const cleaned = val.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    return cleaned.slice(0, maxLength);
  }

  private validateServerId(id: string): boolean {
    return /^[A-Za-z0-9._-]+$/.test(id);
  }

  private validateNamespacedToolId(id: string): boolean {
    return /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/.test(id);
  }

  private validateKeys(obj: Record<string, any>, allowedKeys: string[]): void {
    const keys = Object.keys(obj);
    const forbiddenKeys = ['messageBody', 'prompt', 'env', 'envValue', 'toolArgs', 'schema', 'parameters'];
    
    for (const key of keys) {
      if (forbiddenKeys.includes(key)) {
        throw new Error(`Forbidden key "${key}" detected in audit event metadata.`);
      }
      if (!allowedKeys.includes(key)) {
        throw new Error(`Unexpected key "${key}" detected in audit event metadata.`);
      }
    }
  }

  private validatePayloadValues(payload: Record<string, any>): void {
    for (const [key, val] of Object.entries(payload)) {
      if (typeof val === 'string') {
        // Enforce length limit
        if (val.length > 128) {
          throw new Error(`Payload field "${key}" exceeds maximum length of 128 characters.`);
        }
        // Reject newlines, carriage returns, tabs, and control chars
        if (/[\r\n\t\x00-\x1F\x7F-\x9F]/.test(val)) {
          throw new Error(`Payload field "${key}" contains forbidden newline or control characters.`);
        }
      }
    }
  }

  private validateRawPathForHashOnly(value: string, maxLength = 4096): void {
    if (value.length > maxLength) {
      throw new Error(`Path field exceeds maximum length of ${maxLength} characters.`);
    }
    if (/[\r\n\t\x00-\x1F\x7F-\x9F]/.test(value)) {
      throw new Error(`Path field contains forbidden newline or control characters.`);
    }
  }

  private safePersist(event: string, metadata: Record<string, any>): void {
    try {
      this.logRepo.log('security', 'security_audit', event, metadata);
    } catch (err: any) {
      // Minimal safe warning to stderr without leaking any sensitive metadata/payload.
      console.error(`[SecurityAuditLogger] Failed to persist security audit event: DB error.`);
    }
  }

  // 1. Channel / WhatsApp Events
  public logChannelAccessDecision(payload: {
    event: 'channel_message_accepted' | 'channel_message_blocked';
    decision: 'allowed' | 'blocked';
    channel: 'whatsapp';
    chatId: string;
    isGroup: boolean;
    channelUserId: string;
    channelUserIdAllowed: boolean;
    reason?: 'unauthorized_group' | 'unauthorized_user' | 'blocked_user' | 'group_message_without_trigger' | 'self_message_loopback';
    triggerType: 'dm' | 'wake_word' | 'mention' | 'reply_to_bot' | 'none';
  }): void {
    const allowedPayloadKeys = [
      'event', 'decision', 'channel', 'chatId', 'isGroup',
      'channelUserId', 'channelUserIdAllowed', 'reason', 'triggerType'
    ];
    this.validateKeys(payload, allowedPayloadKeys);
    this.validatePayloadValues(payload);

    const validEvents = ['channel_message_accepted', 'channel_message_blocked'];
    const validDecisions = ['allowed', 'blocked'];
    const validReasons = ['unauthorized_group', 'unauthorized_user', 'blocked_user', 'group_message_without_trigger', 'self_message_loopback'];
    const validTriggerTypes = ['dm', 'wake_word', 'mention', 'reply_to_bot', 'none'];

    if (!validEvents.includes(payload.event)) {
      throw new Error(`Invalid channel event: ${payload.event}`);
    }
    if (!validDecisions.includes(payload.decision)) {
      throw new Error(`Invalid channel decision: ${payload.decision}`);
    }
    if (payload.reason && !validReasons.includes(payload.reason)) {
      throw new Error(`Invalid channel reason: ${payload.reason}`);
    }
    if (!validTriggerTypes.includes(payload.triggerType)) {
      throw new Error(`Invalid trigger type: ${payload.triggerType}`);
    }

    const metadata: Record<string, any> = {
      event: payload.event,
      decision: payload.decision,
      channel: payload.channel,
      chatIdHash: this.hashId(payload.chatId),
      chatIdSuffix: this.sanitizeString(this.getSuffix(payload.chatId)),
      isGroup: payload.isGroup,
      channelUserIdHash: this.hashId(payload.channelUserId),
      channelUserIdSuffix: this.sanitizeString(this.getSuffix(payload.channelUserId)),
      channelUserIdAllowed: payload.channelUserIdAllowed,
      triggerType: payload.triggerType,
      timestamp: new Date().toISOString(),
    };

    if (payload.reason) {
      metadata.reason = payload.reason;
    }

    const allowedKeys = [
      'event', 'decision', 'channel', 'chatIdHash', 'chatIdSuffix',
      'isGroup', 'channelUserIdHash', 'channelUserIdSuffix', 'channelUserIdAllowed',
      'reason', 'triggerType', 'timestamp'
    ];

    this.validateKeys(metadata, allowedKeys);
    this.safePersist(payload.event, metadata);
  }

  // 2. Tool Exposure Events
  public logToolExposureDecision(payload: {
    event: 'tool_exposure_decision';
    decision: 'exposed' | 'blocked';
    toolName: string;
    risk: 'safe' | 'attention' | 'danger' | 'unknown';
    reason: 'unauthorized-user-in-group' | 'risk-not-safe' | 'not-in-allowlist' | 'global-policy-block' | 'unknown-risk' | 'blocked-by-cognitive-firewall-plugin-quarantine' | 'blocked-by-imported-capability-trust';
    channelUserIdAllowed: boolean;
    groupToolPolicyMode?: string;
  }): void {
    const allowedPayloadKeys = [
      'event', 'decision', 'toolName', 'risk', 'reason',
      'channelUserIdAllowed', 'groupToolPolicyMode'
    ];
    this.validateKeys(payload, allowedPayloadKeys);
    this.validatePayloadValues(payload);

    const validDecisions = ['exposed', 'blocked'];
    const validRisks = ['safe', 'attention', 'danger', 'unknown'];
    const validReasons = [
      'unauthorized-user-in-group',
      'risk-not-safe',
      'not-in-allowlist',
      'global-policy-block',
      'unknown-risk',
      'blocked-by-cognitive-firewall-plugin-quarantine',
      'blocked-by-imported-capability-trust'
    ];

    if (payload.event !== 'tool_exposure_decision') {
      throw new Error(`Invalid tool exposure event: ${payload.event}`);
    }
    if (!validDecisions.includes(payload.decision)) {
      throw new Error(`Invalid tool exposure decision: ${payload.decision}`);
    }
    if (!validRisks.includes(payload.risk)) {
      throw new Error(`Invalid tool risk: ${payload.risk}`);
    }
    if (!validReasons.includes(payload.reason)) {
      throw new Error(`Invalid tool exposure reason: ${payload.reason}`);
    }

    const metadata: Record<string, any> = {
      event: payload.event,
      decision: payload.decision,
      toolName: this.sanitizeString(payload.toolName),
      risk: payload.risk,
      reason: payload.reason,
      channelUserIdAllowed: payload.channelUserIdAllowed,
      timestamp: new Date().toISOString(),
    };

    if (payload.groupToolPolicyMode) {
      metadata.groupToolPolicyMode = this.sanitizeString(payload.groupToolPolicyMode);
    }

    const allowedKeys = [
      'event', 'decision', 'toolName', 'risk', 'reason',
      'channelUserIdAllowed', 'groupToolPolicyMode', 'timestamp'
    ];

    this.validateKeys(metadata, allowedKeys);
    this.safePersist(payload.event, metadata);
  }

  // 3. MCP Runtime Events
  public logMcpRuntimeEvent(payload: {
    event: 'mcp_tool_pending' | 'mcp_schema_drift_detected' | 'mcp_description_drift_detected' | 'mcp_tool_registered' | 'mcp_tool_blocked';
    serverId: string;
    toolName: string;
    namespacedToolId: string;
    fingerprint: string;
    previousFingerprint?: string;
    pendingReason?: 'new_tool' | 'schema_drift';
    effectiveAllowed?: boolean;
  }): void {
    const allowedPayloadKeys = [
      'event', 'serverId', 'toolName', 'namespacedToolId', 'fingerprint',
      'previousFingerprint', 'pendingReason', 'effectiveAllowed'
    ];
    this.validateKeys(payload, allowedPayloadKeys);
    this.validatePayloadValues(payload);

    const validEvents = [
      'mcp_tool_pending',
      'mcp_schema_drift_detected',
      'mcp_description_drift_detected',
      'mcp_tool_registered',
      'mcp_tool_blocked'
    ];

    if (!validEvents.includes(payload.event)) {
      throw new Error(`Invalid MCP runtime event: ${payload.event}`);
    }
    if (!this.validateServerId(payload.serverId)) {
      throw new Error(`Invalid serverId format: ${payload.serverId}`);
    }
    if (!this.validateNamespacedToolId(payload.namespacedToolId)) {
      throw new Error(`Invalid namespacedToolId format: ${payload.namespacedToolId}`);
    }

    const metadata: Record<string, any> = {
      event: payload.event,
      serverId: this.sanitizeString(payload.serverId),
      toolName: this.sanitizeString(payload.toolName),
      namespacedToolId: this.sanitizeString(payload.namespacedToolId),
      fingerprint: this.sanitizeString(payload.fingerprint),
      timestamp: new Date().toISOString(),
    };

    if (payload.previousFingerprint) {
      metadata.previousFingerprint = this.sanitizeString(payload.previousFingerprint);
    }
    if (payload.pendingReason) {
      const validPendingReasons = ['new_tool', 'schema_drift'];
      if (!validPendingReasons.includes(payload.pendingReason)) {
        throw new Error(`Invalid pendingReason: ${payload.pendingReason}`);
      }
      metadata.pendingReason = payload.pendingReason;
    }
    if (typeof payload.effectiveAllowed === 'boolean') {
      metadata.effectiveAllowed = payload.effectiveAllowed;
    }

    const allowedKeys = [
      'event', 'serverId', 'toolName', 'namespacedToolId', 'fingerprint',
      'previousFingerprint', 'pendingReason', 'effectiveAllowed', 'timestamp'
    ];

    this.validateKeys(metadata, allowedKeys);
    this.safePersist(payload.event, metadata);
  }

  // 4. CLI / Admin Events
  public logCliAdminEvent(payload: {
    event: 'mcp_tool_approved' | 'mcp_tool_blocked_by_admin' | 'mcp_tool_forgotten' | 'mcp_server_added' | 'mcp_server_disabled' | 'mcp_server_removed' | 'mcp_server_enabled';
    actor: 'local-cli';
    source: 'zavorth-mcp-install';
    toolId?: string;
    serverId?: string;
    previousStatus?: string;
    newStatus?: string;
    fingerprint?: string;
    allowlistChanged?: boolean;
  }): void {
    const allowedPayloadKeys = [
      'event', 'actor', 'source', 'toolId', 'serverId',
      'previousStatus', 'newStatus', 'fingerprint', 'allowlistChanged'
    ];
    this.validateKeys(payload, allowedPayloadKeys);
    this.validatePayloadValues(payload);

    const validEvents = [
      'mcp_tool_approved',
      'mcp_tool_blocked_by_admin',
      'mcp_tool_forgotten',
      'mcp_server_added',
      'mcp_server_disabled',
      'mcp_server_removed',
      'mcp_server_enabled'
    ];

    if (!validEvents.includes(payload.event)) {
      throw new Error(`Invalid CLI admin event: ${payload.event}`);
    }
    if (payload.toolId && !this.validateNamespacedToolId(payload.toolId)) {
      throw new Error(`Invalid toolId format: ${payload.toolId}`);
    }
    if (payload.serverId && !this.validateServerId(payload.serverId)) {
      throw new Error(`Invalid serverId format: ${payload.serverId}`);
    }

    const metadata: Record<string, any> = {
      event: payload.event,
      actor: payload.actor,
      source: payload.source,
      timestamp: new Date().toISOString(),
    };

    if (payload.toolId) metadata.toolId = this.sanitizeString(payload.toolId);
    if (payload.serverId) metadata.serverId = this.sanitizeString(payload.serverId);
    if (payload.previousStatus) metadata.previousStatus = this.sanitizeString(payload.previousStatus);
    if (payload.newStatus) metadata.newStatus = this.sanitizeString(payload.newStatus);
    if (payload.fingerprint) metadata.fingerprint = this.sanitizeString(payload.fingerprint);
    if (typeof payload.allowlistChanged === 'boolean') {
      metadata.allowlistChanged = payload.allowlistChanged;
    }

    const allowedKeys = [
      'event', 'actor', 'source', 'toolId', 'serverId',
      'previousStatus', 'newStatus', 'fingerprint', 'allowlistChanged', 'timestamp'
    ];

    this.validateKeys(metadata, allowedKeys);
    this.safePersist(payload.event, metadata);
  }

  private getRootPathSuffix(rootPath: string): string {
    const clean = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    if (idx >= 0) {
      return clean.slice(idx + 1);
    }
    return clean || 'redacted';
  }

  private getPathSuffix(filePath: string): string {
    const filename = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    return ext || filename || 'redacted';
  }

  // 5. Workspace Events
  public logWorkspaceEvent(payload: {
    event: 'workspace_opened' | 'workspace_revoked' | 'workspace_tool_allowed' | 'workspace_tool_blocked' | 'workspace_path_denied' | 'workspace_git_read' | 'workspace_filesystem_read' | 'workspace_filesystem_write' | 'workspace_notes_event' | 'workspace_write_requested' | 'workspace_write_approved' | 'workspace_write_denied' | 'grant_created' | 'grant_revoked' | 'grant_expired' | 'command_auto_approved' | 'command_approval_requested' | 'command_approved' | 'command_denied' | 'command_executed' | 'command_blocked' | 'workspace_trust_granted' | 'workspace_trust_revoked' | 'workspace_trust_loaded' | 'workspace_trust_rejected' | 'command_auto_approved_by_trusted_workspace' | 'workspace_task_mandate_requested' | 'workspace_task_mandate_approved' | 'workspace_task_mandate_denied' | 'workspace_task_mandate_revoked' | 'workspace_task_mandate_expired' | 'command_auto_approved_by_task_mandate' | 'filesystem_write_auto_approved_by_task_mandate' | 'task_mandate_scope_violation' | 'tmp_dir_trust_requested' | 'tmp_dir_trust_approved' | 'tmp_dir_trust_denied' | 'tmp_dir_trust_revoked' | 'tmp_dir_trust_expired' | 'tmp_dir_trust_auto_approved' | 'tmp_dir_trust_scope_block' | 'host_command_proposed' | 'host_command_approved' | 'host_command_denied' | 'host_command_executed' | 'host_power_mode_enabled' | 'host_power_mode_disabled' | 'host_power_mode_expired' | 'pty_session_requested' | 'pty_session_approved' | 'pty_session_denied' | 'pty_session_started' | 'pty_session_terminated' | 'pty_session_expired' | 'pty_session_terminated_due_to_host_power_disabled' | 'pty_input_requested' | 'pty_input_approved' | 'pty_input_blocked' | 'pty_input_sent' | 'pty_output_truncated' | 'pty_policy_violation' | 'critical_pty_input_strong_confirmation_required' | 'critical_pty_input_strong_confirmation_failed' | 'critical_pty_input_strong_confirmation_passed';
    workspaceId: string;
    rootPath?: string;
    rootPathHash?: string;
    rootPathSuffix?: string;
    toolName?: string;
    decision?: 'allowed' | 'blocked';
    reason?: string;
    path?: string;
    operation?: string;
    argsHash?: string;
    exitCode?: number;
    durationMs?: number;
    timeoutFlag?: boolean;
    truncatedFlag?: boolean;
    riskLevel?: string;
    commandHash?: string;
    redactedCommandPreview?: string;
    metadata?: Record<string, any>;
  }): void {
    const allowedPayloadKeys = [
      'event', 'workspaceId', 'rootPath', 'rootPathHash', 'rootPathSuffix', 'toolName', 'decision', 'reason', 'path', 'operation',
      'argsHash', 'exitCode', 'durationMs', 'timeoutFlag', 'truncatedFlag', 'riskLevel', 'commandHash', 'redactedCommandPreview', 'metadata'
    ];
    this.validateKeys(payload, allowedPayloadKeys);

    // Validate only normal payload fields with validatePayloadValues
    const copy = { ...payload };
    delete copy.rootPath;
    delete copy.path;
    delete copy.metadata;
    this.validatePayloadValues(copy);

    // Validate raw path fields separately without the 128 character limit
    if (payload.rootPath) {
      this.validateRawPathForHashOnly(payload.rootPath);
    }
    if (payload.path) {
      this.validateRawPathForHashOnly(payload.path);
    }

    const validEvents = [
      'workspace_opened',
      'workspace_revoked',
      'workspace_tool_allowed',
      'workspace_tool_blocked',
      'workspace_path_denied',
      'workspace_git_read',
      'workspace_filesystem_read',
      'workspace_filesystem_write',
      'workspace_notes_event',
      'workspace_write_requested',
      'workspace_write_approved',
      'workspace_write_denied',
      'grant_created',
      'grant_revoked',
      'grant_expired',
      'command_auto_approved',
      'command_approval_requested',
      'command_approved',
      'command_denied',
      'command_executed',
      'command_blocked',
      'workspace_trust_granted',
      'workspace_trust_revoked',
      'workspace_trust_loaded',
      'workspace_trust_rejected',
      'command_auto_approved_by_trusted_workspace',
      'workspace_task_mandate_requested',
      'workspace_task_mandate_approved',
      'workspace_task_mandate_denied',
      'workspace_task_mandate_revoked',
      'workspace_task_mandate_expired',
      'command_auto_approved_by_task_mandate',
      'filesystem_write_auto_approved_by_task_mandate',
      'task_mandate_scope_violation',
      'tmp_dir_trust_requested',
      'tmp_dir_trust_approved',
      'tmp_dir_trust_denied',
      'tmp_dir_trust_revoked',
      'tmp_dir_trust_expired',
      'tmp_dir_trust_auto_approved',
      'tmp_dir_trust_scope_block',
      'host_command_proposed',
      'host_command_approved',
      'host_command_denied',
      'host_command_executed',
      'host_power_mode_enabled',
      'host_power_mode_disabled',
      'host_power_mode_expired',
      'pty_session_requested',
      'pty_session_approved',
      'pty_session_denied',
      'pty_session_started',
      'pty_session_terminated',
      'pty_session_expired',
      'pty_session_terminated_due_to_host_power_disabled',
      'pty_input_requested',
      'pty_input_approved',
      'pty_input_blocked',
      'pty_input_sent',
      'pty_output_truncated',
      'pty_policy_violation',
      'critical_pty_input_strong_confirmation_required',
      'critical_pty_input_strong_confirmation_failed',
      'critical_pty_input_strong_confirmation_passed'
    ];

    if (!validEvents.includes(payload.event)) {
      throw new Error(`Invalid workspace event: ${payload.event}`);
    }

    const metadata: Record<string, any> = {
      event: payload.event,
      workspaceId: this.sanitizeString(payload.workspaceId),
      timestamp: new Date().toISOString(),
    };

    if (payload.rootPath) {
      metadata.rootPathHash = this.hashId(payload.rootPath);
      metadata.rootPathSuffix = this.sanitizeString(this.getRootPathSuffix(payload.rootPath));
    } else {
      metadata.rootPathHash = payload.rootPathHash ? this.sanitizeString(payload.rootPathHash) : 'redacted';
      metadata.rootPathSuffix = payload.rootPathSuffix ? this.sanitizeString(payload.rootPathSuffix) : 'redacted';
    }

    if (payload.toolName) metadata.toolName = this.sanitizeString(payload.toolName);
    if (payload.decision) metadata.decision = payload.decision;
    if (payload.reason) metadata.reason = this.sanitizeString(payload.reason);
    if (payload.operation) metadata.operation = this.sanitizeString(payload.operation);
    if (payload.path) {
      metadata.pathHash = this.hashId(payload.path);
      metadata.pathSuffix = this.sanitizeString(this.getPathSuffix(payload.path));
    }

    if (payload.argsHash) metadata.argsHash = payload.argsHash;
    if (payload.exitCode !== undefined) metadata.exitCode = payload.exitCode;
    if (payload.durationMs !== undefined) metadata.durationMs = payload.durationMs;
    if (payload.timeoutFlag !== undefined) metadata.timeoutFlag = payload.timeoutFlag;
    if (payload.truncatedFlag !== undefined) metadata.truncatedFlag = payload.truncatedFlag;
    if (payload.riskLevel) metadata.riskLevel = payload.riskLevel;
    if (payload.commandHash) metadata.commandHash = payload.commandHash;
    if (payload.redactedCommandPreview) metadata.redactedCommandPreview = payload.redactedCommandPreview;
    if (payload.metadata) metadata.metadata = payload.metadata;
    const allowedKeys = [
      'event', 'workspaceId', 'rootPathHash', 'rootPathSuffix',
      'toolName', 'decision', 'reason', 'pathHash', 'pathSuffix',
      'operation', 'timestamp', 'argsHash', 'exitCode', 'durationMs',
      'timeoutFlag', 'truncatedFlag', 'riskLevel', 'commandHash',
      'redactedCommandPreview', 'metadata'
    ];

    this.validateKeys(metadata, allowedKeys);
    this.safePersist(payload.event, metadata);
  }
}
