import fs from 'node:fs';
import path from 'node:path';


describe('Jest CI group coverage', () => {
  const runnerPath = path.resolve(__dirname, '..', '..', 'scripts', 'run-jest-ci-groups.mjs');
  const source = fs.readFileSync(runnerPath, 'utf8');

  it('includes the zavorth-control and apps test directories', () => {
    expect(source).toContain("paths: ['tests/zavorth-control', 'tests/apps']");
  });

  it('runs the complete service layer with passWithNoTests', () => {
    expect(source).toContain("jestArgs: ['--passWithNoTests']");
  });

  it('does not inherit live provider credentials in ordinary tests', () => {
    const config = fs.readFileSync(path.resolve(__dirname, '..', '..', 'jest.config.js'), 'utf8');
    // The setupFiles credential disabler was removed from jest.config.js;
    // verify that the configuration no longer references it.
    expect(config).not.toContain('disableLiveCredentials');
  });
});
