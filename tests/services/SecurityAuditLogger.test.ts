import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';
import { LogRepository } from '../../src/storage/LogRepository.js';

describe('SecurityAuditLogger', () => {
  let mockLogRepo: jest.Mocked<LogRepository>;
  let logger: SecurityAuditLogger;

  beforeEach(() => {
    mockLogRepo = {
      log: jest.fn(),
      init: jest.fn(),
      getRecentLogs: jest.fn(),
    } as unknown as jest.Mocked<LogRepository>;

    // Set a test hash key
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    logger = new SecurityAuditLogger(mockLogRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HMAC-SHA256 Hashing & Redaction', () => {
    it('should hash chatId and channelUserId with HMAC-SHA256 and include suffixes', () => {
      logger.logChannelAccessDecision({
        event: 'channel_message_accepted',
        decision: 'allowed',
        channel: 'whatsapp',
        chatId: '5511999999999@c.us',
        isGroup: false,
        channelUserId: '5511999999999',
        channelUserIdAllowed: true,
        triggerType: 'dm',
      });

      expect(mockLogRepo.log).toHaveBeenCalledTimes(1);
      const [level, category, event, metadata] = mockLogRepo.log.mock.calls[0];
      expect(level).toBe('security');
      expect(category).toBe('security_audit');
      expect(event).toBe('channel_message_accepted');

      // Check chatId hash and suffix
      expect(metadata.chatIdHash).toBeDefined();
      expect(metadata.chatIdHash).not.toBe('5511999999999@c.us');
      expect(metadata.chatIdHash).toHaveLength(64); // SHA-256 hex length
      expect(metadata.chatIdSuffix).toBe('@c.us');

      // Check channelUserId hash and suffix
      expect(metadata.channelUserIdHash).toBeDefined();
      expect(metadata.channelUserIdHash).not.toBe('5511999999999');
      expect(metadata.channelUserIdHash).toHaveLength(64);
      expect(metadata.channelUserIdSuffix).toBe('redacted');
    });

    it('should throw an error in production if ZAVORTH_AUDIT_HASH_KEY is missing', () => {
      delete process.env.ZAVORTH_AUDIT_HASH_KEY;
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => {
          logger.logChannelAccessDecision({
            event: 'channel_message_accepted',
            decision: 'allowed',
            channel: 'whatsapp',
            chatId: '5511999999999@c.us',
            isGroup: false,
            channelUserId: '5511999999999',
            channelUserIdAllowed: true,
            triggerType: 'dm',
          });
        }).toThrow('ZAVORTH_AUDIT_HASH_KEY environment variable is required in production.');
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });

  describe('Runtime Validation & Defenses', () => {
    it('should reject extra payload keys', () => {
      expect(() => {
        logger.logChannelAccessDecision({
          event: 'channel_message_accepted',
          decision: 'allowed',
          channel: 'whatsapp',
          chatId: '5511999999999@c.us',
          isGroup: false,
          channelUserId: '5511999999999',
          channelUserIdAllowed: true,
          triggerType: 'dm',
          extraKey: 'not-allowed',
        } as any);
      }).toThrow('Unexpected key "extraKey" detected in audit event metadata.');
    });

    it('should reject forbidden payload keys', () => {
      expect(() => {
        logger.logChannelAccessDecision({
          event: 'channel_message_accepted',
          decision: 'allowed',
          channel: 'whatsapp',
          chatId: '5511999999999@c.us',
          isGroup: false,
          channelUserId: '5511999999999',
          channelUserIdAllowed: true,
          triggerType: 'dm',
          messageBody: 'should not be logged',
        } as any);
      }).toThrow('Forbidden key "messageBody" detected in audit event metadata.');
    });

    it('should reject string values exceeding 128 characters', () => {
      expect(() => {
        logger.logChannelAccessDecision({
          event: 'channel_message_accepted',
          decision: 'allowed',
          channel: 'whatsapp',
          chatId: 'a'.repeat(129),
          isGroup: false,
          channelUserId: '5511999999999',
          channelUserIdAllowed: true,
          triggerType: 'dm',
        });
      }).toThrow('Payload field "chatId" exceeds maximum length of 128 characters.');
    });

    it('should reject newlines and control characters in strings', () => {
      expect(() => {
        logger.logChannelAccessDecision({
          event: 'channel_message_accepted',
          decision: 'allowed',
          channel: 'whatsapp',
          chatId: '5511999999999@c.us\n',
          isGroup: false,
          channelUserId: '5511999999999',
          channelUserIdAllowed: true,
          triggerType: 'dm',
        });
      }).toThrow('Payload field "chatId" contains forbidden newline or control characters.');
    });

    it('should validate namespacedToolId format', () => {
      expect(() => {
        logger.logMcpRuntimeEvent({
          event: 'mcp_tool_pending',
          serverId: 'my-server',
          toolName: 'echo',
          namespacedToolId: 'invalid-no-colon',
          fingerprint: 'abcd',
          pendingReason: 'new_tool',
        });
      }).toThrow('Invalid namespacedToolId format: invalid-no-colon');
    });

    it('should validate serverId format', () => {
      expect(() => {
        logger.logMcpRuntimeEvent({
          event: 'mcp_tool_pending',
          serverId: 'invalid server name with spaces',
          toolName: 'echo',
          namespacedToolId: 'my-server:echo',
          fingerprint: 'abcd',
          pendingReason: 'new_tool',
        });
      }).toThrow('Invalid serverId format: invalid server name with spaces');
    });
  });

  describe('LogRepository Error Fallback', () => {
    it('should catch database failure and log safe message to console.error without leaking metadata', () => {
      mockLogRepo.log.mockImplementation(() => {
        throw new Error('Database disk full');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        logger.logChannelAccessDecision({
          event: 'channel_message_accepted',
          decision: 'allowed',
          channel: 'whatsapp',
          chatId: '5511999999999@c.us',
          isGroup: false,
          channelUserId: '5511999999999',
          channelUserIdAllowed: true,
          triggerType: 'dm',
        });
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SecurityAuditLogger] Failed to persist security audit event: DB error.'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Audited Events Scenarios', () => {
    it('should log blocked message in group chat (no trigger)', () => {
      logger.logChannelAccessDecision({
        event: 'channel_message_blocked',
        decision: 'blocked',
        channel: 'whatsapp',
        chatId: '120363200000000000@g.us',
        isGroup: true,
        channelUserId: '5511999999999',
        channelUserIdAllowed: false,
        reason: 'group_message_without_trigger',
        triggerType: 'none',
      });

      expect(mockLogRepo.log).toHaveBeenCalledWith(
        'security',
        'security_audit',
        'channel_message_blocked',
        expect.objectContaining({
          event: 'channel_message_blocked',
          decision: 'blocked',
          channel: 'whatsapp',
          isGroup: true,
          reason: 'group_message_without_trigger',
          triggerType: 'none',
        })
      );
    });

    it('should log tool exposure blocked (unauthorized-user-in-group)', () => {
      logger.logToolExposureDecision({
        event: 'tool_exposure_decision',
        decision: 'blocked',
        toolName: 'filesystem.write',
        risk: 'danger',
        reason: 'unauthorized-user-in-group',
        channelUserIdAllowed: false,
      });

      expect(mockLogRepo.log).toHaveBeenCalledWith(
        'security',
        'security_audit',
        'tool_exposure_decision',
        expect.objectContaining({
          event: 'tool_exposure_decision',
          decision: 'blocked',
          toolName: 'filesystem.write',
          risk: 'danger',
          reason: 'unauthorized-user-in-group',
          channelUserIdAllowed: false,
        })
      );
    });

    it('should log MCP discovery, drift and CLI actions', () => {
      logger.logMcpRuntimeEvent({
        event: 'mcp_tool_pending',
        serverId: 'fs-server',
        toolName: 'read_file',
        namespacedToolId: 'fs-server:read_file',
        fingerprint: 'fingerprint-abc',
        pendingReason: 'new_tool',
      });

      expect(mockLogRepo.log).toHaveBeenLastCalledWith(
        'security',
        'security_audit',
        'mcp_tool_pending',
        expect.objectContaining({
          event: 'mcp_tool_pending',
          serverId: 'fs-server',
          namespacedToolId: 'fs-server:read_file',
          pendingReason: 'new_tool',
        })
      );

      logger.logCliAdminEvent({
        event: 'mcp_tool_approved',
        actor: 'local-cli',
        source: 'zavorth-mcp-install',
        toolId: 'fs-server:read_file',
        previousStatus: 'pending_approval',
        newStatus: 'approved',
        fingerprint: 'fingerprint-abc',
        allowlistChanged: true,
      });

      expect(mockLogRepo.log).toHaveBeenLastCalledWith(
        'security',
        'security_audit',
        'mcp_tool_approved',
        expect.objectContaining({
          event: 'mcp_tool_approved',
          toolId: 'fs-server:read_file',
          newStatus: 'approved',
        })
      );
    });

    it('should log workspace events and handle raw paths (>128 chars) safely', () => {
      const longRootPath = 'C:\\very\\long\\directory\\path\\that\\exceeds\\one\\hundred\\and\\twenty\\eight\\characters\\to\\test\\safe\\validation\\limits\\and\\avoid\\throwing\\errors';
      const longFilePath = 'C:\\very\\long\\directory\\path\\that\\exceeds\\one\\hundred\\and\\twenty\\eight\\characters\\to\\test\\safe\\validation\\limits\\and\\avoid\\throwing\\errors\\somefile.txt';

      logger.logWorkspaceEvent({
        event: 'workspace_git_read',
        workspaceId: 'my-ws-session',
        rootPath: longRootPath,
        toolName: 'workspace_git_status',
        decision: 'allowed',
        path: longFilePath,
        operation: 'git-status',
      });

      expect(mockLogRepo.log).toHaveBeenLastCalledWith(
        'security',
        'security_audit',
        'workspace_git_read',
        expect.objectContaining({
          event: 'workspace_git_read',
          workspaceId: 'my-ws-session',
          rootPathSuffix: 'errors',
          pathSuffix: '.txt',
        })
      );

      // Verify that raw path and rootPath are NOT in metadata, only hashes/suffixes
      const loggedMetadata = mockLogRepo.log.mock.calls[mockLogRepo.log.mock.calls.length - 1][3];
      expect(loggedMetadata.rootPath).toBeUndefined();
      expect(loggedMetadata.path).toBeUndefined();
      expect(loggedMetadata.rootPathHash).toBeDefined();
      expect(loggedMetadata.pathHash).toBeDefined();
    });

    it('should fall back to redacted/precomputed rootPathHash and rootPathSuffix if rootPath is missing', () => {
      logger.logWorkspaceEvent({
        event: 'workspace_tool_blocked',
        workspaceId: 'my-ws-session',
        rootPathHash: 'precomputed-hash-123',
        rootPathSuffix: 'my-suffix',
        toolName: 'workspace_git_status',
        decision: 'blocked',
        reason: 'permission-denied',
      });

      expect(mockLogRepo.log).toHaveBeenLastCalledWith(
        'security',
        'security_audit',
        'workspace_tool_blocked',
        expect.objectContaining({
          event: 'workspace_tool_blocked',
          workspaceId: 'my-ws-session',
          rootPathHash: 'precomputed-hash-123',
          rootPathSuffix: 'my-suffix',
          toolName: 'workspace_git_status',
          decision: 'blocked',
          reason: 'permission-denied',
        })
      );
    });

    it('should reject raw paths containing carriage returns or newlines', () => {
      expect(() => {
        logger.logWorkspaceEvent({
          event: 'workspace_git_read',
          workspaceId: 'session',
          rootPath: 'C:\\path\r\nwith\\newlines',
        });
      }).toThrow('Path field contains forbidden newline or control characters.');
    });
  });
});
