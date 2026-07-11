import { ToolEffectRegistry } from './ToolEffectRegistry.js';

export const SAFE_OBSERVATION_TOOL_NAMES = [
  'get_datetime',
  'read_file',
  'list_directory',
  'workspace.read',
  'workspace.list',
  'memory.read',
  'sessions.history',
  'sessions.list',
  'session_search',
  'session_search_fts5',
  'zavorth_session_search',
  'sessions.search',
] as const;

export function isSafeObservationTool(toolName: string, registry = new ToolEffectRegistry()): boolean {
  return registry.resolve(toolName).safeObservation;
}
