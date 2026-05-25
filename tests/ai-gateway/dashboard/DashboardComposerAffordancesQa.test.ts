import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('DashboardComposerAffordancesQa', () => {
  it('guards attachments, skills and voice as real composer affordances', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const app = readFileSync(
      join(rootDir, 'assets/dashboard/scripts/app.js'),
      'utf8',
    );
    const css = readFileSync(
      join(rootDir, 'assets/dashboard/styles/chat.css'),
      'utf8',
    );
    const qa = readFileSync(
      join(rootDir, 'scripts/dashboard-composer-affordances-qa.ts'),
      'utf8',
    );
    const liveQa = readFileSync(
      join(rootDir, 'scripts/dashboard-live-composer-affordances-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:dashboard-composer-affordances']).toBe(
      'npx tsx scripts/dashboard-composer-affordances-qa.ts --require-pass',
    );
    expect(packageJson.scripts['qa:dashboard-live-composer']).toBe(
      'npx tsx scripts/dashboard-live-composer-affordances-qa.ts --allow-send --require-live --require-pass',
    );
    expect(packageJson.scripts['qa:dashboard']).toContain('qa:dashboard-composer-affordances');
    expect(packageJson.scripts['qa:dashboard']).not.toContain('qa:dashboard-live-composer');

    expect(app).toContain('const composeDock = document.querySelector');
    expect(app).toContain('(composeDock || composeFrame).appendChild(skillPopover)');
    expect(css).toContain('.compose-skill-popover');
    expect(css).toContain('z-index: 70');
    expect(css).toContain('.chat-attachment-card');
    expect(app).toContain('buildSentAttachmentCards(outboundAttachments)');

    expect(qa).toContain('attachment-payload-has-text-preview');
    expect(qa).toContain('attachment-message-does-not-leak-context');
    expect(qa).toContain('attachment-card-is-visual-not-raw-html');
    expect(qa).toContain('attachment-card-does-not-render-code-block');
    expect(qa).toContain('selected-skill-payload-preserved');
    expect(qa).toContain('voice-payload-preserved');
    expect(qa).toContain('binary-attachment-is-honest-metadata');
    expect(qa).toContain('binary-attachment-does-not-create-fake-artifact');
    expect(qa).toContain('voice-unsupported-shows-honest-notice');
    expect(qa).toContain('web.search');
    expect(qa).toContain('SpeechRecognition');

    expect(liveQa).toContain('ZAVORTH_WEB_AUTH_TOKEN');
    expect(liveQa).toContain('data", "runtime", "web-api-token.txt');
    expect(liveQa).toContain('--allow-send');
    expect(liveQa).toContain('--allow-skill-send');
    expect(liveQa).toContain('attachment-chip-visible-live');
    expect(liveQa).toContain('skills-popover-opens-live');
    expect(liveQa).toContain('voice-transcript-live-enters-composer');

    expect(docs).toContain('qa:dashboard-composer-affordances');
    expect(docs).toContain('qa:dashboard-live-composer');
    expect(docs).toContain('nao cria artefato falso');
    expect(docs).toContain('overflow: hidden');
  });
});
