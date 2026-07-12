/** Planner and execution modes shared across the execution domain boundary. */
export type SwarmScalePlannerMode = 'heuristic' | 'llm' | 'custom';
export type SwarmScaleExecutionMode = 'deterministic' | 'llm-live' | 'custom';
export type SwarmScaleExecutionBackendId =
  | 'auto'
  | 'local'
  | 'docker'
  | 'ssh'
  | 'wsl'
  | 'vercel-sandbox'
  | 'modal'
  | 'daytona'
  | 'singularity';
export type SwarmScaleControlSurface =
  | 'cli'
  | 'tui'
  | 'desktop'
  | 'zavorthControl'
  | 'api'
  | 'agent'
  | 'system';
