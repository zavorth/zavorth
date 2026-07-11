import { SkillGitRegistry } from '../../src/skills/marketplace/SkillGitRegistry';

describe('SkillGitRegistry archive security', () => {
  it('blocks non-http archive sources before network access or extraction', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await new SkillGitRegistry().installFromUrl('file:///etc/passwd.zip');

    expect(result.success).toBe(false);
    expect(result.message).toContain('http or https');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
