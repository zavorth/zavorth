import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  FirstMessageIdentityOnboardingService,
  extractUserFacingText,
} from '../../src/services/onboarding/FirstMessageIdentityOnboardingService.js';
import { FirstRunPersonalizationService } from '../../src/services/FirstRunPersonalizationService.js';

function createPendingWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-first-msg-id-'));
  // Empty identity name + empty user fields + bootstrap => pending personalization
  fs.writeFileSync(
    path.join(root, 'IDENTITY.md'),
    `# IDENTITY.md\n\n## Core identity\n\n- **Primary name:**\n- **Short name:**\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(root, 'USER.md'),
    `# USER.md\n\n## Identity\n\n- **Name:**\n- **What to call them:**\n- **Primary language:**\n\n## Communication defaults\n\n- **Preferred tone from the agent:**\n- **Default response density:**\n\n## Collaboration style\n\n- **Initiative level:**\n- **Candor level:**\n- **External action posture:**\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'BOOTSTRAP.md'), '# BOOTSTRAP\n\nFirst-run ritual pending.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'SOUL.md'), '# SOUL.md\n\n## Baseline character\n\nCalm.\n', 'utf8');
  return root;
}

describe('FirstMessageIdentityOnboardingService', () => {
  test('extractUserFacingText prefers CURRENT USER MESSAGE marker', () => {
    const wrapped =
      'context bundle...\n\nCURRENT USER MESSAGE:\nHello there';
    expect(extractUserFacingText(wrapped)).toBe('Hello there');
  });

  test('runs multi-step identity ritual then clears pending', () => {
    const root = createPendingWorkspace();
    const personalization = new FirstRunPersonalizationService({ projectRoot: root });
    expect(personalization.getStatus().pending).toBe(true);

    const service = new FirstMessageIdentityOnboardingService({
      projectRoot: root,
      personalization,
      stateDir: path.join(root, '.zavorth', 'onboarding', 'first-message-identity'),
    });
    const scopeKey = service.resolveScopeKey({ surface: 'telegram', userId: 'u1', chatId: 'c1' });

    const intro = service.handleTurn({ scopeKey, message: 'hi', surface: 'telegram' });
    expect(intro.handled).toBe(true);
    expect(intro.finished).toBe(false);
    expect(intro.reply).toMatch(/call me|agent name|Zavorth/i);

    const agent = service.handleTurn({ scopeKey, message: 'Nova', surface: 'telegram' });
    expect(agent.handled).toBe(true);
    expect(agent.reply).toMatch(/Nova/);
    expect(agent.reply).toMatch(/call you/i);

    const user = service.handleTurn({ scopeKey, message: 'Alex', surface: 'telegram' });
    expect(user.handled).toBe(true);
    expect(user.reply).toMatch(/Alex/);
    expect(user.reply).toMatch(/Casual|Professional|Friendly|Technical/i);

    const done = service.handleTurn({ scopeKey, message: '3', surface: 'telegram' });
    expect(done.handled).toBe(true);
    expect(done.finished).toBe(true);
    expect(done.reply).toMatch(/Identity set/i);
    expect(done.reply).toMatch(/Nova/);
    expect(done.reply).toMatch(/Alex/);
    expect(done.reply).toMatch(/friendly/i);

    expect(personalization.getStatus().pending).toBe(false);
    expect(fs.existsSync(path.join(root, 'BOOTSTRAP.md'))).toBe(false);

    const after = service.handleTurn({ scopeKey, message: 'what time is it?', surface: 'telegram' });
    expect(after.handled).toBe(false);
  });

  test('does not intercept when personalization already complete', () => {
    const root = createPendingWorkspace();
    const personalization = new FirstRunPersonalizationService({ projectRoot: root });
    personalization.applyAnswers(
      {
        agentName: 'Z',
        userName: 'U',
        preferredAddress: 'U',
        preferredTone: 'friendly',
      },
      { completeBootstrap: true },
    );
    expect(personalization.getStatus().pending).toBe(false);

    const service = new FirstMessageIdentityOnboardingService({
      projectRoot: root,
      personalization,
      stateDir: path.join(root, '.zavorth', 'onboarding', 'first-message-identity'),
    });
    const scopeKey = service.resolveScopeKey({ surface: 'cli', userId: 'u1' });
    const result = service.handleTurn({ scopeKey, message: 'hello', surface: 'cli' });
    expect(result.handled).toBe(false);
  });
});
