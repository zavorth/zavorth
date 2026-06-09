import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZavorthSkillPreprocessorService,
  SecurityPolicyViolationError,
} from '../../src/skills/ZavorthSkillPreprocessorService.js';
import { decideSecurityPolicy } from '../../src/security/SecurityPolicyBroker.js';
import type { Database } from '../../src/storage/Database.js';
import type { SkillMetadata } from '../../src/skills/SkillCatalogContract.js';

// Mock the SecurityPolicyBroker
jest.mock('../../src/security/SecurityPolicyBroker.js', () => ({
  decideSecurityPolicy: jest.fn(),
}));

describe('ZavorthSkillPreprocessorService', () => {
  const mockDecide = decideSecurityPolicy as jest.MockedFunction<typeof decideSecurityPolicy>;
  let mockDatabase: jest.Mocked<Database>;
  const tempDir = path.resolve('tests/skills/temp-preprocess-test');
  const skillFilePath = path.join(tempDir, 'SKILL.md');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up a mock database instance
    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
      close: jest.fn(),
      getRawDb: jest.fn(),
    } as unknown as jest.Mocked<Database>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Instance Method Preprocessor (New Signature)', () => {
    describe('Happy Path', () => {
      it('returns unmodified content if no variables, frontmatter or commands are present', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
        });

        const input = {
          content: '# Simple Skill\nThis is a skill with basic instruction text.',
          sessionId: 'session-123',
          actorId: 'actor-456',
          skillName: 'simple-skill',
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toBe(input.content);
        expect(result.executedCommands).toEqual([]);
      });
    });

    describe('Variable Substitution', () => {
      it('substitutes project root, session ID and actor ID in the content', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
        });

        const content = [
          '# Variable Test',
          'Project: ${ZAVORTH_PROJECT_ROOT}',
          'Session: ${ZAVORTH_SESSION_ID}',
          'Actor: ${ZAVORTH_ACTOR_ID}',
        ].join('\n');

        const input = {
          content,
          sessionId: 'test-session',
          actorId: 'test-actor',
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toContain('Project: /test/root');
        expect(result.content).toContain('Session: test-session');
        expect(result.content).toContain('Actor: test-actor');
      });
    });

    describe('YAML Config Resolution', () => {
      it('parses frontmatter and resolves keys from config and database, then injects the capability config block', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
        });

        // Mock DB calls for config keys:
        // - 'user.theme' is in state meta
        // - 'user.mode' is in user memory
        // - 'user.missing' is not found
        mockDatabase.get.mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('zavorth_state_meta') && params?.[0] === 'user.theme') {
            return { value_json: '"dark"' };
          }
          if (sql.includes('user_memory') && params?.[1] === 'user.mode') {
            return { value: 'custom-operator' };
          }
          return undefined;
        });

        const content = [
          '---',
          'name: test-config',
          'config_keys:',
          '  - executionHost.timeout', // Resolves from central config (1024 / fallback)
          '  - user.theme',            // Resolves from state_meta
          '  - user.mode',             // Resolves from user_memory
          '  - user.missing',          // Resolves to null (missing)
          '---',
          '# Skill content starts here',
        ].join('\n');

        const input = {
          content,
          sessionId: 'session-123',
          actorId: 'actor-456',
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toContain('---');
        expect(result.content).toContain('name: test-config');
        expect(result.content).toContain('[Zavorth Capability Config:');
        // Resolved from central config defaultConfig (executionHost is built dynamically)
        expect(result.content).toContain('executionHost.timeout:');
        // Resolved from state meta
        expect(result.content).toContain('user.theme: dark');
        // Resolved from user memory
        expect(result.content).toContain('user.mode: custom-operator');
        // Unresolved key
        expect(result.content).toContain('user.missing: null');
        expect(result.content).toContain('# Skill content starts here');
      });
    });

    describe('Command Validation and Evaluation', () => {
      it('executes command when allowed by security policy and replaces inline token with output', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: process.cwd(), // use real working dir for executing echo
          database: mockDatabase,
        });

        // Mock security policy to allow the command
        mockDecide.mockReturnValue({
          allowed: true,
          action: 'allow',
          rule: 'BROKER_ALLOW',
          reasons: [],
          profile: { id: 'safe', label: 'Safe', source: 'test' },
          redactionApplied: false,
          riskBlocked: false,
          requiresUserConfirmation: false,
          requiresAdminPolicy: false,
          receipt: {} as any,
        });

        const content = 'Output is: #[z_eval: node -e "console.log(\'preprocessed command outcome\')"]';
        const input = {
          content,
          sessionId: 'session-abc',
          actorId: 'actor-xyz',
          skillName: 'eval-skill',
          sourcePath: '/path/to/skill',
          provenance: { imported: false },
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toBe('Output is: preprocessed command outcome');
        expect(result.executedCommands).toHaveLength(1);
        expect(result.executedCommands[0]).toEqual({
          command: 'node -e "console.log(\'preprocessed command outcome\')"',
          allowed: true,
          output: 'preprocessed command outcome',
        });

        // Verify broker call metadata
        expect(mockDecide).toHaveBeenCalledWith({
          surface: 'skill',
          operation: 'governed-capability-eval',
          target: 'node -e "console.log(\'preprocessed command outcome\')"',
          metadata: {
            sessionId: 'session-abc',
            actorId: 'actor-xyz',
            skillName: 'eval-skill',
            sourcePath: '/path/to/skill',
            provenance: { imported: false },
          },
        });
      });

      it('throws SecurityPolicyViolationError when execution is denied by broker in strict mode', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
          strictSecurity: true, // Default
        });

        // Mock security policy to block the command
        mockDecide.mockReturnValue({
          allowed: false,
          action: 'deny',
          rule: 'BROKER_DENY',
          reasons: ['Command target is untrusted'],
          profile: { id: 'strict', label: 'Strict', source: 'test' },
          redactionApplied: false,
          riskBlocked: true,
          requiresUserConfirmation: false,
          requiresAdminPolicy: false,
          receipt: {} as any,
        });

        const content = 'Command: #[z_eval: rm -rf /]';
        const input = {
          content,
          sessionId: 'session-abc',
          actorId: 'actor-xyz',
        };

        await expect(preprocessor.preprocess(input)).rejects.toThrow(SecurityPolicyViolationError);
      });

      it('injects blocked placeholder instead of throwing when strictSecurity is disabled', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
          strictSecurity: false,
        });

        mockDecide.mockReturnValue({
          allowed: false,
          action: 'deny',
          rule: 'BROKER_DENY',
          reasons: ['Command target is forbidden'],
          profile: { id: 'strict', label: 'Strict', source: 'test' },
          redactionApplied: false,
          riskBlocked: true,
          requiresUserConfirmation: false,
          requiresAdminPolicy: false,
          receipt: {} as any,
        });

        const content = 'Command: #[z_eval: rm -rf /]';
        const input = {
          content,
          sessionId: 'session-abc',
          actorId: 'actor-xyz',
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toBe('Command: [Blocked: command execution denied by security policy]');
        expect(result.executedCommands).toHaveLength(1);
        expect(result.executedCommands[0].allowed).toBe(false);
        expect(result.executedCommands[0].error).toContain('Blocked by security policy');
      });

      it('gracefully captures syntax/execution errors of allowed commands and replaces with error token', async () => {
        const preprocessor = new ZavorthSkillPreprocessorService({
          projectRoot: '/test/root',
          database: mockDatabase,
        });

        mockDecide.mockReturnValue({
          allowed: true,
          action: 'allow',
          rule: 'BROKER_ALLOW',
          reasons: [],
          profile: { id: 'safe', label: 'Safe', source: 'test' },
          redactionApplied: false,
          riskBlocked: false,
          requiresUserConfirmation: false,
          requiresAdminPolicy: false,
          receipt: {} as any,
        });

        // Execute non-existent command to trigger syntax error
        const content = 'Result: #[z_eval: non_existent_cmd_xyz_abc]';
        const input = {
          content,
          sessionId: 'session-1',
          actorId: 'actor-2',
          provenance: { imported: false },
        };

        const result = await preprocessor.preprocess(input);

        expect(result.content).toContain('Result: [Error:');
        expect(result.executedCommands).toHaveLength(1);
        expect(result.executedCommands[0].allowed).toBe(true);
        expect(result.executedCommands[0].error).toBeDefined();
      });
    });
  });

  describe('Static Backwards Compatibility Layer', () => {
    it('replaces dynamic template variables', () => {
      const mockSkill: SkillMetadata = {
        name: 'test-skill',
        description: 'Test Description',
        dirPath: tempDir,
        skillFilePath: skillFilePath,
        supportFilePaths: []
      };

      const content = 'Root: ${ZAVORTH_PROJECT_ROOT}, Session: ${ZAVORTH_SESSION_ID}, Actor: ${ZAVORTH_ACTOR_ID}';
      const processed = ZavorthSkillPreprocessorService.preprocess({
        content,
        skill: mockSkill,
        projectRoot: '/workspace/project',
        sessionId: 'sess-123',
        actorId: 'actor-456'
      });

      expect(processed).toBe('Root: /workspace/project, Session: sess-123, Actor: actor-456');
    });

    it('binds configurations from frontmatter', () => {
      const yamlContent = [
        '---',
        'name: test-skill',
        'metadata:',
        '  zavorth:',
        '    config:',
        '      - key: "db.connection"',
        '        default: "sqlite://local.db"',
        '      - key: "api.timeout"',
        '        default: "3000"',
        '---',
        'Skill body goes here.'
      ].join('\n');

      fs.writeFileSync(skillFilePath, yamlContent, 'utf8');

      const mockSkill: SkillMetadata = {
        name: 'test-skill',
        description: 'Test Description',
        dirPath: tempDir,
        skillFilePath: skillFilePath,
        supportFilePaths: [],
        provenance: {
          imported: false,
          sourceId: 'local',
          sourceTrust: 'trusted'
        } as any
      };

      process.env.ZAVORTH_CONFIG_DB_CONNECTION = 'postgres://prod-db';

      const processed = ZavorthSkillPreprocessorService.preprocess({
        content: 'Skill body goes here.',
        skill: mockSkill,
        projectRoot: '/workspace/project'
      });

      delete process.env.ZAVORTH_CONFIG_DB_CONNECTION;

      expect(processed).toContain('[Zavorth Capability Config:');
      expect(processed).toContain('db.connection = postgres://prod-db');
      expect(processed).toContain('api.timeout = 3000');
    });

    it('blocks inline evaluation for untrusted capabilities', () => {
      const mockSkill: SkillMetadata = {
        name: 'untrusted-skill',
        description: 'Untrusted Description',
        dirPath: tempDir,
        skillFilePath: skillFilePath,
        supportFilePaths: [],
        provenance: {
          imported: true,
          sourceId: 'external',
          sourceTrust: 'untrusted-content'
        } as any
      };

      const content = 'Execute #[z_eval: echo "unsafe"]';
      const processed = ZavorthSkillPreprocessorService.preprocess({
        content,
        skill: mockSkill,
        projectRoot: '/workspace/project'
      });

      expect(processed).toContain('Execute [Zavorth capability evaluation blocked: untrusted source]');
    });

    it('runs inline commands on trusted capabilities when allowed by policy', () => {
      const mockSkill: SkillMetadata = {
        name: 'trusted-skill',
        description: 'Trusted Description',
        dirPath: tempDir,
        skillFilePath: skillFilePath,
        supportFilePaths: [],
        provenance: {
          imported: false,
          sourceId: 'local',
          sourceTrust: 'trusted'
        } as any
      };

      // Mock security policy to allow the command
      mockDecide.mockReturnValue({
        allowed: true,
        action: 'allow',
        reasons: [],
        profile: { id: 'safe', label: 'Safe', source: 'test' },
        redactionApplied: false,
        riskBlocked: false,
        requiresUserConfirmation: false,
        requiresAdminPolicy: false,
        receipt: {} as any,
      });

      const content = 'Result of echo: #[z_eval: echo hello world]';
      const processed = ZavorthSkillPreprocessorService.preprocess({
        content,
        skill: mockSkill,
        projectRoot: '/workspace/project'
      });

      expect(processed).toContain('Result of echo:');
      expect(processed).toContain('hello world');
    });
  });
});
