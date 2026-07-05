import { ToolClusterRegistry } from '../../src/cognitive-firewall/ToolClusterRegistry';

describe('ToolClusterRegistry', () => {
  let registry: ToolClusterRegistry;

  beforeEach(() => {
    registry = new ToolClusterRegistry();
  });

  describe('built-in clusters', () => {
    it('registers all expected built-in clusters', () => {
      const clusters = registry.getAllClusters();
      const names = clusters.map((c) => c.name);

      expect(names).toContain('file_ops');
      expect(names).toContain('web');
      expect(names).toContain('devops');
      expect(names).toContain('execution');
      expect(names).toContain('memory');
      expect(names).toContain('communication');
      expect(names).toContain('code_intel');
      expect(names).toContain('ai_ml');
      expect(names).toContain('desktop');
      expect(names).toContain('media');
    });

    it('each cluster has a name, description, toolNames, and intentHints', () => {
      for (const cluster of registry.getAllClusters()) {
        expect(cluster.name).toBeTruthy();
        expect(cluster.description).toBeTruthy();
        expect(Array.isArray(cluster.toolNames)).toBe(true);
        expect(cluster.toolNames.length).toBeGreaterThan(0);
        expect(Array.isArray(cluster.intentHints)).toBe(true);
        expect(cluster.intentHints.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getCluster', () => {
    it('returns a cluster by name', () => {
      const cluster = registry.getCluster('file_ops');

      expect(cluster).not.toBeNull();
      expect(cluster?.name).toBe('file_ops');
      expect(cluster?.toolNames).toContain('read_file');
    });

    it('returns null for unknown clusters', () => {
      expect(registry.getCluster('unknown')).toBeNull();
    });
  });

  describe('getClustersForIntent', () => {
    it('returns file_ops for file_operation intent', () => {
      const clusters = registry.getClustersForIntent('file_operation');
      const names = clusters.map((c) => c.name);

      expect(names).toContain('file_ops');
    });

    it('returns web and code_intel for research intent', () => {
      const clusters = registry.getClustersForIntent('research');
      const names = clusters.map((c) => c.name);

      expect(names).toContain('web');
      expect(names).toContain('code_intel');
    });

    it('returns empty for conversation intent', () => {
      const clusters = registry.getClustersForIntent('conversation');

      expect(clusters).toEqual([]);
    });
  });

  describe('expandCluster', () => {
    it('returns tool names for a known cluster', () => {
      const tools = registry.expandCluster('file_ops');

      expect(tools).toContain('read_file');
      expect(tools).toContain('create_file');
      expect(tools).toContain('list_directory');
      expect(tools).toContain('file_system_advanced');
    });

    it('returns empty array for unknown cluster', () => {
      expect(registry.expandCluster('unknown')).toEqual([]);
    });
  });

  describe('expandClusters', () => {
    it('deduplicates tool names across multiple clusters', () => {
      // file_ops has read_file, execution has read_file via different path
      const tools = registry.expandClusters(['file_ops', 'execution']);

      // Should not have duplicates
      const uniqueTools = [...new Set(tools)];
      expect(tools).toEqual(uniqueTools);
    });

    it('returns empty for all unknown clusters', () => {
      expect(registry.expandClusters(['unknown1', 'unknown2'])).toEqual([]);
    });
  });

  describe('getToolsForIntent', () => {
    it('returns union of tools from all clusters matching an intent', () => {
      const tools = registry.getToolsForIntent('information');

      expect(tools).toContain('web_search');
    });

    it('returns empty for conversation intent', () => {
      expect(registry.getToolsForIntent('conversation')).toEqual([]);
    });
  });

  describe('findClustersForTool', () => {
    it('finds clusters containing a specific tool', () => {
      const clusters = registry.findClustersForTool('read_file');
      const names = clusters.map((c) => c.name);

      expect(names).toContain('file_ops');
    });

    it('returns empty for unknown tool', () => {
      expect(registry.findClustersForTool('nonexistent_tool')).toEqual([]);
    });
  });

  describe('custom clusters', () => {
    it('allows adding custom clusters', () => {
      const custom = new ToolClusterRegistry([{
        name: 'custom',
        description: 'Custom cluster',
        toolNames: ['tool_a', 'tool_b'],
        intentHints: ['information'],
      }]);

      expect(custom.getCluster('custom')).not.toBeNull();
      expect(custom.expandCluster('custom')).toEqual(['tool_a', 'tool_b']);
    });

    it('allows overriding built-in clusters', () => {
      const custom = new ToolClusterRegistry([{
        name: 'file_ops',
        description: 'Overridden',
        toolNames: ['custom_read'],
        intentHints: ['file_operation'],
      }]);

      expect(custom.getCluster('file_ops')?.description).toBe('Overridden');
      expect(custom.expandCluster('file_ops')).toEqual(['custom_read']);
    });
  });

  describe('size', () => {
    it('returns the number of registered clusters', () => {
      expect(registry.size).toBe(10); // 10 built-in clusters
    });
  });
});
