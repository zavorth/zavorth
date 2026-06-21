import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiagnosticsExporterService } from '../../src/services/DiagnosticsExporterService.js';
import { Database } from '../../src/storage/Database.js';

describe('DiagnosticsExporterService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('gathers, sanitizes, and exports diagnostics to a target file', async () => {
    const root = createWorkspace();
    const outputPath = path.join(root, 'exports', 'diagnostics.json');

    // Create a mock .env file with sensitive and non-sensitive keys for multiple providers
    fs.writeFileSync(
      path.join(root, '.env'),
      [
        'ZAVORTH_DEFAULT_PROVIDER=gemini',
        'GEMINI_API_KEY=AIzaSySensitiveKeyHere',
        'OPENAI_API_KEY=sk-proj-OpenAiSensitiveKeyHereWhichIsLonger',
        'ANTHROPIC_API_KEY=sk-ant-sid-AnthropicSensitiveKeyHereWhichIsLonger',
        'DEEPSEEK_API_KEY=sk-deepseek-SensitiveKeyHere',
        'SLACK_BOT_TOKEN=xoxb-SlackSensitiveTokenHere',
        'ZAVORTH_WEB_AUTH_TOKEN=secretTokenValue',
        'USER_PROFILE_DIR=C:\\Users\\john-doe\\project',
        'PROJECT_NAME=ZavorthTest',
      ].join('\n'),
      'utf8',
    );

    // Initialize Database to ensure it can run diagnostics queries
    const db = await Database.getInstance();
    expect(db).toBeDefined();

    const service = new DiagnosticsExporterService();
    const report = await service.export({
      projectRoot: root,
      outputPath,
    });

    expect(report.contractVersion).toBe('zavorth-diagnostics-export/1');
    expect(report.projectRoot).toContain('[REDACTED_PATH]');
    
    // Verify file output
    expect(fs.existsSync(outputPath)).toBe(true);
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    const parsed = JSON.parse(fileContent);

    expect(parsed.contractVersion).toBe('zavorth-diagnostics-export/1');
    expect(parsed.env.GEMINI_API_KEY).toBe('[REDACTED_SECRET]');
    expect(parsed.env.OPENAI_API_KEY).toBe('[REDACTED_SECRET]');
    expect(parsed.env.ANTHROPIC_API_KEY).toBe('[REDACTED_SECRET]');
    expect(parsed.env.DEEPSEEK_API_KEY).toBe('[REDACTED_SECRET]');
    expect(parsed.env.SLACK_BOT_TOKEN).toBe('[REDACTED_SECRET]');
    expect(parsed.env.ZAVORTH_WEB_AUTH_TOKEN).toBe('[REDACTED_SECRET]');
    expect(parsed.env.PROJECT_NAME).toBe('ZavorthTest');
    expect(parsed.env.USER_PROFILE_DIR).toContain('[REDACTED_PATH]');
    expect(fileContent).not.toContain('AIzaSySensitiveKeyHere');
    expect(fileContent).not.toContain('sk-proj-OpenAiSensitiveKeyHereWhichIsLonger');
    expect(fileContent).not.toContain('sk-ant-sid-AnthropicSensitiveKeyHereWhichIsLonger');
    expect(fileContent).not.toContain('sk-deepseek-SensitiveKeyHere');
    expect(fileContent).not.toContain('xoxb-SlackSensitiveTokenHere');
    expect(fileContent).not.toContain('secretTokenValue');
    expect(fileContent).not.toContain('john-doe');
  });

  function createWorkspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diagnostics-'));
    tempDirs.push(root);
    return root;
  }
});
