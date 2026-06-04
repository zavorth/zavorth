import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthNativeCapabilityCertificationService } from '../../src/services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthXaiRuntimeService } from '../../src/services/ZavorthXaiRuntimeService.js';

describe('ZavorthNativeCapabilityCertificationService', () => {
  let evidenceRoot: string;

  beforeEach(() => {
    evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-evidence-fixture-'));
    seedEvidenceFixture(evidenceRoot);
  });

  afterEach(() => {
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  });

  it('certifies the Zavorth-native daily power stack against a local evidence tree', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthNativeCapabilityCertificationService({
      projectRoot,
      evidenceRoot,
      env: {},
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-native-capability-certification/1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.evidenceRootFound).toBe(true);
    expect(snapshot.summary.missing).toBe(0);
    expect(snapshot.summary.partial).toBe(0);
    expect(snapshot.xai.doctor.status).toBe('missing_env');
    expect(snapshot.xai.cleanInstallCredentialGateExpected).toBe(true);
    expect(snapshot.xai.acceptsApiKey).toBe(true);
    expect(snapshot.xai.acceptsOauthToken).toBe(true);
    expect(snapshot.xai.secretsSerialized).toBe(false);
    expect(snapshot.longRunSmoke.status).toBe('ready');
    expect(snapshot.longRunSmoke.agentRuns).toBeGreaterThanOrEqual(2);
    expect(snapshot.longRunSmoke.finalGoalStatus).toBe('done');
    expect(snapshot.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'goal-loop-background-continuation',
      'operational-state-session-recall',
      'taskboard-kanban-plane',
      'mcp-skills-catalog',
      'xai-provider-resolver-search',
      'curator-plane-reviewer',
      'daily-ops-command-surface',
      'goal-loop-long-session',
    ]));
  });

  it('keeps xAI ready for clean installs while supporting OAuth when configured', async () => {
    const missing = new ZavorthXaiRuntimeService({
      env: {},
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    }).doctor();

    expect(missing.status).toBe('missing_env');
    expect(missing.authMode).toBe('missing');
    expect(missing.capabilities.oauth).toBe(true);

    const oauth = new ZavorthXaiRuntimeService({
      env: {
        XAI_AUTH_MODE: 'oauth',
        XAI_OAUTH_TOKEN: 'secret-token',
      },
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const doctor = oauth.doctor();
    const preview = await oauth.search({ query: 'release notes', live: false });

    expect(doctor.configured).toBe(true);
    expect(doctor.authMode).toBe('oauth');
    expect(doctor.credentialEnv).toBe('XAI_OAUTH_TOKEN');
    expect(preview.receipt.credentialSerialized).toBe(false);
    expect(preview.receipt.authMode).toBe('oauth');
    expect(JSON.stringify(preview)).not.toContain('secret-token');
  });

  it('renders a concise actionable report', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthNativeCapabilityCertificationService({
      projectRoot,
      evidenceRoot,
      env: {},
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const text = service.renderText(await service.buildSnapshot());

    expect(text).toContain('Zavorth Native Capability Certification');
    expect(text).toContain('goal-loop-background-continuation');
    expect(text).toContain('npm run qa:zavorth-native-capability-certification');
  });
});

function seedEvidenceFixture(root: string): void {
  for (const file of [
    'baseline_cli/goals.py',
    'cli.py',
    'tests/baseline_cli/test_goals.py',
    'baseline_state.py',
    'tools/session_search_tool.py',
    'tests/tools/test_session_search.py',
    'baseline_cli/kanban_db.py',
    'baseline_cli/kanban.py',
    'tools/kanban_tools.py',
    'tools/mcp_tool.py',
    'baseline_cli/mcp_catalog.py',
    'tools/skills_hub.py',
    'tools/x_search_tool.py',
    'tools/xai_http.py',
    'baseline_cli/proxy/adapters/xai.py',
    'agent/google_oauth.py',
    'agent/skill_commands.py',
    'tools/skills_guard.py',
  ]) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, '# evidence fixture\n', 'utf8');
  }
  fs.mkdirSync(path.join(root, 'optional-skills'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tui_gateway'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ui-tui'), { recursive: true });
}
