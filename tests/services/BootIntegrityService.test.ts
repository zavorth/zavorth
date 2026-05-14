import fs from 'fs';
import os from 'os';
import path from 'path';

import { BootIntegrityService } from '../../src/services/BootIntegrityService.js';

describe('BootIntegrityService', () => {
  function createBootRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-boot-'));
    const dataDir = path.join(root, 'data');
    const tmpDir = path.join(root, 'tmp');
    const runtimeDir = path.join(dataDir, 'runtime');
    const configDir = path.join(root, 'config');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'platform-registry.json'), '{"platforms":[]}', 'utf8');
    fs.writeFileSync(path.join(configDir, 'mcp-servers.json'), '{"servers":[]}', 'utf8');
    fs.writeFileSync(path.join(runtimeDir, 'dashboard-runtime.json'), '{"status":"ready"}', 'utf8');

    return {
      root,
      config: {
        projectRoot: root,
        dataDir,
        tmpDir,
        dbPath: path.join(dataDir, 'zavorth.db'),
        telemetryEventsFile: path.join(runtimeDir, 'telemetry-events.jsonl'),
        dashboardRuntimeStateFile: path.join(runtimeDir, 'dashboard-runtime.json'),
        workflowRunDir: path.join(runtimeDir, 'workflow-runs'),
        gatewaySessionLedgerDir: path.join(runtimeDir, 'gateway-session-ledger'),
        hostIdentityFile: path.join(runtimeDir, 'authorized-host.json'),
        platformRegistryCatalogFile: path.join(configDir, 'platform-registry.json'),
        mcpServersManifestPath: path.join(configDir, 'mcp-servers.json'),
      },
    };
  }

  it('repairs missing critical directories without starting external runtime', () => {
    const fixture = createBootRoot();
    const service = new BootIntegrityService({
      config: fixture.config,
      now: () => new Date('2026-04-24T10:00:00.000Z'),
    });

    const snapshot = service.inspect({ repair: true });

    expect(snapshot.phase).toBe('35');
    expect(snapshot.contracts).toEqual(expect.objectContaining({
      noExternalNetwork: true,
      startsBackgroundProcesses: false,
      canRepairDirectories: true,
    }));
    expect(snapshot.summary.failures).toBe(0);
    expect(snapshot.summary.repaired).toBeGreaterThanOrEqual(2);
    expect(fs.existsSync(fixture.config.workflowRunDir)).toBe(true);
    expect(fs.existsSync(fixture.config.gatewaySessionLedgerDir)).toBe(true);
  });

  it('blocks boot when required config files are missing or invalid', () => {
    const fixture = createBootRoot();
    fs.writeFileSync(fixture.config.mcpServersManifestPath, '{bad json', 'utf8');
    const service = new BootIntegrityService({ config: fixture.config });

    const snapshot = service.inspect({ repair: true });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mcp-manifest',
          status: 'fail',
        }),
      ]),
    );
  });

  it('keeps lazy runtime files as warnings instead of hard boot failures', () => {
    const fixture = createBootRoot();
    fs.rmSync(fixture.config.dashboardRuntimeStateFile);
    const service = new BootIntegrityService({ config: fixture.config });

    const snapshot = service.inspect({ repair: true });

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.summary.failures).toBe(0);
    expect(snapshot.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dashboard-runtime-state',
          status: 'warn',
        }),
        expect.objectContaining({
          id: 'telemetry-jsonl',
          status: 'warn',
        }),
      ]),
    );
  });
});
