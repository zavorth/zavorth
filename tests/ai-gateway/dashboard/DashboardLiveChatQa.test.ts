import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('DashboardLiveChatQa', () => {
  it('exposes an opt-in live chat QA gate for the real Dashboard', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(rootDir, 'scripts/dashboard-live-chat-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:dashboard-live-chat']).toBe(
      'npx tsx scripts/dashboard-live-chat-qa.ts --allow-send --require-live --require-pass',
    );
    expect(packageJson.scripts['qa:dashboard']).not.toContain('qa:dashboard-live-chat');

    expect(script).toContain('ZAVORTH_WEB_AUTH_TOKEN');
    expect(script).toContain('data", "runtime", "web-api-token.txt');
    expect(script).toContain('--allow-send');
    expect(script).toContain('--allow-operational-send');
    expect(script).toContain('chat-send-skipped');
    expect(script).toContain('simple-chat-has-no-artifact-card');
    expect(script).toContain('simple-chat-has-no-approval-card');
    expect(script).toContain('no-message-sent-toast');
    expect(script).toContain('no-scroll-jump-after-send');
    expect(script).toContain('approval-card-appears-for-risky-command');
    expect(script).toContain('o QA nunca clica em aprovar');
    expect(script).toContain('current-model-label-is-real');

    expect(docs).toContain('qa:dashboard-live-chat');
    expect(docs).toContain('zavorth dashboard token');
    expect(docs).toContain('mensagem enviada');
    expect(docs).toContain('nao cria artefato falso');
    expect(docs).toContain('nao entra no `qa:dashboard` normal');
  });
});
