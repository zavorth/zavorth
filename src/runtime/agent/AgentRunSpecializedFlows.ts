import { installAgentRunEvidenceFlows } from './AgentRunEvidenceFlows.js';
import { installAgentRunPlanningFlows } from './AgentRunPlanningFlows.js';
import { installAgentRunSelfModificationFlows } from './AgentRunSelfModificationFlows.js';
import { installAgentRunSwarmFlows } from './AgentRunSwarmFlows.js';
import { installAgentRunWatchModeFlows } from './AgentRunWatchModeFlows.js';

export function installAgentRunSpecializedFlows(AgentRunServiceClass: { prototype: Record<string, any> }): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  installAgentRunEvidenceFlows(AgentRunServiceClass);
  installAgentRunPlanningFlows(AgentRunServiceClass);
  installAgentRunSelfModificationFlows(AgentRunServiceClass);
  installAgentRunWatchModeFlows(AgentRunServiceClass);
  installAgentRunSwarmFlows(AgentRunServiceClass);
}
