export * from '../../contracts/commands/UniversalCommandContract.js';
export * from './UniversalCommandRegistry.js';
export * from './CommandToToolAdapter.js';
export * from './BuiltinWaveCommandDescriptors.js';

import { globalCommandRegistry } from './UniversalCommandRegistry.js';
import { getBuiltinWaveCommandDescriptors } from './BuiltinWaveCommandDescriptors.js';

export function initializeBuiltinCommands(): void {
  for (const descriptor of getBuiltinWaveCommandDescriptors()) {
    globalCommandRegistry.register(descriptor);
  }
}

// Auto-initialize default wave descriptors
initializeBuiltinCommands();
