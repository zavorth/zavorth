import { runAutoRepairCli } from './cli/AutoRepairCli.js';

void runAutoRepairCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`Failure no CLI de self-repair: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
