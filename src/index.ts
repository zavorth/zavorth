import {
  ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE,
} from './services/ProcessLockService.js';
import { bootstrapZavorthRuntime } from './bootstrap/bootstrapRuntime.js';

async function bootstrap(): Promise<void> {
  await bootstrapZavorthRuntime();
}

bootstrap().catch((err) => {
  // Nao manter o temporizador de progresso ativo em caso de falha fatal.
  console.error('Erro fatal:', err);
  if (err?.code === 'ZAVORTH_PROCESS_LOCK_CONFLICT') {
    process.exit(ZAVORTH_PROCESS_LOCK_CONFLICT_EXIT_CODE);
  }
  process.exit(1);
});
