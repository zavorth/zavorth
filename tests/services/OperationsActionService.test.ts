import { OperationsActionService } from '../../src/services/OperationsActionService';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

describe('OperationsActionService', () => {
  const logRepo = createTestLogRepo();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts a whitelisted action and persists a record', () => {
    const spawn = jest.fn(() => ({
      pid: 4123,
      unref: jest.fn(),
    }));
    const mkdirSync = jest.fn();
    const openSync = jest.fn(() => 77);
    const closeSync = jest.fn();
    const writeFileSync = jest.fn();
    const appendFileSync = jest.fn();

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-03-29T12:00:00.000Z'),
      mkdirSync: mkdirSync as any,
      openSync: openSync as any,
      closeSync: closeSync as any,
      writeFileSync: writeFileSync as any,
      appendFileSync: appendFileSync as any,
    });

    const result = service.execute('maintenance');

    expect(result.status).toBe('started');
    expect(result.pid).toBe(4123);
    expect(result.command).toContain('ops:maintain');
    expect(spawn).toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        stdio: ['ignore', 77, 77],
      }),
    );
    expect(writeFileSync).toHaveBeenCalled();
    expect(closeSync).toHaveBeenCalledWith(77);
    expect(appendFileSync).toHaveBeenCalled();
    expect(logRepo.log).toHaveBeenCalledWith(
      'info',
      'OperationsActionService',
      expect.stringContaining('Maintenance action started'),
      expect.any(Object),
    );
  });

  it('rejects unknown action ids', () => {
    const service = new OperationsActionService(logRepo, {
      spawn: jest.fn() as any,
    });

    expect(() => service.execute('unknown-action')).toThrow('Unknown operational action');
  });

  it('starts the node mesh validation action using the official smoke command', () => {
    const spawn = jest.fn(() => ({
      pid: 5124,
      unref: jest.fn(),
    }));

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-04-04T01:00:00.000Z'),
      mkdirSync: jest.fn() as any,
      openSync: jest.fn(() => 88) as any,
      closeSync: jest.fn() as any,
      writeFileSync: jest.fn() as any,
      appendFileSync: jest.fn() as any,
    });

    const result = service.execute('validate-node-mesh-smoke');

    expect(result.status).toBe('started');
    expect(result.priority).toBe('high');
    expect(result.command).toContain('test:nodes:smoke');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      ['run', 'test:nodes:smoke'],
      expect.objectContaining({
        detached: true,
      }),
    );
  });

  it('starts the wasm validation action using the official smoke command', () => {
    const spawn = jest.fn(() => ({
      pid: 7124,
      unref: jest.fn(),
    }));

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-04-04T01:05:00.000Z'),
      mkdirSync: jest.fn() as any,
      openSync: jest.fn(() => 89) as any,
      closeSync: jest.fn() as any,
      writeFileSync: jest.fn() as any,
      appendFileSync: jest.fn() as any,
    });

    const result = service.execute('validate-wasm-smoke');

    expect(result.status).toBe('started');
    expect(result.priority).toBe('high');
    expect(result.command).toContain('sandbox:wasm:smoke');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      ['run', 'sandbox:wasm:smoke'],
      expect.objectContaining({
        detached: true,
      }),
    );
  });

  it('starts the native channel provider validation action using the official smoke command', () => {
    const spawn = jest.fn(() => ({
      pid: 8124,
      unref: jest.fn(),
    }));

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-04-04T01:10:00.000Z'),
      mkdirSync: jest.fn() as any,
      openSync: jest.fn(() => 90) as any,
      closeSync: jest.fn() as any,
      writeFileSync: jest.fn() as any,
      appendFileSync: jest.fn() as any,
    });

    const result = service.execute('validate-channel-providers');

    expect(result.status).toBe('started');
    expect(result.priority).toBe('high');
    expect(result.command).toContain('test:channels:smoke');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      ['run', 'test:channels:smoke'],
      expect.objectContaining({
        detached: true,
      }),
    );
  });

  it('starts the remote transport validation action using the official smoke command', () => {
    const spawn = jest.fn(() => ({
      pid: 9124,
      unref: jest.fn(),
    }));

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-04-04T01:15:00.000Z'),
      mkdirSync: jest.fn() as any,
      openSync: jest.fn(() => 91) as any,
      closeSync: jest.fn() as any,
      writeFileSync: jest.fn() as any,
      appendFileSync: jest.fn() as any,
    });

    const result = service.execute('validate-remote-transports');

    expect(result.status).toBe('started');
    expect(result.priority).toBe('high');
    expect(result.command).toContain('test:transports:smoke');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      ['run', 'test:transports:smoke'],
      expect.objectContaining({
        detached: true,
      }),
    );
  });

  it('persists a failed_to_start record when spawn throws after opening the log fd', () => {
    const openSync = jest.fn(() => 81);
    const closeSync = jest.fn();
    const writeFileSync = jest.fn();
    const appendFileSync = jest.fn();
    const spawn = jest.fn(() => {
      throw new Error('spawn exploded');
    });

    const service = new OperationsActionService(logRepo, {
      spawn: spawn as any,
      now: () => new Date('2026-03-29T12:15:00.000Z'),
      mkdirSync: jest.fn() as any,
      openSync: openSync as any,
      closeSync: closeSync as any,
      writeFileSync: writeFileSync as any,
      appendFileSync: appendFileSync as any,
    });

    const result = service.execute('scheduled-maintenance');

    expect(result.status).toBe('failed_to_start');
    expect(result.note).toContain('spawn exploded');
    expect(writeFileSync).toHaveBeenCalled();
    expect(closeSync).toHaveBeenCalledWith(81);
    expect(logRepo.log).toHaveBeenCalledWith(
      'error',
      'OperationsActionService',
      expect.stringContaining('Failed to start scheduled-maintenance'),
    );
  });
});
