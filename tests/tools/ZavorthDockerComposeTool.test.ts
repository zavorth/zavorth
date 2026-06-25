import { ZavorthDockerComposeTool } from '../../src/tools/ZavorthDockerComposeTool';

describe('ZavorthDockerComposeTool', () => {
  let tool: ZavorthDockerComposeTool;

  beforeEach(() => {
    tool = new ZavorthDockerComposeTool();
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_docker_compose');
  });

  it('has a description', () => {
    expect(tool.description).toBeTruthy();
    expect(tool.description).toContain('Docker Compose');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for empty action', async () => {
    const result = await tool.execute({ action: '' });
    expect(result).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'deploy' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
    expect(result).toContain('deploy');
  });

  it('lists valid actions in error message', async () => {
    const result = await tool.execute({ action: 'bad' });
    expect(result).toContain('up');
    expect(result).toContain('down');
    expect(result).toContain('build');
    expect(result).toContain('logs');
    expect(result).toContain('ps');
    expect(result).toContain('exec');
    expect(result).toContain('scale');
  });

  it('requires action parameter in definition', () => {
    expect(tool.parameters.required).toContain('action');
  });

  it('has expected parameter properties', () => {
    const props = tool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('action');
    expect(props).toHaveProperty('compose_file');
    expect(props).toHaveProperty('service');
    expect(props).toHaveProperty('command');
    expect(props).toHaveProperty('replicas');
    expect(props).toHaveProperty('detached');
    expect(props).toHaveProperty('project_name');
  });
});
