import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryHonchoService } from '../../src/services/plugins/MemoryHonchoService';

describe('MemoryHonchoService', () => {
  let service: MemoryHonchoService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'honcho-test-'));
    service = new MemoryHonchoService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a profile', () => {
    const profile = service.getOrCreateProfile('user1');
    expect(profile.id).toBe('user1');
    expect(profile.interaction_history.total_interactions).toBe(0);
  });

  it('records an interaction', () => {
    const result = service.recordInteraction('user1', {
      role: 'user',
      content: 'Hello!',
      timestamp: new Date().toISOString(),
      channel: 'cli',
    });
    expect(result).toContain('1');
  });

  it('learns a fact', () => {
    const result = service.learnFact('user1', 'User likes TypeScript', 'conversation', 0.9);
    expect(result).toContain('aprendido');
  });

  it('adds a trait', () => {
    service.addTrait('user1', 'curious');
    const profile = service.getOrCreateProfile('user1');
    expect(profile.traits).toContain('curious');
  });

  it('sets a preference', () => {
    const result = service.setPreference('user1', 'theme', 'dark');
    expect(result).toContain('atualizada');
  });

  it('sets communication preference', () => {
    const result = service.setCommunicationPreference('user1', 'formality', 'casual');
    expect(result).toContain('atualizada');
  });

  it('adds knowledge area', () => {
    service.addKnowledgeArea('user1', 'TypeScript');
    const profile = service.getOrCreateProfile('user1');
    expect(profile.knowledge_areas).toContain('TypeScript');
  });

  it('gets profile', () => {
    service.addTrait('user1', 'analytical');
    const result = service.getProfile('user1');
    expect(result).toContain('analytical');
  });

  it('gets conversation history', () => {
    service.recordInteraction('user1', {
      role: 'user',
      content: 'Test message',
      timestamp: new Date().toISOString(),
      channel: 'cli',
    });
    const result = service.getConversationHistory('user1');
    expect(result).toContain('Test message');
  });

  it('lists profiles', () => {
    service.getOrCreateProfile('user1');
    service.getOrCreateProfile('user2');
    const result = service.listProfiles();
    expect(result).toContain('2');
  });

  it('extracts name from conversation', () => {
    service.recordInteraction('user1', {
      role: 'user',
      content: 'Me chamo Ermys',
      timestamp: new Date().toISOString(),
      channel: 'cli',
    });
    const profile = service.getOrCreateProfile('user1');
    expect(profile.name).toBe('Ermys');
  });
});
