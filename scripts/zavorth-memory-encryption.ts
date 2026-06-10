#!/usr/bin/env node
import { runZavorthMemoryEncryptionCommand } from '../src/cli/ZavorthMemoryEncryptionCommand.js';

runZavorthMemoryEncryptionCommand(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
