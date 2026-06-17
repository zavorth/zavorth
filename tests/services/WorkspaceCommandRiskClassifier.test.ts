import path from 'path';
import { WorkspaceCommandRiskClassifier } from '../../src/services/WorkspaceCommandRiskClassifier';

describe('WorkspaceCommandRiskClassifier', () => {
  const classifier = new WorkspaceCommandRiskClassifier();
  const root = path.resolve('C:/workspace');
  const cwd = path.resolve('C:/workspace');

  it('classifies LOW risk commands correctly', () => {
    expect(classifier.classify('git status', cwd, root)).toBe('LOW');
    expect(classifier.classify('git diff', cwd, root)).toBe('LOW');
    expect(classifier.classify('git log', cwd, root)).toBe('LOW');
    expect(classifier.classify('git show', cwd, root)).toBe('LOW');
    expect(classifier.classify('git branch', cwd, root)).toBe('LOW');
    expect(classifier.classify('npm test', cwd, root)).toBe('LOW');
    expect(classifier.classify('npm run build', cwd, root)).toBe('LOW');
    expect(classifier.classify('pnpm test', cwd, root)).toBe('LOW');
    expect(classifier.classify('yarn test', cwd, root)).toBe('LOW');
    expect(classifier.classify('npx jest', cwd, root)).toBe('LOW');
  });

  it('classifies MEDIUM risk commands correctly', () => {
    expect(classifier.classify('npm install', cwd, root)).toBe('MEDIUM');
    expect(classifier.classify('pnpm install', cwd, root)).toBe('MEDIUM');
    expect(classifier.classify('yarn install', cwd, root)).toBe('MEDIUM');
    expect(classifier.classify('node scripts/build.js', cwd, root)).toBe('MEDIUM');
    expect(classifier.classify('python script.py', cwd, root)).toBe('MEDIUM');
  });

  it('classifies HIGH risk commands correctly', () => {
    expect(classifier.classify('curl https://google.com', cwd, root)).toBe('HIGH');
    expect(classifier.classify('wget https://google.com', cwd, root)).toBe('HIGH');
    expect(classifier.classify('ssh user@host', cwd, root)).toBe('HIGH');
    expect(classifier.classify('scp file user@host:', cwd, root)).toBe('HIGH');
    expect(classifier.classify('docker ps', cwd, root)).toBe('HIGH');
    expect(classifier.classify('powershell -Command Get-Process', cwd, root)).toBe('HIGH');
    expect(classifier.classify('cmd /c dir', cwd, root)).toBe('HIGH');
    expect(classifier.classify('bash -c ls', cwd, root)).toBe('HIGH');
    expect(classifier.classify('sh run.sh', cwd, root)).toBe('HIGH');
    expect(classifier.classify('node -e "console.log(1)"', cwd, root)).toBe('HIGH');
    expect(classifier.classify('python -c "print(1)"', cwd, root)).toBe('HIGH');
  });

  it('classifies CRITICAL risk commands correctly', () => {
    expect(classifier.classify('rm -rf node_modules', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('del /s /q temp', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('Remove-Item -Recurse -Force tmp', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('format D:', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('shutdown /s', cwd, root)).toBe('CRITICAL');
  });

  it('detects commands outside workspace as CRITICAL', () => {
    const outsideCwd = path.resolve('C:/outside');
    expect(classifier.classify('git status', outsideCwd, root)).toBe('CRITICAL');
    expect(classifier.classify('git log ../outside/file.txt', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('git log C:/outside/file.txt', cwd, root)).toBe('CRITICAL');
  });

  it('detects credentials/secrets in commands as CRITICAL', () => {
    expect(classifier.classify('npm run deploy --token=fixture-token-secret-1234', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('node login.js --key="sk-test-1234567890abcdef1234567890abcdef"', cwd, root)).toBe('CRITICAL');
    expect(classifier.classify('curl -H "Authorization: Bearer my-secret-token" https://api.com', cwd, root)).toBe('CRITICAL');
  });
});
