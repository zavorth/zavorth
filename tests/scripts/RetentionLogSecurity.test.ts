import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

describe('retention log integrity', () => {
  const root = path.resolve(__dirname, '../..');
  const tempRoot = path.join(root, '.tmp', `retention-security-${process.pid}`);
  const logPath = path.join(tempRoot, 'retention.json');
  const relativeLogPath = path.relative(root, logPath);

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('allows a same-day return when the bypass variable is present', () => {
    fs.mkdirSync(tempRoot, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(
      logPath,
      JSON.stringify({
        version: 'retention-log/1',
        criteria: {
          day0Install: true,
          day1Return: false,
          completedMissionWithoutCreator: true,
        },
        history: [{ at: now, event: 'day0Install', detail: 'test' }],
      }),
      'utf8',
    );

    const result = spawnSync(
      process.execPath,
      ['scripts/retention-log.mjs', '--log', relativeLogPath, '--day1-return'],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ZAVORTH_ALLOW_FAKE_DAY1: '1' },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('FAKE');
    expect(JSON.parse(fs.readFileSync(logPath, 'utf8')).criteria.day1Return).toBe(true);
  });

  it('refuses a log path outside the project root', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/retention-log.mjs', '--log', path.join('..', 'outside-retention.json'), '--check'],
      { cwd: root, encoding: 'utf8' },
    );

    expect(result.status).toBe(3);
    expect(result.stderr).toContain('outside project root');
  });
});
