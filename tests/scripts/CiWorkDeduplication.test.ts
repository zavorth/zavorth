import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');

describe('CI work allocation', () => {
  it('keeps the complete grouped suite manual and channel suites present across surface jobs', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const monorepo = workflow.slice(workflow.indexOf('  monorepo-suite:'), workflow.indexOf('  test-surfaces:'));
    expect(monorepo).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('test:ci:telegram');
    expect(workflow).toContain('test:ci:channels');
    expect(workflow.match(/run: npm run test:ci:telegram --silent/g)!.length).toBeGreaterThanOrEqual(1);
    expect(workflow.match(/run: npm run test:ci:channels --silent/g)!.length).toBeGreaterThanOrEqual(1);
  });

  it('uses docker build-push-action and a smoke-run step in the release docker job', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
    const dockerJob = workflow.slice(workflow.indexOf('  docker:'), workflow.indexOf('  windows-smoke:'));
    expect(dockerJob).toContain('docker/build-push-action');
    expect(dockerJob).toContain('docker build -t zavorth:smoke');
  });
});
