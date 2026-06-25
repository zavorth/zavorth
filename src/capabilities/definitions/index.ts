import { CapabilityDefinition } from '../../contracts/CapabilityContract.js';
import { EXECUTOR_CAPABILITIES } from './executors.js';
import { RESEARCH_CAPABILITIES } from './research.js';
import { WORKFLOW_CAPABILITIES } from './workflows.js';
import { INTEGRATION_CAPABILITIES } from './integrations.js';
import { AUTOMATION_CAPABILITIES } from './automation.js';

export const BUILTIN_CAPABILITIES: CapabilityDefinition[] = [
  ...EXECUTOR_CAPABILITIES,
  ...RESEARCH_CAPABILITIES,
  ...WORKFLOW_CAPABILITIES,
  ...INTEGRATION_CAPABILITIES,
  ...AUTOMATION_CAPABILITIES,
];

export { EXECUTOR_CAPABILITIES } from './executors.js';
export { RESEARCH_CAPABILITIES } from './research.js';
export { WORKFLOW_CAPABILITIES } from './workflows.js';
export { INTEGRATION_CAPABILITIES } from './integrations.js';
export { AUTOMATION_CAPABILITIES } from './automation.js';
