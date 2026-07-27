import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('ZavorthControlChatVisualQa', () => {
  it('exposes a real browser chat visual QA gate without redesigning the zavorthControl', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(rootDir, 'scripts/zavorthControl-chat-visual-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-chat-visual']).toBe(
      'npx tsx scripts/zavorthControl-chat-visual-qa.ts --require-pass',
    );
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-chat-visual');
    expect(script).toContain('assets", "zavorthControl"');
    expect(script).toContain('preserves-user-zavorthControl-shell');
    expect(script).toContain('no-message-sent-toast');
    expect(script).toContain('no-scroll-jump-after-send');
    expect(script).toContain('simple-chat-has-no-artifact-card');
    expect(script).toContain('approval-card-appears-for-risky-command');
    expect(script).toContain('artifact-card-only-for-explicit-deliverable');
    expect(script).toContain('current-model-label-is-real');
    expect(script).toContain('Historical message');
    expect(script).toContain('PDF report');
    expect(script).toContain('gemini-2.5-flash');
    expect(docs).toContain('qa:zavorthControl-chat-visual');
    expect(docs).toContain('popup "message sent"');
    expect(docs).toContain('does not jump to the top');
  });
});
