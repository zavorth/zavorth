import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  type ZavorthAdbCommandResult,
  type ZavorthAdbRunner,
  ZavorthAndroidAdbBridgeService,
} from '@zavorth/hardware/ZavorthAndroidAdbBridgeService.js';

function ok(stdoutText = '', stdoutBytes: Buffer | null = null): ZavorthAdbCommandResult {
  return {
    ok: true,
    code: 0,
    stdoutText,
    stderrText: '',
    stdoutBytes,
    error: null,
  };
}

function fail(error: string): ZavorthAdbCommandResult {
  return {
    ok: false,
    code: 1,
    stdoutText: '',
    stderrText: error,
    stdoutBytes: null,
    error,
  };
}

function mockRunner(results: ZavorthAdbCommandResult[]): ZavorthAdbRunner & { run: jest.Mock } {
  return {
    run: jest.fn(() => results.shift() || fail('unexpected adb command')),
  };
}

describe('ZavorthAndroidAdbBridgeService', () => {
  it('builds read-only observe snapshots from provided Android evidence', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });

    const snapshot = await service.execute({
      action: 'device.observe',
      screenText: 'App screen open without secrets',
      uiXml: '<hierarchy><node text="CHECK" /></hierarchy>',
      sourceSurface: 'telegram',
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.policy.decision).toBe('allow_readonly');
    expect(snapshot.plan.mutationRequested).toBe(false);
    expect(snapshot.safety.readOnlyAdbOnlyWithoutApproval).toBe(true);
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('uses authorized ADB for live read-only observe and stores artifacts by reference', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-adb-test-'));
    const runner = mockRunner([
      ok('List of devices attached\nABC123 device product:redfin model:Pixel_5 transport_id:1\n'),
      ok('', Buffer.from('fake-png')),
      ok('UI hierchary dumped to: /sdcard/zavorth-window.xml'),
      ok('<hierarchy><node text="OK" /></hierarchy>'),
      ok('mCurrentFocus=Window{u0 com.example/.MainActivity}'),
    ]);
    const service = new ZavorthAndroidAdbBridgeService({ runner, artifactRoot: root });

    const snapshot = await service.execute({
      action: 'device.observe',
      live: true,
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.adb.readOnlyCommandsExecuted).toBe(5);
    expect(snapshot.adb.mutationCommandsExecuted).toBe(0);
    expect(snapshot.device.authorized).toBe(true);
    expect(snapshot.evidence.screenshot?.path).toContain(root);
    expect(snapshot.evidence.uiDump?.path).toContain(root);
    expect(snapshot.evidence.currentActivity).toContain('com.example/.MainActivity');
    expect(JSON.stringify(snapshot)).not.toContain('fake-png');
    expect(runner.run).toHaveBeenCalledWith(expect.arrayContaining(['devices', '-l']), expect.any(Object));
    expect(runner.run).toHaveBeenCalledWith(
      expect.arrayContaining(['exec-out', 'screencap', '-p']),
      expect.any(Object),
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('plans tap and type-text from structured fields only (approval-first)', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });

    const snapshot = await service.execute({
      action: 'device.plan',
      targetText: 'CHECK',
      payload: 'texto aprovado',
      // Free-text objective must not infer keyevent / swipe / install.
      objective: 'touch, type and press enter',
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.policy.decision).toBe('require_owner_approval');
    expect(snapshot.plan.approvalRequired).toBe(true);
    const kinds = snapshot.plan.steps.map((step) => step.kind);
    expect(kinds).toEqual(expect.arrayContaining(['tap', 'type-text']));
    expect(kinds).not.toContain('keyevent');
    expect(kinds).not.toContain('install');
    expect(snapshot.safety.tapSwipeTextKeyRequireApproval).toBe(true);
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('does not infer mutation steps from free-text objective alone', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });

    const snapshot = await service.execute({
      action: 'device.plan',
      // Free-text action words must not activate tap/type/key/install product steps.
      objective: 'touch the button, type the text, press enter and swipe',
    });

    const kinds = snapshot.plan.steps.map((step) => step.kind);
    expect(kinds).toEqual(expect.arrayContaining(['capture-screenshot', 'read-current-activity']));
    expect(kinds).not.toContain('tap');
    expect(kinds).not.toContain('type-text');
    expect(kinds).not.toContain('keyevent');
    expect(kinds).not.toContain('swipe');
    expect(kinds).not.toContain('install');
    expect(snapshot.safety.liveMutationPerformed).toBe(false);
  });

  it('plans keyevent only from structured action type enum', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });

    const snapshot = await service.execute({
      action: 'device.plan',
      // Structured action type — not free-text inference.
      deviceAction: 'key',
      payload: 'KEYCODE_ENTER',
    });

    expect(snapshot.plan.steps.map((step) => step.kind)).toEqual(expect.arrayContaining(['keyevent']));
    expect(snapshot.status).toBe('approval-required');
  });

  it('blocks install and uninstall via sensitive safety guardrail', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });

    const snapshot = await service.execute({
      action: 'device.plan',
      packageName: 'com.example.app',
      // SENSITIVE_RULES may still raise approval/block for install wording as a safety guardrail.
      objective: 'instalar apk no celular',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.policy.decision).toBe('deny');
    expect(snapshot.hardBlocks.risks).toContain('install-uninstall');
    expect(snapshot.safety.installUninstallBlockedByDefault).toBe(true);
  });

  it('redacts Android evidence and filters raw log secrets', async () => {
    const service = new ZavorthAndroidAdbBridgeService({ runner: mockRunner([]) });
    const secret = 'sk-' + 'androidAdbUnitSecret999';

    const snapshot = await service.execute({
      action: 'device.logcat',
      screenText: `token=abc123456789 ${secret}`,
      logcatText: ['I/App: visible status', 'I/App: password=abc123', 'I/App: done'].join('\n'),
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.status).toBe('redacted');
    expect(snapshot.policy.decision).toBe('allow_with_redaction');
    expect(snapshot.vision.redaction.applied).toBe(true);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('token=abc123456789');
    expect(serialized).not.toContain('password=abc123');
    expect(serialized).toContain('[redacted-secret]');
  });

  it('reports unauthorized devices without executing read-only capture', async () => {
    const runner = mockRunner([
      ok('List of devices attached\nABC123 unauthorized product:redfin model:Pixel_5 transport_id:1\n'),
    ]);
    const service = new ZavorthAndroidAdbBridgeService({ runner });

    const snapshot = await service.execute({
      action: 'device.doctor',
      live: true,
    });

    expect(snapshot.status).toBe('unauthorized');
    expect(snapshot.doctor.authorization).toBe('unauthorized');
    expect(snapshot.adb.readOnlyCommandsExecuted).toBe(1);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('returns USB/ADB setup guidance when live natural device use has no device', async () => {
    const service = new ZavorthAndroidAdbBridgeService({
      runner: mockRunner([ok('List of devices attached\n')]),
    });

    const snapshot = await service.execute({
      action: 'device.observe',
      live: true,
      objective: 'olhe meu celular',
    });
    const response = service.buildSurfaceResponse(snapshot);
    const serialized = JSON.stringify(response);

    expect(snapshot.status).toBe('no-device');
    expect(response.metadata?.setupRequired).toBe(true);
    expect(serialized).toContain('Set up connected phone');
    expect(serialized).toContain('/device android doctor');
  });
});
