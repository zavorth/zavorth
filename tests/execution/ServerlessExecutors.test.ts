import { ModalExecutor } from './stubs/ModalExecutor';
import { DaytonaExecutor } from './stubs/DaytonaExecutor';
import { ExecutionRequest } from '../../src/contracts/ExecutionContract';

describe('Serverless Executors', () => {
  describe('ModalExecutor', () => {
    it('handles dry run execution correctly', async () => {
      const executor = new ModalExecutor();
      const request: ExecutionRequest = {
        execution_id: 'test-exec-id',
        task_id: 'task-1',
        executor: 'modal',
        workspace: 'test-workspace',
        objective: 'Test dry-run',
        instructions: ['echo "hello"'],
        allowed_paths: [],
        blocked_paths: [],
        allowed_commands: [],
        blocked_commands: [],
        timeout_seconds: 30,
        dry_run: true,
        requires_backup: false,
        metadata: {},
      };

      const result = await executor.execute(request);
      expect(result.success).toBe(true);
      expect(result.metadata.dry_run).toBe(true);
    });

    it('executes instructions through sandbox adapter successfully', async () => {
      const mockAdapter = {
        execute: jest.fn().mockResolvedValue({
          stdout: 'modal stdout',
          stderr: '',
          status: 'completed',
          exitCode: 0,
        }),
        listProviders: jest.fn(),
      };

      const executor = new ModalExecutor(mockAdapter as any);
      const request: ExecutionRequest = {
        execution_id: 'test-exec-id',
        task_id: 'task-1',
        executor: 'modal',
        workspace: 'test-workspace',
        objective: 'Test execution',
        instructions: ['echo "run modal"', 'node -v'],
        allowed_paths: [],
        blocked_paths: [],
        allowed_commands: [],
        blocked_commands: [],
        timeout_seconds: 30,
        dry_run: false,
        requires_backup: false,
        metadata: {},
      };

      const result = await executor.execute(request);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('modal stdout');
      expect(result.stderr).toBe('');
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'modal',
          code: 'echo "run modal"\nnode -v',
          language: 'bash',
        })
      );
    });

    it('reports availability based on provider configuration', async () => {
      const mockAdapter = {
        execute: jest.fn(),
        listProviders: jest.fn().mockReturnValue([
          { id: 'modal', enabled: true },
          { id: 'daytona', enabled: false },
        ]),
      };

      const executor = new ModalExecutor(mockAdapter as any);
      const available = await executor.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('DaytonaExecutor', () => {
    it('handles dry run execution correctly', async () => {
      const executor = new DaytonaExecutor();
      const request: ExecutionRequest = {
        execution_id: 'test-exec-id',
        task_id: 'task-1',
        executor: 'daytona',
        workspace: 'test-workspace',
        objective: 'Test dry-run',
        instructions: ['echo "hello"'],
        allowed_paths: [],
        blocked_paths: [],
        allowed_commands: [],
        blocked_commands: [],
        timeout_seconds: 30,
        dry_run: true,
        requires_backup: false,
        metadata: {},
      };

      const result = await executor.execute(request);
      expect(result.success).toBe(true);
      expect(result.metadata.dry_run).toBe(true);
    });

    it('executes instructions through sandbox adapter successfully', async () => {
      const mockAdapter = {
        execute: jest.fn().mockResolvedValue({
          stdout: 'daytona stdout',
          stderr: 'some warning',
          status: 'completed',
          exitCode: 0,
        }),
        listProviders: jest.fn(),
      };

      const executor = new DaytonaExecutor(mockAdapter as any);
      const request: ExecutionRequest = {
        execution_id: 'test-exec-id',
        task_id: 'task-1',
        executor: 'daytona',
        workspace: 'test-workspace',
        objective: 'Test execution',
        instructions: ['echo "run daytona"'],
        allowed_paths: [],
        blocked_paths: [],
        allowed_commands: [],
        blocked_commands: [],
        timeout_seconds: 30,
        dry_run: false,
        requires_backup: false,
        metadata: {},
      };

      const result = await executor.execute(request);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('daytona stdout');
      expect(result.stderr).toBe('some warning');
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'daytona',
          code: 'echo "run daytona"',
          language: 'bash',
        })
      );
    });

    it('reports availability based on provider configuration', async () => {
      const mockAdapter = {
        execute: jest.fn(),
        listProviders: jest.fn().mockReturnValue([
          { id: 'modal', enabled: false },
          { id: 'daytona', enabled: false },
        ]),
      };

      const executor = new DaytonaExecutor(mockAdapter as any);
      const available = await executor.isAvailable();
      expect(available).toBe(false);
    });
  });
});
