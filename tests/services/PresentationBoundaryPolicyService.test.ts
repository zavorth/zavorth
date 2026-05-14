import { PresentationBoundaryPolicyService } from '../../src/presentation/PresentationBoundaryPolicyService.js';

describe('PresentationBoundaryPolicyService', () => {
  it('passes when presentation files use contracts and local presentation modules only', () => {
    const service = new PresentationBoundaryPolicyService({
      now: () => new Date('2026-04-18T10:00:00.000Z'),
      surfaces: [
        {
          id: 'web-runtime-components',
          label: 'Web Runtime Components',
          description: 'Test surface.',
          roots: ['web/'],
          allowedInternalPrefixes: ['web/', 'contracts/'],
          channels: ['snapshot', 'action', 'event'],
        },
      ],
      readSourceFiles: () => [
        {
          relativePath: 'web/components/Panel.tsx',
          contents: [
            "import React from 'react';",
            "import type { PresentationBoundaryPolicySnapshot } from '../../contracts/PresentationBoundaryContract.js';",
            "import { helper } from './panel-helper.js';",
            'export const panel = helper;',
          ].join('\n'),
        },
        {
          relativePath: 'web/components/panel-helper.ts',
          contents: 'export const helper = true;',
        },
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-18T10:00:00.000Z');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.surfacesReady).toBe(1);
    expect(snapshot.summary.violations).toBe(0);
  });

  it('reports direct imports from presentation into forbidden core roots', () => {
    const service = new PresentationBoundaryPolicyService({
      surfaces: [
        {
          id: 'web-runtime-components',
          label: 'Web Runtime Components',
          description: 'Test surface.',
          roots: ['web/'],
          allowedInternalPrefixes: ['web/', 'contracts/'],
          channels: ['snapshot', 'action', 'event'],
        },
      ],
      readSourceFiles: () => [
        {
          relativePath: 'web/components/BadPanel.tsx',
          contents: [
            "import { RuntimeThing } from '../../services/RuntimeThing.js';",
            'export const bad = RuntimeThing;',
          ].join('\n'),
        },
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.violations).toBe(1);
    expect(snapshot.violations[0]).toEqual(expect.objectContaining({
      file: 'web/components/BadPanel.tsx',
      importPath: '../../services/RuntimeThing.js',
      resolvedPath: 'services/RuntimeThing.js',
    }));
  });
});
