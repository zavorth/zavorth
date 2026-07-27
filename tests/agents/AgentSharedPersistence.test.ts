import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentSharedMemory } from '../../src/agents/AgentSharedMemory.js';
import { AgentSkillSharing } from '../../src/agents/AgentSkillSharing.js';
import { config } from '../../src/config/index.js';

describe('agent shared persistence', () => {
  const originalKey = config.dbEncryptionKey;
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-shared-'));
    (config as { dbEncryptionKey: string }).dbEncryptionKey = 'agent-shared-test-key';
  });
  afterEach(() => {
    (config as { dbEncryptionKey: string }).dbEncryptionKey = originalKey;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('encrypts shared memory and enforces independent approval', () => {
    const memory = new AgentSharedMemory({ dataDir: path.join(root, 'memory') });
    const entry = memory.store({ key: 'private', value: 'sensitive-value', sourceAgentId: 'source', targetAgentIds: ['target'], scope: 'shared', expiresAt: null, approvalRequired: true, tags: [], metadata: {} });
    expect(memory.retrieve('private', 'target')).toBeNull();
    expect(memory.approve(entry.id, 'owner')?.approvedBy).toBe('owner');
    expect(memory.retrieve('private', 'target')?.value).toBe('sensitive-value');
  });

  test('keeps shared skills unavailable until review and encrypts content', () => {
    const skills = new AgentSkillSharing({ dataDir: path.join(root, 'skills') });
    const skill = skills.share({ name: 'review-code', description: 'Review safely', sourceAgentId: 'source', category: 'review', version: '1', content: 'private workflow body', parameters: {}, tags: [] });
    expect(skill.id).toBeTruthy();
    expect(skills.find('review-code')).not.toBeNull();
    expect(skills.find('review-code')?.content).toBe('private workflow body');
  });
});
