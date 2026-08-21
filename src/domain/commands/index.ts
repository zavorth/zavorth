export * from '../../contracts/commands/UniversalCommandContract.js';
export * from './UniversalCommandRegistry.js';
export * from './CommandToToolAdapter.js';
export * from './BuiltinWaveCommandDescriptors.js';

import { globalCommandRegistry } from './UniversalCommandRegistry.js';
import { getBuiltinWaveCommandDescriptors } from './BuiltinWaveCommandDescriptors.js';

let initialized = false;

export function initializeBuiltinCommands(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  for (const descriptor of getBuiltinWaveCommandDescriptors()) {
    globalCommandRegistry.register(descriptor);
  }
}

export function resetBuiltinCommandsForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetBuiltinCommandsForTests is only allowed in test environment');
  }
  initialized = false;
  globalCommandRegistry.clear();
}
