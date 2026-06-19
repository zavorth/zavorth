import { describe, it, expect, vi } from 'vitest';
import {
  descriptorRequiresGovernance,
  isSafeObservationTool,
  ToolEffectRegistry,
} from '../../../src/tools/governance/index.js';

describe('ToolEffectRegistry', () => {
  it('classifies datetime and workspace reads as safe observations', () => {
    const registry = new ToolEffectRegistry();

    expect(registry.resolve('get_datetime')).toEqual(expect.objectContaining({
      level: 'observation',
      intentKind: 'tool_call',
      defaultResourceKind: 'time',
      safeObservation: true,
      requiresEffectBoundary: false,
    }));
    expect(registry.resolve('read_file')).toEqual(expect.objectContaining({
      level: 'observation',
      defaultResourceKind: 'workspace',
      safeObservation: true,
    }));
    expect(isSafeObservationTool('workspace.read', registry)).toBe(true);
  });

  it('classifies write, shell and send tools as governed effects', () => {
    const registry = new ToolEffectRegistry();

    expect(registry.resolve('write_file')).toEqual(expect.objectContaining({
      level: 'workspace_mutation',
      intentKind: 'workspace_mutation',
      requiresEffectBoundary: true,
      safeObservation: false,
    }));
    expect(registry.resolve('shell.exec')).toEqual(expect.objectContaining({
      level: 'irreversible_or_destructive',
      defaultResourceKind: 'process',
    }));
    expect(registry.resolve('telegram.send')).toEqual(expect.objectContaining({
      level: 'external_egress',
      defaultResourceKind: 'channel',
    }));
    expect(descriptorRequiresGovernance(registry.resolve('write_file'))).toBe(true);
  });

  it('infers unknown tool definitions conservatively from names and permission metadata', () => {
    const registry = new ToolEffectRegistry({
      toolDefinitions: [
        {
          name: 'custom_report_send',
          description: 'Send a report to a channel.',
          requiresPermission: false,
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'vendor_admin_tool',
          description: 'Dangerous vendor operation.',
          dangerLevel: 'danger',
          requiresPermission: true,
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(registry.resolve('custom_report_send')).toEqual(expect.objectContaining({
      level: 'external_egress',
    }));
    expect(registry.resolve('vendor_admin_tool')).toEqual(expect.objectContaining({
      level: 'irreversible_or_destructive',
    }));
  });
});
