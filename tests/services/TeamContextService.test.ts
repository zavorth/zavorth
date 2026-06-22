import fs from 'fs';
import os from 'os';
import path from 'path';
import { TeamContextService } from '../../src/services/TeamContextService';

describe('TeamContextService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-team-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero members and null team name', () => {
    const service = new TeamContextService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.memberCount).toBe(0);
    expect(status.teamName).toBeNull();
    expect(status.filePath).toBe(path.join(tempDir, 'TEAM-CONTEXT.md'));
  });

  it('adds a member and persists to TEAM-CONTEXT.md', () => {
    const service = new TeamContextService({ projectRoot: tempDir });

    service.addMember({ name: 'Alice', role: 'lead', contactPreference: 'slack' });

    expect(fs.existsSync(path.join(tempDir, 'TEAM-CONTEXT.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'TEAM-CONTEXT.md'), 'utf8');
    expect(fileContent).toContain('Alice');
    expect(fileContent).toContain('role:lead');
    expect(fileContent).toContain('contact:slack');
  });

  it('lists members after adding multiple', () => {
    const service = new TeamContextService({ projectRoot: tempDir });
    service.addMember({ name: 'Alice', role: 'lead' });
    service.addMember({ name: 'Bob', role: 'dev' });

    const members = service.listMembers();

    expect(members.length).toBe(2);
    expect(members.map((m) => m.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });

  it('removes a member by name', () => {
    const service = new TeamContextService({ projectRoot: tempDir });
    service.addMember({ name: 'Charlie', role: 'qa' });

    const removed = service.removeMember('Charlie');

    expect(removed).toBe(true);
    expect(service.listMembers().length).toBe(0);
  });

  it('returns false when removing a non-existent member', () => {
    const service = new TeamContextService({ projectRoot: tempDir });

    const removed = service.removeMember('Ghost');

    expect(removed).toBe(false);
  });

  it('sets team context fields and persists them', () => {
    const service = new TeamContextService({ projectRoot: tempDir });

    service.setTeamContext({
      teamName: 'Platform Team',
      sharedChannels: ['general', 'dev'],
      codeReviewPolicy: 'require-approval',
      namingConventions: 'kebab-case',
    });

    const status = service.getStatus();
    expect(status.teamName).toBe('Platform Team');
    const fileContent = fs.readFileSync(path.join(tempDir, 'TEAM-CONTEXT.md'), 'utf8');
    expect(fileContent).toContain('Platform Team');
    expect(fileContent).toContain('require-approval');
    expect(fileContent).toContain('kebab-case');
  });
});
