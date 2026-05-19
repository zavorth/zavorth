import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('CommandCenterChatVisualQa', () => {
  it('exposes a real browser chat visual QA gate without redesigning the dashboard', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(rootDir, 'scripts/command-center-chat-visual-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:command-center-chat-visual']).toBe(
      'npx tsx scripts/command-center-chat-visual-qa.ts --require-pass',
    );
    expect(packageJson.scripts['qa:command-center']).toContain('qa:command-center-chat-visual');
    expect(script).toContain('assets", "command-center"');
    expect(script).toContain('preserves-user-dashboard-shell');
    expect(script).toContain('no-message-sent-toast');
    expect(script).toContain('no-scroll-jump-after-send');
    expect(script).toContain('simple-chat-has-no-artifact-card');
    expect(script).toContain('approval-card-appears-for-risky-command');
    expect(script).toContain('artifact-card-only-for-explicit-deliverable');
    expect(script).toContain('current-model-label-is-real');
    expect(script).toContain('Mensagem histórica');
    expect(script).toContain('Relatório em PDF');
    expect(script).toContain('gemini-2.5-flash');
    expect(docs).toContain('qa:command-center-chat-visual');
    expect(docs).toContain('popup "mensagem enviada"');
    expect(docs).toContain('não salta para o topo');
  });
});
