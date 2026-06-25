#!/usr/bin/env node

import { CapabilityDiscoveryService } from '../src/services/CapabilityDiscoveryService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const llmFormat = args.includes('--llm');
  const compactFormat = args.includes('--compact');
  const categoryFilter = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const tagFilter = args.find((a) => a.startsWith('--tag='))?.split('=')[1];

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write([
      'Zavorth Capabilities - Discover everything Zavorth can do',
      '',
      'Usage:',
      '  zavorth capabilities              # Full list for humans',
      '  zavorth capabilities --llm        # Compact list for LLM context',
      '  zavorth capabilities --compact    # One-line per capability',
      '  zavorth capabilities --json       # JSON output',
      '  zavorth capabilities --category=agent  # Filter by category',
      '  zavorth capabilities --tag=security    # Filter by tag',
      '',
      'Categories: tool, agent, channel, provider, integration, skill, workflow, memory, security, automation, media, data, hardware',
      '',
    ].join('\n'));
    return;
  }

  const service = new CapabilityDiscoveryService();
  const manifest = service.discover();

  let filtered = manifest.capabilities;
  if (categoryFilter) {
    filtered = filtered.filter((c) => c.category === categoryFilter);
  }
  if (tagFilter) {
    filtered = filtered.filter((c) => c.tags.includes(tagFilter));
  }

  const filteredManifest = { ...manifest, capabilities: filtered, total: filtered.length };

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(filteredManifest, null, 2)}\n`);
  } else if (llmFormat) {
    process.stdout.write(service.formatForLLM(filteredManifest));
    process.stdout.write('\n');
  } else if (compactFormat) {
    process.stdout.write(service.formatCompact(filteredManifest));
    process.stdout.write('\n');
  } else {
    process.stdout.write(service.formatForUser(filteredManifest));
  }
}

main().catch((error) => {
  console.error(`[capabilities] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
