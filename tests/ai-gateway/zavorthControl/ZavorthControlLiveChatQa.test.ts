import { readFileSync } from 'fs';
import {join, resolve} from 'path';


const rootDir = resolve(__dirname, '../../../');

describe('ZavorthControlLiveChatQa', () => {
  it('exposes an opt-in live chat QA gate for the real ZavorthControl', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(rootDir, 'scripts/zavorthControl-live-chat-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-live-chat']).toBe(
      'npx tsx scripts/zavorthControl-live-chat-qa.ts --allow-send --require-live --require-pass',
    );
    expect(packageJson.scripts['qa:zavorthControl']).not.toContain('qa:zavorthControl-live-chat');

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
    expect(script).toContain('QA never clicks approve');
    expect(script).toContain('current-model-label-is-real');

    expect(docs).toContain('qa:zavorthControl-live-chat');
    expect(docs).toContain('zavorth zavorthControl token');
    expect(docs).toContain('no message-sent popup');
    expect(docs).toContain('does not create false artifacts');
    expect(docs).toContain('not part of the normal');
  });
});
