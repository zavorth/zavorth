import {
  setDynamicIntentToolMap,
  getDynamicIntentToolMap,
} from '../../src/cognitive-firewall/ToolGatekeeper.js';
import { reconcileSkillToolsWithRegistry } from '../../src/services/SkillToolRegistryBridge.js';
import { formatAgentToolModelGuidance } from '../../src/services/AgentToolModelGuidance.js';

describe('P2 skill tool registry bridge', () => {
  afterEach(() => {
    setDynamicIntentToolMap({});
  });

  it('drops phantom skill tools and keeps real registry tools', () => {
    setDynamicIntentToolMap({
      information: ['web_search', 'totally_fake_skill_tool', 'search_query'],
      memory: ['memory_get', 'ghost_memory_tool'],
    });
    const result = reconcileSkillToolsWithRegistry({
      hasTool: (name) => ['web_search', 'search_query', 'memory_get', 'zavorth_action', 'plugin_suggest'].includes(name),
      getAllTools: () => [
        { name: 'web_search' },
        { name: 'search_query' },
        { name: 'memory_get' },
        { name: 'zavorth_action' },
        { name: 'plugin_suggest' },
      ],
    });
    expect(result.dropped).toEqual(expect.arrayContaining(['totally_fake_skill_tool', 'ghost_memory_tool']));
    expect(result.kept).toEqual(expect.arrayContaining(['web_search', 'search_query', 'memory_get']));
    const map = getDynamicIntentToolMap();
    expect(map.information).toEqual(expect.arrayContaining(['web_search', 'search_query']));
    expect(map.information).not.toContain('totally_fake_skill_tool');
    expect(map.memory).toContain('memory_get');
    expect(map.memory).not.toContain('ghost_memory_tool');
  });

  it('redirects categories with only phantoms to governed fallbacks', () => {
    setDynamicIntentToolMap({
      desktop: ['never_registered_desktop_tool'],
    });
    const result = reconcileSkillToolsWithRegistry({
      hasTool: (name) => ['zavorth_action', 'plugin_suggest', 'plugin_recommend', 'read_file', 'list_directory', 'get_datetime'].includes(name),
      getAllTools: () => [
        { name: 'zavorth_action' },
        { name: 'plugin_suggest' },
        { name: 'read_file' },
      ],
    });
    const map = getDynamicIntentToolMap();
    expect(map.desktop?.length).toBeGreaterThan(0);
    expect(map.desktop).toEqual(expect.arrayContaining(['zavorth_action']));
    expect(result.redirectedTo.length).toBeGreaterThan(0);
  });

  it('tool model guidance mentions zavorth_action, mesh tools, and group-5 delegation', () => {
    const text = formatAgentToolModelGuidance();
    expect(text).toMatch(/zavorth_action/);
    expect(text).toMatch(/Direct tools/i);
    expect(text).toMatch(/plugin_suggest/);
    expect(text).toMatch(/zavorth_skill_marketplace/);
    expect(text).toMatch(/agent_manager/);
    expect(text).toMatch(/Delegation model|worker mesh/i);
  });
});
