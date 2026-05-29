import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('ZavorthControlComposerAffordancesQa', () => {
  it('guards attachments, skills and voice as real composer affordances', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const app = readFileSync(
      join(rootDir, 'assets/zavorthControl/scripts/app.js'),
      'utf8',
    );
    const css = readFileSync(
      join(rootDir, 'assets/zavorthControl/styles/chat.css'),
      'utf8',
    );
    const qa = readFileSync(
      join(rootDir, 'scripts/zavorthControl-composer-affordances-qa.ts'),
      'utf8',
    );
    const liveQa = readFileSync(
      join(rootDir, 'scripts/zavorthControl-live-composer-affordances-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-composer-affordances']).toBe(
      'npx tsx scripts/zavorthControl-composer-affordances-qa.ts --require-pass',
    );
    expect(packageJson.scripts['qa:zavorthControl-live-composer']).toBe(
      'npx tsx scripts/zavorthControl-live-composer-affordances-qa.ts --allow-send --require-live --require-pass',
    );
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-composer-affordances');
    expect(packageJson.scripts['qa:zavorthControl']).not.toContain('qa:zavorthControl-live-composer');

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

    expect(docs).toContain('qa:zavorthControl-composer-affordances');
    expect(docs).toContain('qa:zavorthControl-live-composer');
    expect(docs).toContain('nao cria artefato falso');
    expect(docs).toContain('overflow: hidden');
  });
});
