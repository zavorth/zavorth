import { readFileSync } from 'fs';
import { join } from 'path';

const commandCenterDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/control/command-center',
);

describe('CommandCenterVisualPolish', () => {
  it('uses the real Command Center shell with prototype-grade visual primitives', () => {
    const primitives = readFileSync(
      join(commandCenterDir, 'components/CommandCenterPrimitives.tsx'),
      'utf8',
    );
    const chatSurface = readFileSync(
      join(commandCenterDir, 'components/CommandCenterChatSurface.tsx'),
      'utf8',
    );

    expect(primitives).toContain('CommandCenterFoxMark');
    expect(primitives).toContain('bcc-mascot__svg');
    expect(primitives).toContain('bcc-bridge__center');
    expect(primitives).toContain('bcc-dock__glyph');
    expect(chatSurface).toContain('bcc-suggestion-chips');
    expect(chatSurface).toContain('bcc-message__avatar');
    expect(chatSurface).toContain('bcc-compose__input-frame');
    expect(chatSurface).toContain('bcc-active-run-state');
  });

  it('keeps the visual polish in CSS instead of hardcoding fake dashboard data', () => {
    const css = readFileSync(
      join(commandCenterDir, 'styles/commandCenter.css'),
      'utf8',
    );

    for (const requiredClass of [
      '.bcc-hero__eyebrow',
      '.bcc-suggestion-chip',
      '.bcc-message__avatar',
      '.bcc-compose__input-frame',
      '.bcc-active-run-state',
      '.bcc-dock__glyph',
      '.bcc-mascot__svg',
      '@keyframes bcc-float',
      '@keyframes bcc-gradient-flow',
    ]) {
      expect(css).toContain(requiredClass);
    }

    for (const forbiddenDemoValue of [
      '12,847',
      '3.2M',
      '$4.82',
      'RTX 4090',
      'A100',
      'gemini-3-flash',
      'claude-opus-4',
    ]) {
      expect(css).not.toContain(forbiddenDemoValue);
    }
  });

  it('documents the phase as polish over the runtime contract, not a replacement surface', () => {
    const docs = readFileSync(
      join(process.cwd(), 'docs/103-command-center-visual-polish.md'),
      'utf8',
    );

    expect(docs).toContain('DashboardCommandCenterViewModel');
    expect(docs).toContain('nao substitui o runtime real');
    expect(docs).toContain('CommandCenterFoxMark');
  });
});
