import path from 'path';
import { buildRuntimePathConfig } from '../../src/config/sections/runtimePathConfig.js';
import { buildWebRuntimeConfig } from '../../src/config/sections/webRuntimeConfig.js';

describe('secure runtime defaults', () => {
  const originalPort = process.env.PORT;
  const originalWebHost = process.env.ZAVORTH_WEB_HOST;
  const originalWorkspaceRoot = process.env.WORKSPACE_ROOT;
  const originalEchoBypass = process.env.ZAVORTH_ECHO_EDGE_ALLOW_LOOPBACK_AUTH_BYPASS;

  afterEach(() => {
    restoreEnv('PORT', originalPort);
    restoreEnv('ZAVORTH_WEB_HOST', originalWebHost);
    restoreEnv('WORKSPACE_ROOT', originalWorkspaceRoot);
    restoreEnv('ZAVORTH_ECHO_EDGE_ALLOW_LOOPBACK_AUTH_BYPASS', originalEchoBypass);
  });

  it('keeps the web runtime on loopback even when a platform supplies PORT', () => {
    delete process.env.ZAVORTH_WEB_HOST;
    process.env.PORT = '8080';
    const runtime = buildWebRuntimeConfig(path.resolve('C:/example/zavorth'));
    expect(runtime.zavorthWebHost).toBe('127.0.0.1');
    expect(runtime.zavorthWebPort).toBe(8080);
  });

  it('requires explicit opt-in for loopback auth bypass', () => {
    delete process.env.ZAVORTH_ECHO_EDGE_ALLOW_LOOPBACK_AUTH_BYPASS;
    expect(buildWebRuntimeConfig(path.resolve('C:/example/zavorth')).zavorthEchoEdgeAllowLoopbackAuthBypass).toBe(false);
    process.env.ZAVORTH_ECHO_EDGE_ALLOW_LOOPBACK_AUTH_BYPASS = 'true';
    expect(buildWebRuntimeConfig(path.resolve('C:/example/zavorth')).zavorthEchoEdgeAllowLoopbackAuthBypass).toBe(true);
  });

  it('limits the default workspace boundary to the project root', () => {
    delete process.env.WORKSPACE_ROOT;
    const projectRoot = path.resolve('C:/example/zavorth');
    expect(buildRuntimePathConfig(projectRoot, path.join(projectRoot, 'tunnel.json')).workspaceRoot).toBe(projectRoot);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
