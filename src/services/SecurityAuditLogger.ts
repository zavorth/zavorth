import { LogRepository } from '../storage/LogRepository.js';
import crypto from 'crypto';

export class SecurityAuditLogger {
  private readonly logRepo: LogRepository;

  constructor(logRepo?: LogRepository) {
    this.logRepo = logRepo || new LogRepository();
  }

  // HMAC-SHA256 hashing using the local key ZAVORTH_AUDIT_HASH_KEY or secure fallback
  private hashId(id: string): string {
    const key = process.env.ZAVORTH_AUDIT_HASH_KEY || 'default-zavorth-audit-key-please-change-in-production';
    return crypto.createHmac('sha256', key).update(id).digest('hex');
  }

  private getSuffix(id: string): string {
    const cleanId = id.trim();
    if (cleanId.length <= 4) return cleanId;
    return cleanId.slice(-4);
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
}
