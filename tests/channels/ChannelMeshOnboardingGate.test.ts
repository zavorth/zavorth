import fs from 'fs';
import os from 'os';
import path from 'path';

import { ChannelMeshOnboardingGate } from '../../src/channels/onboarding/ChannelMeshOnboardingGate.js';

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mesh-gate-'));
}

const TARGET = { platform: 'signal', userId: 'user-42', chatId: 'chat-77' };

describe('ChannelMeshOnboardingGate', () => {
  it('opens the interview on first contact and marks the chat as started', async () => {
    const projectRoot = makeTempRoot();
    const gate = new ChannelMeshOnboardingGate({ projectRoot });

    const first = await gate.intercept(TARGET, 'hello');
    expect(first.handled).toBe(true);
    if (first.handled) {
      expect(first.replies.length).toBeGreaterThan(0);
      expect(first.replies.join('\n').length).toBeGreaterThan(0);
      expect(first.completedNow).toBe(false);
    }

    const stateFiles = fs.readdirSync(path.join(projectRoot, 'data', 'channel-mesh', 'onboarding'));
    expect(stateFiles.length).toBe(1);
  });

  it('advances the interview with text answers until completion, then passes through', async () => {
    const projectRoot = makeTempRoot();
    const gate = new ChannelMeshOnboardingGate({ projectRoot });

    await gate.intercept(TARGET, 'hello');

    const language = await gate.intercept(TARGET, 'pt-BR');
    expect(language.handled).toBe(true);
    if (language.handled) {
      expect(language.completedNow).toBe(false);
      expect(language.replies.join(' ').toLowerCase()).toContain('pt-br');
    }

    const surface = await gate.intercept(TARGET, 'surface:channel');
    expect(surface.handled).toBe(true);
    if (surface.handled) {
      expect(surface.completedNow).toBe(false);
    }

    const learning = await gate.intercept(TARGET, 'learning:on');
    expect(learning.handled).toBe(true);
    if (learning.handled) {
      expect(learning.completedNow).toBe(true);
    }

    const passthrough = await gate.intercept(TARGET, 'now talk to me normally');
    expect(passthrough).toEqual({ handled: false });
  });

  it('isolates onboarding state between different chats of the same platform', async () => {
    const projectRoot = makeTempRoot();
    const gate = new ChannelMeshOnboardingGate({ projectRoot });

    await gate.intercept(TARGET, 'hello');
    await gate.intercept(TARGET, 'skip');

    const otherChat = { platform: 'signal', userId: 'user-99', chatId: 'chat-other' };
    const other = await gate.intercept(otherChat, 'hello');
    expect(other.handled).toBe(true);

    const completedChat = await gate.intercept(TARGET, 'regular message');
    expect(completedChat).toEqual({ handled: false });
  });
});
