import {
  ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE,
} from './services/ProcessLockService.js';
import { bootstrapZavorthRuntime } from './bootstrap/bootstrapRuntime.js';

async function bootstrap(): Promise<void> {
  await bootstrapZavorthRuntime();
}

bootstrap().catch((err) => {
  // Do not keep the progress timer alive on fatal failure.
  console.error('Fatal error:', err);
  if (err?.code === 'ZAVORTH_PROCESS_LOCK_CONFLICT') {
    process.exit(ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE);
  }
  process.exit(1);
});
