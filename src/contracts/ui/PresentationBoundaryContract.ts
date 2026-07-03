export type PresentationBoundaryChannel = 'snapshot' | 'action' | 'event' | 'stream' | 'asset';

export type PresentationBoundaryPosture = 'healthy' | 'attention' | 'critical';

export type PresentationSurfaceId =
  | 'web-runtime-components'
  | 'classic-zavorthControl-assets'
  | 'web-console-assets'
  | 'ai-gateway-zavorthControl'
  | 'companion-voice-surface';

export type PresentationSurfaceContract = {
  id: PresentationSurfaceId;
  label: string;
  description: string;
  roots: string[];
  allowedInternalPrefixes: string[];
  channels: PresentationBoundaryChannel[];
};

export type PresentationBoundaryViolation = {
  surfaceId: PresentationSurfaceId;
  file: string;
  line: number;
  importPath: string;
  resolvedPath: string | null;
  reason: string;
};

export type PresentationBoundarySurfaceSnapshot = {
  id: PresentationSurfaceId;
  label: string;
  roots: string[];
  fileCount: number;
  channels: PresentationBoundaryChannel[];
  violations: PresentationBoundaryViolation[];
  ready: boolean;
};

export type PresentationBoundaryPolicySnapshot = {
  generatedAt: string;
  summary: {
    posture: PresentationBoundaryPosture;
    surfacesReady: number;
    surfacesTotal: number;
    auditedFiles: number;
    violations: number;
    allowedChannels: PresentationBoundaryChannel[];
  };
  surfaces: PresentationBoundarySurfaceSnapshot[];
  violations: PresentationBoundaryViolation[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export const PRESENTATION_BOUNDARY_FORBIDDEN_PREFIXES = [
  'services/',
  'domain/',
  'runtime/',
  'execution/',
  'orchestrator/',
  'database/',
  'storage/',
  'providers/',
  'core/',
  'host/',
  'nodes/',
  'channels/',
  'gateway/',
  'gateways/',
  'security/',
] as const;

export const PRESENTATION_BOUNDARY_ALLOWED_CHANNELS: PresentationBoundaryChannel[] = [
  'snapshot',
  'action',
  'event',
  'stream',
  'asset',
];

export const PRESENTATION_SURFACE_CONTRACTS: PresentationSurfaceContract[] = [
  {
    id: 'web-runtime-components',
    label: 'Web Runtime Components',
    description: 'React runtime widgets that must communicate through web endpoints, streams and contracts.',
    roots: ['web/'],
    allowedInternalPrefixes: ['contracts/'],
    channels: ['snapshot', 'action', 'event', 'stream'],
  },
  {
    id: 'classic-zavorthControl-assets',
    label: 'Classic ZavorthControl Assets',
    description: 'Legacy zavorthControl HTML/client assets, kept as presentation-only adapters over operations endpoints.',
    roots: ['domain/surface/presentation/zavorthControl/ZavorthControlClassic'],
    allowedInternalPrefixes: ['domain/surface/presentation/zavorthControl/ZavorthControlClassic', 'contracts/'],
    channels: ['snapshot', 'action', 'asset'],
  },
  {
    id: 'web-console-assets',
    label: 'Web Console Assets',
    description: 'Runtime shell HTML, client script and styles rendered as assets instead of runtime logic.',
    roots: [
      'domain/surface/presentation/web-console/',
    ],
    allowedInternalPrefixes: [
      'domain/surface/presentation/web-console/',
      'presentation/',
      'config/',
      'contracts/',
    ],
    channels: ['asset', 'event', 'stream'],
  },
  {
    id: 'ai-gateway-zavorthControl',
    label: 'AI Gateway ZavorthControl',
    description: 'Next zavorthControl screens that should use app APIs and local ai-gateway UI modules, not Zavorth core services.',
    roots: ['ai-gateway/app/(zavorthControl)/'],
    allowedInternalPrefixes: [
      'ai-gateway/app/(zavorthControl)/',
      'ai-gateway/shared/',
      'ai-gateway/store/',
      'ai-gateway/types/',
      'ai-gateway/lib/',
      'contracts/',
    ],
    channels: ['snapshot', 'action', 'event', 'asset'],
  },
  {
    id: 'companion-voice-surface',
    label: 'Companion And Voice Surface',
    description: 'Voice/companion surface adapters, allowed to use local infrastructure but not direct domain/service internals.',
    roots: ['voice/'],
    allowedInternalPrefixes: ['voice/', 'contracts/'],
    channels: ['action', 'event', 'stream'],
  },
];
