import {
  ZavorthCloudSandboxAdapterService,
  type ZavorthCloudSandboxProviderId,
} from '../../src/services/ZavorthCloudSandboxAdapterService';

describe('ZavorthCloudSandboxAdapterService', () => {
  it('declares local, docker, cloud and external provider ids with cloud providers disabled by default', () => {
    const service = new ZavorthCloudSandboxAdapterService({ env: {} });

    const providers = service.listProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      'local',
      'local-docker',
      'daytona',
      'modal',
      'external',
    ]);
    expect(providers.find((provider) => provider.id === 'daytona')?.enabled).toBe(false);
    expect(providers.find((provider) => provider.id === 'modal')?.enabled).toBe(false);
  });

  it('blocks an explicitly selected cloud provider until it is enabled and credentialed', async () => {
    const service = new ZavorthCloudSandboxAdapterService({ env: {} });

    const result = await service.execute({
      provider: 'daytona',
      code: 'console.log("hello")',
      language: 'node',
    });

    expect(result.status).toBe('blocked');
    expect(result.provider).toBe('daytona');
    expect(result.message).toContain('disabled');
    expect(result.message).toContain('ZAVORTH_DAYTONA_SANDBOX_ENABLED=true');
  });

  it('strips secret-looking environment variables before cloud execution', async () => {
    let capturedEnv: Record<string, string> | undefined;
    const service = new ZavorthCloudSandboxAdapterService({
      env: {
        ZAVORTH_MODAL_SANDBOX_ENABLED: 'true',
        MODAL_TOKEN_ID: 'id',
        MODAL_TOKEN_SECRET: 'secret',
      },
      importer: async (moduleName) => {
        if (moduleName !== 'modal') {
          throw new Error(`unexpected import ${moduleName}`);
        }
        return {
          ModalClient: class {
            public apps = {
              fromName: async () => ({}),
            };
            public images = {
              fromRegistry: () => ({}),
            };
            public sandboxes = {
              create: async (_app: unknown, _image: unknown, options: { environment?: Record<string, string> }) => {
                capturedEnv = options.environment;
                return {
                  exec: async () => ({
                    stdout: { readText: async () => 'ok\n' },
                    stderr: { readText: async () => '' },
                    returncode: 0,
                  }),
                  terminate: async () => undefined,
                };
              },
            };
          },
        };
      },
    });

    const result = await service.execute({
      provider: 'modal',
      code: 'console.log(process.env.VISIBLE_NAME)',
      language: 'node',
      env: {
        VISIBLE_NAME: 'safe',
        OPENAI_API_KEY: 'sk-test-secret',
        SERVICE_TOKEN: 'secret-token',
        PASSWORD: 'secret-password',
      },
    });

    expect(result.status).toBe('completed');
    expect(capturedEnv).toEqual({ VISIBLE_NAME: 'safe' });
    expect(JSON.stringify(result)).not.toContain('sk-test-secret');
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('falls back to local-docker when an unrequested disabled cloud default is configured', async () => {
    const calls: ZavorthCloudSandboxProviderId[] = [];
    const service = new ZavorthCloudSandboxAdapterService({
      env: {
        ZAVORTH_SANDBOX_CLOUD_DEFAULT_PROVIDER: 'modal',
      },
      localDockerExecutor: async (input) => {
        calls.push(input.provider);
        return {
          stdout: 'local docker ok',
          stderr: '',
          exitCode: 0,
        };
      },
    });

    const result = await service.execute({
      code: 'console.log("hello")',
      language: 'node',
    });

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('local-docker');
    expect(result.stdout).toBe('local docker ok');
    expect(calls).toEqual(['local-docker']);
  });

  it('returns an actionable SDK installation message instead of throwing when a configured SDK is absent', async () => {
    const service = new ZavorthCloudSandboxAdapterService({
      env: {
        ZAVORTH_DAYTONA_SANDBOX_ENABLED: 'true',
        DAYTONA_API_KEY: 'daytona-secret',
      },
      importer: async () => {
        const error = new Error('Cannot find module');
        (error as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
        throw error;
      },
    });

    const result = await service.execute({
      provider: 'daytona',
      code: 'print("hello")',
      language: 'python',
    });

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('npm install @daytona/sdk');
    expect(JSON.stringify(result)).not.toContain('daytona-secret');
  });

  it('blocks external sandbox endpoints that would send code over remote HTTP', async () => {
    const service = new ZavorthCloudSandboxAdapterService({
      env: {
        ZAVORTH_EXTERNAL_SANDBOX_ENABLED: 'true',
        ZAVORTH_EXTERNAL_SANDBOX_ENDPOINT: 'http://sandbox.example.com/run',
      },
      fetcher: async () => {
        throw new Error('fetch should not run');
      },
    });

    const result = await service.execute({
      provider: 'external',
      code: 'console.log("hello")',
      language: 'node',
    });

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('HTTPS');
  });
});
