import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolVersionRegistry } from '../../src/tools/ToolVersionRegistry.js';

describe('ToolVersionRegistry', () => {
  let registry: ToolVersionRegistry<string>;

  beforeEach(() => {
    registry = new ToolVersionRegistry<string>();
  });

  it('registers and retrieves a tool', () => {
    registry.register('read_file', '1.0.0', 'tool_v1');
    const tool = registry.get('read_file');
    expect(tool).toBe('tool_v1');
  });

  it('auto-selects latest version as active', () => {
    registry.register('read_file', '1.0.0', 'tool_v1');
    registry.register('read_file', '1.1.0', 'tool_v11');
    const tool = registry.get('read_file');
    expect(tool).toBe('tool_v11');
  });

  it('manually sets active version', () => {
    registry.register('read_file', '1.0.0', 'tool_v1');
    registry.register('read_file', '1.1.0', 'tool_v11');
    registry.setActiveVersion('read_file', '1.0.0');
    const tool = registry.get('read_file');
    expect(tool).toBe('tool_v1');
  });

  it('gets specific version', () => {
    registry.register('read_file', '1.0.0', 'tool_v1');
    registry.register('read_file', '1.1.0', 'tool_v11');
    const v1 = registry.getVersion('read_file', '1.0.0');
    const v2 = registry.getVersion('read_file', '1.1.0');
    expect(v1).toBe('tool_v1');
    expect(v2).toBe('tool_v11');
  });

  it('lists versions sorted', () => {
    registry.register('read_file', '1.1.0', 'v11');
    registry.register('read_file', '1.0.0', 'v10');
    registry.register('read_file', '2.0.0', 'v20');
    const versions = registry.getVersions('read_file');
    expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
  });

  it('gets version info', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('read_file', '1.1.0', 'v2');
    const info = registry.getVersionInfo('read_file');
    expect(info?.versions).toEqual(['1.0.0', '1.1.0']);
    expect(info?.activeVersion).toBe('1.1.0');
    expect(info?.latestVersion).toBe('1.1.0');
  });

  it('compares versions', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('read_file', '1.1.0', 'v2');
    registry.setActiveVersion('read_file', '1.0.0');
    const comparison = registry.compareVersion('read_file');
    expect(comparison?.isOutdated).toBe(true);
    expect(comparison?.versionsBehind).toBe(1);
  });

  it('deprecates a version', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.deprecate('read_file', '1.0.0', 'Use 1.1.0 instead');
    const comparison = registry.compareVersion('read_file');
    expect(comparison?.deprecationWarning).toBe('Use 1.1.0 instead');
  });

  it('removes a version', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('read_file', '1.1.0', 'v2');
    registry.remove('read_file', '1.0.0');
    const versions = registry.getVersions('read_file');
    expect(versions).toEqual(['1.1.0']);
  });

  it('removes all versions', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('write_file', '1.0.0', 'v1');
    registry.removeAll('read_file');
    expect(registry.get('read_file')).toBeNull();
    expect(registry.get('write_file')).toBe('v1');
  });

  it('lists all tools', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('write_file', '1.0.0', 'v1');
    const tools = registry.listTools();
    expect(tools).toContain('read_file');
    expect(tools).toContain('write_file');
  });

  it('gets stats', () => {
    registry.register('read_file', '1.0.0', 'v1');
    registry.register('read_file', '1.1.0', 'v2');
    registry.register('write_file', '1.0.0', 'v1');
    registry.deprecate('read_file', '1.0.0');
    const stats = registry.getStats();
    expect(stats.totalTools).toBe(2);
    expect(stats.totalVersions).toBe(3);
    expect(stats.deprecatedVersions).toBe(1);
    expect(stats.toolsWithMultipleVersions).toBe(1);
  });

  it('fires update callback', () => {
    let calledVersion = '';
    registry.onUpdate('read_file', (v) => { calledVersion = v; });
    registry.register('read_file', '1.0.0', 'v1');
    expect(calledVersion).toBe('1.0.0');
  });
});
