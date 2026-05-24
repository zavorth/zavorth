import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildZavorthDoctorPremiumSnapshot,
  runZavorthDoctorPremium,
} from '../../../src/cli/doctor';

describe('Zavorth premium doctor', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('builds actionable checks without leaking secrets', () => {
    const root = createWorkspace();
    fs.writeFileSync(path.join(root, '.env'), [
      'ZAVORTH_DEFAULT_PROVIDER=openai',
      'OPENAI_MODEL=gpt-4.1',
      'OPENAI_API_KEY=sk-secret-value',
      'TELEGRAM_BOT_TOKEN=telegram-secret',
    ].join('\n'), 'utf8');

    const snapshot = buildZavorthDoctorPremiumSnapshot({
      projectRoot: root,
      now: () => new Date('2026-05-22T10:00:00.000Z'),
    });

    expect(snapshot.contractVersion).toBe('zavorth-doctor-premium/1');
    expect(snapshot.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'node-runtime',
      'provider',
      'gateway',
      'telegram',
      'effect-boundary',
    ]));
    expect(JSON.stringify(snapshot)).toContain('OPENAI_API_KEY=[redacted]');
    expect(JSON.stringify(snapshot)).not.toContain('sk-secret-value');
    expect(JSON.stringify(snapshot)).not.toContain('telegram-secret');
  });

  it('renders the premium doctor screen and supports json output', () => {
    const root = createWorkspace();
    const text = runZavorthDoctorPremium({ projectRoot: root });
    const json = runZavorthDoctorPremium({ projectRoot: root, json: true });

    expect(text.output).toContain('Doctor');
    expect(text.output).toContain('Runtime status');
    expect(text.output).toContain('Next actions');
    expect(JSON.parse(json.output).contractVersion).toBe('zavorth-doctor-premium/1');
  });

  function createWorkspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-doctor-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'src', 'security'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'tools', 'governance'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'runtime', 'rehearsal'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'runtime', 'commit'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'ai-gateway', 'app', '(dashboard)', 'control'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'host.ts'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'security', 'EffectPolicyKernel.ts'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'tools', 'governance', 'ToolEffectMapper.ts'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'runtime', 'rehearsal', 'RehearsalRunner.ts'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'runtime', 'commit', 'CommitExecutor.ts'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'scripts', 'effect-boundary-invariants-check.mjs'), '', 'utf8');
    fs.writeFileSync(path.join(root, 'docs', 'security.md'), '', 'utf8');
    return root;
  }
});
