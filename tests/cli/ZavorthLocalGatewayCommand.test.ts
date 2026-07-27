import readline from 'readline/promises';
import { runZavorthLocalGatewayCommand } from '../../src/cli/ZavorthLocalGatewayCommand.js';
import { SlackGateway } from '../../src/gateways/channels/slack/SlackGateway.js';

jest.mock('../../src/storage/Database.js', () => ({
  Database: {
    getInstance: jest.fn().mockResolvedValue({
      run: jest.fn(),
      prepare: jest.fn().mockReturnValue({ run: jest.fn(), get: jest.fn(), all: jest.fn() }),
    }),
    getActiveInstance: jest.fn().mockReturnValue({
      run: jest.fn(),
      prepare: jest.fn().mockReturnValue({ run: jest.fn(), get: jest.fn(), all: jest.fn() }),
    }),
  },
}));

jest.mock('../../src/cli/ZavorthCliCommandHelpers.js', () => ({
  buildCliRuntimeFromOverrides: jest.fn().mockResolvedValue({
    agentGateway: {
      handle: jest.fn().mockResolvedValue({ ok: true, output: 'Mocked reply' }),
    },
    commandService: {
      handleCommand: jest.fn().mockResolvedValue({ status: 'not_handled' }),
    },
    surfaceTaskDispatcher: {
      dispatchTaskMessage: jest.fn().mockResolvedValue(undefined),
    },
  }),
}));

describe('runZavorthLocalGatewayCommand', () => {
  let createInterfaceSpy: jest.SpyInstance;
  let stdoutWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the Slack local gateway simulation and handles exit cleanly', async () => {
    const questionMock = jest.fn()
      .mockResolvedValueOnce('hello sovereign')
      .mockResolvedValueOnce('exit');

    const closeMock = jest.fn();

    createInterfaceSpy = jest.spyOn(readline, 'createInterface').mockReturnValue({
      question: questionMock,
      close: closeMock,
    } as any);

    // Spy on SlackGateway start and stop
    const startSpy = jest.spyOn(SlackGateway.prototype, 'start').mockResolvedValue(undefined);
    const stopSpy = jest.spyOn(SlackGateway.prototype, 'stop').mockResolvedValue(undefined);

    const exitCode = await runZavorthLocalGatewayCommand(['--channel=slack', '--userId=tester']);

    expect(exitCode).toBe(0);
    expect(startSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(questionMock).toHaveBeenCalledTimes(2);
    expect(closeMock).toHaveBeenCalled();

    // Verify printed outputs
    const printed = stdoutWriteSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(printed).toContain('Offline Gateway Mock REPL');
    expect(printed).toContain('SLACK');
  });

  it('fails when unsupported channel is passed', async () => {
    const exitCode = await runZavorthLocalGatewayCommand(['--channel=unsupported_channel']);
    expect(exitCode).toBe(1);
  });
});
